const { ipcMain, BrowserWindow, app } = require("electron");
const { SerialPort } = require("serialport");
const path = require("path");
const fs = require("fs/promises");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const os = require("os");

const { getScaleManager } = require("../scale/scale-manager");
const { runSync } = require("../sync-manager");

/** ==== Helpers de dispositivo (ID local persistente) ==== */
const DEVICE_FILE = "device.json";
async function ensureDeviceId() {
  const dir = app.getPath("userData");
  const file = path.join(dir, DEVICE_FILE);
  try {
    const buf = await fs.readFile(file, "utf8");
    const { deviceId } = JSON.parse(buf);
    if (deviceId) return deviceId;
  } catch {}
  const deviceId = crypto.randomUUID();
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  await fs.writeFile(file, JSON.stringify({ deviceId }), "utf8");
  return deviceId;
}

async function getOrCreateDevicePref(models, deviceId) {
  const { DevicePreference } = models;
  let pref = await DevicePreference.findOne({ where: { device_id: deviceId } });
  if (!pref) {
    pref = await DevicePreference.create({
      device_id: deviceId,
      hostname: os.hostname(),
      platform: process.platform,
      arch: process.arch,
      printer_name: null,
      scanner_port: null,
      mp_active_remote_id: null,
      mp_pos_id: null,
      active_scale_remote_id: null,
      config_balanza_conexion_override: null,
    });
  }
  return pref;
}

/** ==== Helpers de catálogo ==== */
function hashRemoteIdFromToken(accessToken) {
  return crypto.createHash("sha256").update(String(accessToken || "")).digest("hex").slice(0, 24);
}
function buildScaleRemoteId(cfg) {
  // determinístico por endpoint
  const t = (cfg?.transport || "tcp").toLowerCase();
  const k = t === "bt" ? (cfg?.btAddress || "") : `${cfg?.ip || ""}:${cfg?.port || ""}`;
  return crypto.createHash("sha1").update(`${t}:${k}`).digest("hex").slice(0, 20);
}

function registerConfigHandlers(models, sequelize) {
  const { Usuario, MpToken, Scale, DevicePreference } = models;

  // 1) Setup inicial (admin)
  ipcMain.handle("submit-setup", async (_event, { nombre, password }) => {
    try {
      const cleanName = String(nombre || "").trim();
      if (!cleanName || !password) {
        return { success: false, message: "Nombre y contraseña son obligatorios." };
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newAdmin = await Usuario.create({
        nombre: cleanName,
        password: hashedPassword,
        rol: "administrador",
        permisos: ["all"],
      });

      const { password: _omit, ...userData } = newAdmin.toJSON();
      return { success: true, userData };
    } catch (error) {
      console.error("[SETUP] Error al crear el administrador:", error);
      const msg =
        error?.name === "SequelizeUniqueConstraintError"
          ? "Ya existe un administrador con ese nombre."
          : error.message || "Error al crear el admin";
      return { success: false, message: msg };
    }
  });

  // 2) Leer config admin (mezcla GLOBAL + preferencias locales por dispositivo)
  ipcMain.handle("get-admin-config", async () => {
    try {
      const admin = await Usuario.findOne({
        where: { rol: "administrador" },
        attributes: { exclude: ["password"] },
      });
      if (!admin) return null;

      const cfg = admin.toJSON();
      if (cfg.facturacion_activa == null) cfg.facturacion_activa = false;

      // Inyectar preferencias por dispositivo
      const deviceId = await ensureDeviceId();
      const pref = await getOrCreateDevicePref(models, deviceId);

      // Hardware (local)
      cfg.config_puerto_scanner   = pref.scanner_port || "";
      cfg.config_puerto_impresora = pref.printer_name || "";

      // MP (local: selección activa)
      cfg.mp_access_token = null; // nunca devolvemos token acá
      cfg.mp_user_id      = cfg.mp_user_id || ""; // (si lo cargaron)
      cfg.mp_pos_id       = pref.mp_pos_id || "";

      // Balanza – selección activa (local). Si hay una activa, devolvemos su config como compat:
      if (pref.active_scale_remote_id) {
        const sc = await Scale.findOne({ where: { remote_id: pref.active_scale_remote_id } });
        if (sc) {
          cfg.config_balanza_conexion = {
            transport: sc.transport,
            ip: sc.ip,
            port: sc.port,
            btAddress: sc.btAddress,
            protocol: sc.protocol,
            timeoutMs: sc.timeoutMs,
          };
        }
      }

      // Formato de balanza (GLOBAL) se mantiene en cfg.config_balanza

      // Info de suscripción cache (GLOBAL ya estaba en Usuario)
      return cfg;
    } catch (error) {
      console.error("[CONFIG] Error al leer config admin:", error);
      return null;
    }
  });

  // 3) Mercado Pago
  //    - Upsert catálogo tenant-wide: MpToken (por accessToken → remote_id hash)
  //    - Guardar selección activa local: DevicePreference { mp_active_remote_id, mp_pos_id }
  ipcMain.handle("save-mp-config", async (_event, data) => {
    try {
      const { accessToken, userId, posId } = data || {};
      const cleanToken = String(accessToken || "").trim();
      const cleanUser  = String(userId || "").trim();
      const cleanPos   = String(posId || "").trim();

      if (!cleanToken || !cleanPos) {
        return { success: false, message: "Access Token y Caja (POS) son obligatorios." };
      }

      const remote_id = hashRemoteIdFromToken(cleanToken);

      // Upsert de catálogo (token). Guardamos alias y user_id informativo.
      // Nota: según tu seguridad, podés cifrar accessToken o ni almacenarlo completo.
      await MpToken.upsert({
        remote_id,
        alias: cleanUser ? `MP-${cleanUser}` : `MP-${remote_id.slice(0,6)}`,
        access_token: cleanToken, // <-- si querés, cifrar en el modelo/hook
        user_id: cleanUser || null,
      });

      // Preferencia local (selección activa)
      const deviceId = await ensureDeviceId();
      const pref = await getOrCreateDevicePref(models, deviceId);
      pref.mp_active_remote_id = remote_id;
      pref.mp_pos_id = cleanPos;
      await pref.save();

      return { success: true };
    } catch (error) {
      console.error("[CONFIG][MP] Error:", error);
      return { success: false, message: "Error al guardar la configuración de Mercado Pago." };
    }
  });

  // 4) Balanza – formato (GLOBAL, parsing/generación)
  ipcMain.handle("save-balanza-config", async (_event, configData) => {
    try {
      await Usuario.update({ config_balanza: configData }, { where: { rol: "administrador" } });
      return { success: true };
    } catch (error) {
      console.error("[CONFIG][BALANZA] Error:", error);
      return { success: false, message: "Error al guardar la configuración de la balanza." };
    }
  });

  // 5) Parámetros generales (GLOBAL)
  ipcMain.handle("save-general-config", async (_event, data) => {
    try {
      const recargo = Number.isFinite(+data?.recargoCredito) ? +data.recargoCredito : 0;
      const dto = Number.isFinite(+data?.descuentoEfectivo) ? +data.descuentoEfectivo : 0;

      await Usuario.update(
        { config_recargo_credito: recargo, config_descuento_efectivo: dto },
        { where: { rol: "administrador" } }
      );
      return { success: true };
    } catch (error) {
      console.error("[CONFIG][GENERAL] Error:", error);
      return { success: false, message: "Error al guardar la configuración general." };
    }
  });

  // 6) Hardware (LOCAL por dispositivo)
  ipcMain.handle("get-available-ports", async () => {
    try {
      const serialPorts = await SerialPort.list();
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const printers = focusedWindow ? await focusedWindow.webContents.getPrintersAsync() : [];

      console.log("[HARDWARE-CONFIG] PRINTERS:", printers.map((p) => p.name));
      return {
        serialPorts: serialPorts.map((p) => p.path),
        printers: printers.map((p) => p.name),
      };
    } catch (error) {
      console.error("[HARDWARE-CONFIG] Error al listar puertos/impresoras:", error);
      return { serialPorts: [], printers: [] };
    }
  });

  ipcMain.handle("save-hardware-config", async (_event, data) => {
    try {
      const deviceId = await ensureDeviceId();
      const pref = await getOrCreateDevicePref(models, deviceId);
      pref.scanner_port = data?.scannerPort || null;
      pref.printer_name = data?.printerName || null;
      await pref.save();
      return { success: true };
    } catch (error) {
      console.error("[HARDWARE-CONFIG] Error al guardar:", error);
      return { success: false, message: "Error al guardar la configuración de hardware." };
    }
  });

  // 7) Info del negocio + logo (GLOBAL)
  ipcMain.handle("save-business-info", async (_event, data) => {
    try {
      const { nombre, slogan, footer, logoBase64 } = data || {};
      const admin = await Usuario.findOne({ where: { rol: "administrador" } });
      if (!admin) {
        return { success: false, message: "No se encontró el usuario administrador." };
      }

      if (logoBase64) {
        const base64Data = String(logoBase64).replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");
        const logoDir = path.join(app.getPath("userData"), "images");
        await fs.mkdir(logoDir, { recursive: true });
        const logoPath = path.join(logoDir, "logo.png");
        await fs.writeFile(logoPath, imageBuffer);
        admin.logo_url = "images/logo.png";
      }

      admin.nombre_negocio = String(nombre || "").trim();
      admin.slogan_negocio = String(slogan || "").trim();
      admin.footer_ticket = String(footer || "").trim();
      await admin.save();

      return { success: true };
    } catch (error) {
      console.error("[CONFIG][NEGOCIO] Error:", error);
      return { success: false, message: "Ocurrió un error al guardar la información del negocio." };
    }
  });

  // 8) Estado de suscripción (cache local GLOBAL en Usuario)
  ipcMain.handle("get-subscription-status", async () => {
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" } });
      if (!admin) return { success: false, message: "No se encontró admin." };
      return { success: true, status: admin.subscription_status || null };
    } catch (error) {
      console.error("[CONFIG][SUBS] Error al leer estado:", error);
      return { success: false, message: "No se pudo leer el estado local de la suscripción." };
    }
  });

  // 9) Config de conexión de balanza (CATÁLOGO + preferencia LOCAL)
  //    - Upsert en Scale por endpoint → remote_id
  //    - Guardar selección activa en DevicePreference.active_scale_remote_id
  ipcMain.handle("save-scale-config", async (_event, cfg) => {
    try {
      const clean = {
        transport: (cfg?.transport || "tcp").toLowerCase(),
        ip: cfg?.ip || null,
        port: Number.isFinite(+cfg?.port) ? +cfg.port : 8000,
        btAddress: cfg?.btAddress || null,
        protocol: cfg?.protocol || "kretz-report",
        timeoutMs: Number.isFinite(+cfg?.timeoutMs) ? +cfg.timeoutMs : 4000,
        name: cfg?.name || null,
      };

      const remote_id = buildScaleRemoteId(clean);
      await Scale.upsert({
        remote_id,
        name: clean.name || `Kretz ${clean.transport} ${clean.ip || clean.btAddress || ""}`.trim(),
        transport: clean.transport,
        ip: clean.ip,
        port: clean.port,
        btAddress: clean.btAddress,
        protocol: clean.protocol,
        timeoutMs: clean.timeoutMs,
      });

      const deviceId = await ensureDeviceId();
      const pref = await getOrCreateDevicePref(models, deviceId);
      pref.active_scale_remote_id = remote_id;
      await pref.save();

      // refrescar instancia del manager con la nueva config activa
      const mgr = await getScaleManager(models);
      await mgr.reloadConfig();

      return { success: true };
    } catch (e) {
      console.error("[CONFIG][SCALE] Error:", e);
      return { success: false, message: e.message };
    }
  });

  ipcMain.handle("scale-test-connection", async () => {
    try {
      const mgr = await getScaleManager(models);
      const ok = await mgr.testConnection();
      return ok ? { success: true, message: ok } : { success: false, message: "Sin respuesta" };
    } catch (e) {
      return { success: false, message: e.message || "Error al conectar" };
    }
  });

  // 10) Sincronización manual (GLOBAL)
  ipcMain.handle("run-manual-sync", async () => {
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" } });
      if (!admin || !admin.sync_enabled || !admin.sync_api_url) {
        return { success: false, message: "Sincronización desactivada o sin URL configurada." };
      }

      const result = await runSync(models, sequelize, admin.sync_api_url, admin.license_key);

      if (result?.success) {
        await Usuario.update(
          { subscription_status: result.status || null },
          { where: { id: admin.id } }
        );
      }

      return {
        success: !!result?.success,
        message: result?.message || "",
        status: result?.status || null,
      };
    } catch (error) {
      console.error("[CONFIG][SYNC] Error al ejecutar sync manual:", error);
      return { success: false, message: error.message || "Error al sincronizar" };
    }
  });
}

module.exports = { registerConfigHandlers };
