// src/sync-manager.js
const fetch = require("node-fetch");

/**
 * Detecta un endpoint de status que exista en tu backend.
 * Intenta varias rutas razonables y devuelve la primera que responda 200.
 */
async function detectStatusEndpoint(apiUrl, licenseKey) {
  const candidates = [
    `${apiUrl}/desktop/license/status?licenseKey=${encodeURIComponent(
      licenseKey
    )}`,
    `${apiUrl}/subscription/status?licenseKey=${encodeURIComponent(
      licenseKey
    )}`,
    `${apiUrl}/license/status?licenseKey=${encodeURIComponent(licenseKey)}`,
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

/**
 * Ejecuta la verificación de licencia + (opcional) push/pull.
 * Devuelve { success, message, status }.
 */
async function runSync(models, sequelize, apiUrl, licenseKey) {
  if (isSyncing) return { success: false, message: "Sync in progress" };
  isSyncing = true;

  try {
    if (!apiUrl) throw new Error("API URL vacía.");
    if (!licenseKey) throw new Error("licenseKey vacío.");

    // --- FASE 0: VERIFICAR SUSCRIPCIÓN ---
    const statusUrl = await detectStatusEndpoint(apiUrl, licenseKey);
    const resp = await fetch(statusUrl, { method: "GET", timeout: 10000 });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(
        `Estado de licencia no disponible (${resp.status}). ${txt}`
      );
    }
    const status = await resp.json();

    // status esperado: { status: 'active|warning|disabled|expired|paused|pending', plan, expiresAt, daysLeft, features, cloudTenantId, mpPreapprovalId }
    if (!status || !status.status) {
      throw new Error("Respuesta de licencia incompleta.");
    }
    if (status.status !== "active" && status.status !== "warning") {
      // no sincronizamos si no está activa
      await upsertSubscription(models, licenseKey, status, null);
      return {
        success: false,
        message: status.message || "Suscripción no activa.",
        status,
      };
    }

    // --- FASE 1: PUSH (Opcional; deja tus implementaciones si ya las tenías) ---
    // Ejemplo (comentado):
    // await pushChanges(models, apiUrl, licenseKey, status.cloudTenantId);

    // --- FASE 2: PULL (Opcional) ---
    // Ejemplo (comentado):
    // await pullChanges(models, apiUrl, licenseKey, status.cloudTenantId);

    // Persistimos el cache de suscripción local
    await upsertSubscription(models, licenseKey, status, new Date());

    return {
      success: true,
      message: "Verificación OK",
      status,
    };
  } catch (error) {
    console.error("❌ [SYNC] Error:", error.message);
    return { success: false, message: error.message, status: null };
  } finally {
    isSyncing = false;
  }
}

async function upsertSubscription(models, licenseKey, statusObj, lastSyncAt) {
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

module.exports = { runSync };
