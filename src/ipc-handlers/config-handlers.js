// src/ipc-handlers/config-handlers.js
const { ipcMain, BrowserWindow, app } = require("electron");
const { SerialPort } = require("serialport");
const path = require("path");
const fs = require("fs/promises");
const bcrypt = require("bcrypt");
const { getScaleManager } = require("../scale/scale-manager");

// Para disparar sync manual desde la UI
const { runSync } = require("../sync-manager");

function registerConfigHandlers(models, sequelize) {
  const { Usuario } = models;

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
        permisos: ["all"], // Guardar como ARRAY (campo JSON), no stringificado
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

  // 2) Leer config admin
  ipcMain.handle("get-admin-config", async () => {
    try {
      const admin = await Usuario.findOne({
        where: { rol: "administrador" },
        attributes: { exclude: ["password"] },
      });
      if (!admin) return null;
      const cfg = admin.toJSON();
      if (cfg.facturacion_activa == null) cfg.facturacion_activa = false;
      return cfg;
    } catch (error) {
      console.error("[CONFIG] Error al leer config admin:", error);
      return null;
    }
  });

  // 3) Mercado Pago
  ipcMain.handle("save-mp-config", async (_event, data) => {
    try {
      const { accessToken, userId, posId } = data || {};
      await Usuario.update(
        {
          mp_access_token: String(accessToken || "").trim(),
          mp_user_id: String(userId || "").trim(),
          mp_pos_id: String(posId || "").trim(),
        },
        { where: { rol: "administrador" } }
      );
      return { success: true };
    } catch (error) {
      console.error("[CONFIG][MP] Error:", error);
      return { success: false, message: "Error al guardar la configuración de Mercado Pago." };
    }
  });

  // 4) Balanza
  ipcMain.handle("save-balanza-config", async (_event, configData) => {
    try {
      await Usuario.update({ config_balanza: configData }, { where: { rol: "administrador" } });
      return { success: true };
    } catch (error) {
      console.error("[CONFIG][BALANZA] Error:", error);
      return { success: false, message: "Error al guardar la configuración de la balanza." };
    }
  });

  // 5) Parámetros generales
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

  // 6) Hardware
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
    const { scannerPort, printerName } = data || {};
    try {
      await Usuario.update(
        {
          config_puerto_scanner: scannerPort || null,
          config_puerto_impresora: printerName || null,
        },
        { where: { rol: "administrador" } }
      );
      return { success: true };
    } catch (error) {
      console.error("[HARDWARE-CONFIG] Error al guardar:", error);
      return { success: false, message: "Error al guardar la configuración de hardware." };
    }
  });

  // 7) Info del negocio + logo
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

  // 8) Estado de suscripción (cache local)
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

  // Guardar config de conexión de balanza
ipcMain.handle("save-scale-config", async (_event, cfg) => {
  try {
    await Usuario.update(
      { config_balanza_conexion: cfg || null },
      { where: { rol: "administrador" } }
    );
    // refrescar instancia del manager con la nueva config
    const mgr = await getScaleManager(models);
    await mgr.reloadConfig();
    return { success: true };
  } catch (e) {
    console.error("[CONFIG][SCALE] Error:", e);
    return { success: false, message: e.message };
  }
});

// Probar conexión
ipcMain.handle("scale-test-connection", async () => {
  try {
    const mgr = await getScaleManager(models);
    const ok = await mgr.testConnection();
    return ok ? { success: true, message: ok } : { success: false, message: "Sin respuesta" };
  } catch (e) {
    return { success: false, message: e.message || "Error al conectar" };
  }
});


  // 9) Sincronización manual
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
