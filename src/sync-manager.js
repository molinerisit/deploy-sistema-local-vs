// src/sync-manager.js — scope por dispositivo (tenant-wide vs device-local)
const fetch = require("node-fetch");
const os = require("os");
const crypto = require("crypto");

/** =========================
 *  Helpers: Dispositivo
 *  ========================= */
function getPrimaryMac() {
  try {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
      for (const ni of ifaces[name] || []) {
        if (!ni.internal && ni.mac && ni.mac !== "00:00:00:00:00:00") {
          return ni.mac;
        }
      }
    }
  } catch {}
  return "00:00:00:00:00:00";
}

/** Fingerprint estable sin dependencias externas */
function getDeviceId() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    getPrimaryMac(),
    // Podrías añadir número de serie del disco u otra señal si la tenés
  ].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** =========================
 *  Detectar endpoint de status
 *  ========================= */
async function detectStatusEndpoint(apiUrl, licenseKey, deviceId) {
  const q = (base) =>
    `${base}?licenseKey=${encodeURIComponent(licenseKey)}${
      deviceId ? `&deviceId=${encodeURIComponent(deviceId)}` : ""
    }`;

  const candidates = [
    q(`${apiUrl}/desktop/license/status`),
    q(`${apiUrl}/subscription/status`),
    q(`${apiUrl}/license/status`),
  ];

  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: "GET", timeout: 8000 });
      if (r.ok) return url;
    } catch {}
  }
  // si nada respondió ok, devolvemos el primero (para logging)
  return candidates[0];
}

let isSyncing = false;

/** =========================
 *  Upserts locales auxiliares
 *  ========================= */
async function upsertSubscription(models, licenseKey, statusObj, lastSyncAt) {
  if (!models.Subscription) return; // backward-safe
  const now = new Date();
  const values = {
    license_key: licenseKey,
    plan: statusObj?.plan || null,
    status: statusObj?.status || "inactive",
    expires_at: statusObj?.expiresAt ? new Date(statusObj.expiresAt) : null,
    days_left: Number(statusObj?.daysLeft || 0),
    features: statusObj?.features || {},
    last_checked_at: now,
    last_sync_at: lastSyncAt || null,
    cloud_tenant_id: statusObj?.cloudTenantId || statusObj?.tenant || null,
    mp_preapproval_id: statusObj?.mpPreapprovalId || null,
  };

  const [row, created] = await models.Subscription.findOrCreate({
    where: { license_key: licenseKey },
    defaults: values,
  });

  if (!created) {
    await row.update(values);
  }
}

/** Inventario de dispositivos (opcional) */
async function upsertDevice(models, deviceInfo) {
  // Si no existe el modelo Device, ignoramos silenciosamente.
  if (!models.Device) return;
  const { device_id } = deviceInfo;
  if (!device_id) return;
  const [row, created] = await models.Device.findOrCreate({
    where: { device_id },
    defaults: deviceInfo,
  });
  if (!created) {
    await row.update(deviceInfo);
  }
}

/** Merge genérico por clave natural (id lógico), crea/actualiza y elimina los que no existan si corresponde */
async function mergeByKey(models, modelName, items, keyFields = ["remote_id"]) {
  const Model = models[modelName];
  if (!Model) return; // si no existe el modelo, salimos
  if (!Array.isArray(items)) return;

  // Traemos actuales
  const existing = await Model.findAll();
  const index = new Map(existing.map((r) => [keyFields.map(k => String(r[k] ?? "")).join("|"), r]));

  const incomingKeys = new Set();
  for (const obj of items) {
    const key = keyFields.map(k => String(obj[k] ?? "")).join("|");
    incomingKeys.add(key);
    const current = index.get(key);
    if (current) {
      // Update si cambió algo
      await current.update(obj);
    } else {
      await Model.create(obj);
    }
  }

  // (Opcional) Eliminar huérfanos locales que ya no vienen del servidor.
  // Descomentar si tu estrategia requiere purgar:
  // for (const [key, row] of index.entries()) {
  //   if (!incomingKeys.has(key)) await row.destroy();
  // }
}

/** =========================
 *  RUN SYNC (heartbeat + merges)
 *  =========================
 *  @param {object} models
 *  @param {Sequelize} sequelize
 *  @param {string} apiUrl
 *  @param {string} licenseKey
 *  @param {object} deviceCtx  (opcional):
 *    {
 *      deviceId: string,
 *      // datos locales NO sensibles, utilitarios para auditoría:
 *      info: { hostname, platform, arch, appVersion } (opcional),
 *
 *      // payload para enviar al server si corresponde:
 *      // OJO: por la regla de negocio, los TOKENS se sincronizan (catálogo tenant),
 *      // pero la SELECCIÓN ACTIVA NO (queda en DevicePreference).
 *      // Acá podés enviar "tokens" solo si tu backend los acepta por API (POST).
 *      push: {
 *        mpTokens?: Array<{ remote_id?, alias?, access_token?, createdAt?, updatedAt? }>,
 *        scales?: Array<{ remote_id?, name, transport, ip, port, btAddress, protocol }>
 *      }
 *    }
 */
async function runSync(models, sequelize, apiUrl, licenseKey, deviceCtx = {}) {
  if (isSyncing) return { success: false, message: "Sync in progress" };
  isSyncing = true;

  const deviceId = deviceCtx.deviceId || getDeviceId();
  const now = new Date();

  try {
    if (!apiUrl) throw new Error("API URL vacía.");
    if (!licenseKey) throw new Error("licenseKey vacío.");

    // --- FASE 0: VERIFICAR SUSCRIPCIÓN (con deviceId si el backend lo soporta) ---
    const statusUrl = await detectStatusEndpoint(apiUrl, licenseKey, deviceId);
    const resp = await fetch(statusUrl, { method: "GET", timeout: 10000 });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Estado de licencia no disponible (${resp.status}). ${txt}`);
    }
    const status = await resp.json();

    // Esperado: { status, plan, expiresAt, daysLeft, features, cloudTenantId, mpPreapprovalId, ... }
    if (!status || !status.status) {
      throw new Error("Respuesta de licencia incompleta.");
    }

    // Persistimos el snapshot de subscripción local (siempre)
    await upsertSubscription(models, licenseKey, status, null);

    // Si no está activa, retornamos sin pull/push
    if (status.status !== "active" && status.status !== "warning") {
      return {
        success: false,
        message: status.message || "Suscripción no activa.",
        status,
      };
    }

    // --- FASE 0.5: Heartbeat de dispositivo (opcional, no bloqueante si el endpoint no existe)
    try {
      const hbUrl = `${apiUrl}/desktop/heartbeat`;
      const payload = {
        licenseKey,
        deviceId,
        info: deviceCtx.info || {
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
        },
        // mandamos timestamps de cliente para debug
        ts: now.toISOString(),
      };
      await fetch(hbUrl, {
        method: "POST",
        timeout: 6000,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    } catch {}

    // Guardamos/actualizamos inventario local de dispositivos (si el modelo existe)
    await upsertDevice(models, {
      device_id: deviceId,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      last_seen_at: now,
      app_version: deviceCtx.info?.appVersion || null,
    });

    // --- FASE 1 (opcional): PUSH de catálogo compartido (tenant-wide) ---
    // ⚠️ Importante: la "selección activa" de token/impresora/balanza NO se sube.
    // Solo se suben “catálogos” (si tu backend lo soporta).
    try {
      if (deviceCtx.push && (deviceCtx.push.mpTokens || deviceCtx.push.scales)) {
        const url = `${apiUrl}/desktop/tenant/catalog`;
        await fetch(url, {
          method: "POST",
          timeout: 10000,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenseKey,
            deviceId,
            mpTokens: deviceCtx.push.mpTokens || [],
            scales: deviceCtx.push.scales || [],
          }),
        }).catch(() => {});
      }
    } catch {}

    // --- FASE 2 (opcional): PULL de catálogos compartidos ---
    // Contrato sugerido: el backend devuelve algo como:
    // {
    //   mpTokens: [{ remote_id, alias, access_token (opcional/enc), createdAt, updatedAt }],
    //   scales:   [{ remote_id, name, transport, ip, port, btAddress, protocol, createdAt, updatedAt }]
    // }
    let pulled = {};
    try {
      const pullUrl = `${apiUrl}/desktop/tenant/catalog?licenseKey=${encodeURIComponent(
        licenseKey
      )}&deviceId=${encodeURIComponent(deviceId)}`;
      const pr = await fetch(pullUrl, { method: "GET", timeout: 10000 });
      if (pr.ok) pulled = await pr.json();
    } catch {}

    // === Aplicar merges locales si hay modelos ===
    // Reglas:
    //   - MpToken/Scale = compartidos entre equipos (se sincronizan)
    //   - DevicePreference = SOLO local (NO tocar acá)
    if (Array.isArray(pulled.mpTokens)) {
      // Guardamos tokens como catálogo local (sin elegir “activo”)
      // 🔐 Si tu backend NO quiere devolver access_token plano, guarda un “enc_payload”
      // y desencripta en main si corresponde; acá asumimos string.
      await mergeByKey(
        models,
        "MpToken",
        pulled.mpTokens.map((t) => ({
          remote_id: String(t.remote_id ?? t.id ?? t.alias),
          alias: t.alias || null,
          access_token: t.access_token || null, // si backend no lo manda, dejalo null (solo alias)
          tenant_id: t.tenant_id || status.cloudTenantId || null,
        })),
        ["remote_id"]
      );
    }

    if (Array.isArray(pulled.scales)) {
      await mergeByKey(
        models,
        "Scale",
        pulled.scales.map((s) => ({
          remote_id: String(s.remote_id ?? s.id ?? `${s.name}|${s.transport}|${s.ip ?? s.btAddress ?? ""}`),
          name: s.name || null,
          transport: s.transport || "tcp",
          ip: s.ip || null,
          port: s.port ?? 8000,
          btAddress: s.btAddress || null,
          protocol: s.protocol || "kretz-report",
          tenant_id: s.tenant_id || status.cloudTenantId || null,
        })),
        ["remote_id"]
      );
    }

    // Persistimos el cache de suscripción con marca de last_sync_at
    await upsertSubscription(models, licenseKey, status, new Date());

    return {
      success: true,
      message: "Verificación OK",
      status,
      deviceId,
    };
  } catch (error) {
    console.error("❌ [SYNC] Error:", error.message);
    return { success: false, message: error.message, status: null, deviceId };
  } finally {
    isSyncing = false;
  }
}

module.exports = {
  runSync,
  getDeviceId, // por si querés pasarlo desde main para logging/diagnóstico
};
