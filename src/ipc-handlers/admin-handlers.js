// src/ipc-handlers/admin-handlers.js
// Handlers de USUARIOS / EMPLEADOS / GASTOS + config (sync/AFIP/arqueo) + test-print

const { ipcMain, BrowserWindow } = require("electron");
const bcrypt = require("bcrypt");

// (opcionales: mantenidos por compatibilidad; no los usa el test-print actual)
const printer = require("node-thermal-printer");
const { PosPrinter } = require("electron-pos-printer");

function registerAdminHandlers(models) {
  const { Usuario, Empleado, GastoFijo } = models;

  // -----------------------------
  // USUARIOS
  // -----------------------------
  ipcMain.handle("get-all-users", async () => {
    try {
      const users = await Usuario.findAll({
        attributes: { exclude: ["password"] },
        order: [["nombre", "ASC"]],
        raw: true,
      });
      return users;
    } catch (error) {
      console.error("Error en 'get-all-users':", error);
      return [];
    }
  });

  ipcMain.handle("get-app-modules", () => {
    return [
      { id: "caja", nombre: "Caja" },
      { id: "reportes", nombre: "Ventas" },
      { id: "productos", nombre: "Productos" },
      { id: "insumos", nombre: "Insumos" },
      { id: "proveedores", nombre: "Proveedores" },
      { id: "clientes", nombre: "Clientes" },
      { id: "cuentas_corrientes", nombre: "Ctas. Corrientes" },
      { id: "etiquetas", nombre: "Etiquetas" },
      { id: "mp_transactions", nombre: "Transacciones MP" },
      { id: "dashboard", nombre: "Estadísticas" },
    ];
  });

  ipcMain.handle("save-user", async (_event, userData) => {
    try {
      const { id, nombre, password, rol, permisos } = userData || {};
      const cleanNombre = String(nombre || "").trim();
      const cleanPassword = String(password || "").trim();

      if (!cleanNombre) {
        return { success: false, message: "El nombre de usuario no puede estar vacío." };
      }
      if (!rol) {
        return { success: false, message: "El rol es obligatorio." };
      }

      // Aseguramos que permisos sea un array (el campo en DB es JSON)
      const permsArray = Array.isArray(permisos) ? permisos : [];

      if (id) {
        const userToUpdate = await Usuario.findByPk(id);
        if (!userToUpdate) return { success: false, message: "Usuario no encontrado." };

        userToUpdate.nombre = cleanNombre;
        userToUpdate.rol = rol;
        userToUpdate.permisos = permsArray;

        if (cleanPassword) {
          const salt = await bcrypt.genSalt(10);
          userToUpdate.password = await bcrypt.hash(cleanPassword, salt);
        }
        await userToUpdate.save();
      } else {
        if (!cleanPassword) {
          return { success: false, message: "La contraseña es obligatoria para usuarios nuevos." };
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(cleanPassword, salt);
        await Usuario.create({
          nombre: cleanNombre,
          password: hashedPassword,
          rol,
          permisos: permsArray,
        });
      }
      return { success: true };
    } catch (error) {
      if (error.name === "SequelizeUniqueConstraintError") {
        return { success: false, message: "El nombre de usuario ya existe." };
      }
      console.error("Error en 'save-user':", error);
      return { success: false, message: "Ocurrió un error inesperado al guardar el usuario." };
    }
  });

  ipcMain.handle("delete-user", async (_event, userId) => {
    try {
      const userToDelete = await Usuario.findByPk(userId);
      if (!userToDelete) return { success: false, message: "El usuario no existe." };

      if (userToDelete.rol === "administrador") {
        // Opcional: impedir borrar el último admin
        const admins = await Usuario.count({ where: { rol: "administrador" } });
        if (admins <= 1) {
          return { success: false, message: "No se puede eliminar el último administrador." };
        }
      }
      await userToDelete.destroy();
      return { success: true };
    } catch (error) {
      console.error("Error en 'delete-user':", error);
      return { success: false, message: "Error al eliminar el usuario." };
    }
  });

  // -----------------------------
  // SINCRONIZACIÓN (config)
  // -----------------------------
  ipcMain.handle("save-sync-config", async (_event, data) => {
    try {
      if (!data || !data.sync_api_url || !String(data.sync_api_url).trim()) {
        return { success: false, message: "La URL de la API no puede estar vacía." };
      }

      const payload = {
        sync_enabled: !!data.sync_enabled,
        sync_api_url: String(data.sync_api_url).trim(),
      };

      if (data.license_key && String(data.license_key).trim()) {
        payload.license_key = String(data.license_key).trim();
      }

      await Usuario.update(payload, { where: { rol: "administrador" } });
      return { success: true };
    } catch (error) {
      console.error("Error al guardar config de sincronización:", error);
      return { success: false, message: error.message };
    }
  });

  // -----------------------------
  // EMPLEADOS
  // -----------------------------
  ipcMain.handle("get-empleados", async () => {
    try {
      return await Empleado.findAll({
        attributes: ["id", "nombre", "funcion", "sueldo", "createdAt", "updatedAt"],
        order: [["nombre", "ASC"]],
        raw: true,
      });
    } catch (error) {
      console.error("Error en 'get-empleados':", error);
      return [];
    }
  });

  ipcMain.handle("save-empleado", async (_event, data) => {
    try {
      const { id, nombre, funcion, sueldo } = data || {};
      const cleanNombre = String(nombre || "").trim();
      if (!cleanNombre) {
        return { success: false, message: "El nombre del empleado es obligatorio." };
      }
      const cleanData = {
        nombre: cleanNombre,
        funcion: funcion ? String(funcion).trim() : null,
        sueldo: Number.isFinite(+sueldo) ? +sueldo : 0,
      };
      if (id) {
        await Empleado.update(cleanData, { where: { id } });
      } else {
        await Empleado.create(cleanData);
      }
      return { success: true };
    } catch (error) {
      console.error("Error al guardar empleado:", error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle("delete-empleado", async (_event, id) => {
    try {
      const result = await Empleado.destroy({ where: { id } });
      return result > 0 ? { success: true } : { success: false, message: "Empleado no encontrado" };
    } catch (error) {
      console.error("Error al eliminar empleado:", error);
      return { success: false, message: "Ocurrió un error inesperado." };
    }
  });

  // -----------------------------
  // GASTOS FIJOS
  // -----------------------------
  ipcMain.handle("get-gastos-fijos", async () => {
    try {
      return await GastoFijo.findAll({
        attributes: ["id", "nombre", "monto", "createdAt", "updatedAt"],
        order: [["nombre", "ASC"]],
        raw: true,
      });
    } catch (error) {
      console.error("Error en 'get-gastos-fijos':", error);
      return [];
    }
  });

  ipcMain.handle("save-gasto-fijo", async (_event, data) => {
    try {
      const { id, nombre, monto } = data || {};
      const cleanNombre = String(nombre || "").trim();
      if (!cleanNombre) {
        return { success: false, message: "El nombre del gasto es obligatorio." };
      }
      const cleanData = {
        nombre: cleanNombre,
        monto: Number.isFinite(+monto) ? +monto : 0,
      };
      if (id) {
        await GastoFijo.update(cleanData, { where: { id } });
      } else {
        await GastoFijo.create(cleanData);
      }
      return { success: true };
    } catch (error) {
      console.error("Error al guardar gasto fijo:", error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle("delete-gasto-fijo", async (_event, id) => {
    try {
      const result = await GastoFijo.destroy({ where: { id } });
      return result > 0 ? { success: true } : { success: false, message: "Gasto no encontrado" };
    } catch (error) {
      console.error("Error al eliminar gasto fijo:", error);
      return { success: false, message: "Ocurrió un error inesperado." };
    }
  });

  // -----------------------------
  // AFIP (CONFIG)
  // -----------------------------
  ipcMain.handle("save-afip-config", async (_event, data) => {
    try {
      await Usuario.update(
        {
          afip_cuit: data?.cuit || null,
          afip_pto_vta: data?.ptoVta || null,
          afip_cert_path: data?.certPath || null,
          afip_key_path: data?.keyPath || null,
        },
        { where: { rol: "administrador" } }
      );
      return { success: true };
    } catch (error) {
      console.error("Error al guardar config AFIP:", error);
      return { success: false, message: error.message };
    }
  });

  // -----------------------------
  // FACTURACIÓN: toggle
  // -----------------------------
  ipcMain.handle("save-facturacion-status", async (_event, status) => {
    try {
      await Usuario.update({ facturacion_activa: !!status }, { where: { rol: "administrador" } });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // -----------------------------
  // CAJA / ARQUEO (config)
  // -----------------------------
  ipcMain.handle("save-arqueo-config", async (_event, data) => {
    try {
      await Usuario.update(
        { config_arqueo_caja: data || null },
        { where: { rol: "administrador" } }
      );
      return { success: true };
    } catch (error) {
      console.error("[CONFIG][ARQUEO] Error:", error);
      return { success: false, message: "Error al guardar configuración de caja." };
    }
  });

  // -----------------------------
  // TEST DE IMPRESIÓN
  // -----------------------------
  ipcMain.handle("test-print", async (_event, printerName) => {
    try {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow) {
        return { success: false, message: "No hay ventana enfocada para imprimir." };
      }

      const options = {
        silent: false, // true = directo sin diálogo
        printBackground: true,
        deviceName: printerName || undefined,
      };

      const testWin = new BrowserWindow({ show: false });
      await testWin.loadURL(
        `data:text/html,
        <html>
          <body style="font-family: monospace; font-size:12px; padding:10px;">
            <h2>🧾 PRUEBA DE IMPRESIÓN</h2>
            <p>Impresora: ${printerName || "(predeterminada)"}</p>
            <p>Fecha: ${new Date().toLocaleString()}</p>
            <hr/>
            <p>Si ves este ticket, la impresora está funcionando.</p>
          </body>
        </html>`
      );

      await testWin.webContents.executeJavaScript("document.body.innerHTML");

      await new Promise((resolve, reject) => {
        testWin.webContents.print(options, (success, failureReason) => {
          if (!success) reject(new Error(failureReason));
          else resolve();
        });
      });

      testWin.close();
      return { success: true };
    } catch (error) {
      console.error("Error en test-print:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerAdminHandlers };
