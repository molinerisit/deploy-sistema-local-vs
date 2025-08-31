// src/ipc-handlers/mercadoPago-handlers.js
const axios = require("axios");
console.log("[MP HANDLER DEBUG] mercadoPago-handlers.js cargado.");

const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const {
  createOrderForQR,
  findPaymentByReference,
  listPayments,
} = require("../services/mercadoPago-Service"); // Asegurate que el path/casing coincide

function registerMercadoPagoHandlers(models /*, sequelize */) {
  console.log("[MP HANDLER DEBUG] registerMercadoPagoHandlers() llamada por main.js.");
  const { Usuario } = models;

  // -----------------------------
  // LISTAR POS (CAJAS)
  // -----------------------------
  ipcMain.handle("get-mp-pos-list", async (_event, { accessToken }) => {
    console.log("[MP HANDLER DEBUG] 'get-mp-pos-list' invocado.");
    const token = String(accessToken || "").trim();
    if (!token) return { success: false, message: "Se requiere el Access Token." };

    try {
      // Probamos varias rutas porque MP cambia endpoints según cuenta/región
      const endpoints = [
        "https://api.mercadopago.com/pos",
        "https://api.mercadopago.com/v1/pos",
        "https://api.mercadopago.com/instore/pos",
      ];

      let data = null;
      for (const url of endpoints) {
        try {
          const r = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          });
          // MP devuelve { results: [...] } o a veces un array llano
          if (r && r.status >= 200 && r.status < 300) {
            data = r.data;
            break;
          }
        } catch (e) {
          // seguimos probando
        }
      }

      if (!data) {
        return { success: false, message: "No se pudo obtener el listado de cajas (POS)." };
      }

      const arr = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : [];
      const normalized = arr.map((pos) => ({
        id: pos.id || pos.pos_id || null,
        name: pos.name || pos.description || `POS ${pos.id || ""}`,
        external_id: pos.external_id || pos.externalId || null,
      }));

      return { success: true, data: normalized };
    } catch (error) {
      console.error("Fallo en get-mp-pos-list:", error?.response?.data || error?.message || error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Error de comunicación con Mercado Pago.";
      return { success: false, message };
    }
  });

  // -----------------------------
  // CREAR ORDEN QR
  // -----------------------------
  ipcMain.handle("create-mp-order", async (_event, { total }) => {
    console.log("--- [DIAGNÓSTICO QR] --- Se ha invocado 'create-mp-order'.");
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
      console.log("ADMIN CONFIG ENCONTRADO DESDE LA CAJA:", admin);

      if (!admin?.mp_access_token || !admin?.mp_user_id || !admin?.mp_pos_id) {
        console.error("VALIDACIÓN FALLIDA: credenciales incompletas.");
        return { success: false, message: "La configuración de Mercado Pago está incompleta." };
      }

      console.log("VALIDACIÓN EXITOSA: credenciales completas. Creando orden…");
      const mpConfig = {
        accessToken: admin.mp_access_token,
        userId: admin.mp_user_id,
        posId: admin.mp_pos_id,
      };

      const amount = Number(total);
      if (!(amount > 0)) return { success: false, message: "Importe inválido." };

      const externalReference = `venta-${uuidv4()}`;
      await createOrderForQR(mpConfig, amount, externalReference);

      return { success: true, externalReference };
    } catch (error) {
      console.error("Error en 'create-mp-order':", error);
      return { success: false, message: error.message || "Error creando la orden de pago." };
    }
  });

  // -----------------------------
  // ESTADO DE PAGO POR REFERENCIA
  // -----------------------------
  ipcMain.handle("check-mp-payment-status", async (_event, { externalReference }) => {
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
      if (!admin?.mp_access_token) throw new Error("Falta Access Token.");

      const payment = await findPaymentByReference(admin.mp_access_token, externalReference);
      return { success: true, status: payment?.status || "pending" };
    } catch (error) {
      console.error("check-mp-payment-status error:", error);
      return { success: false, message: "Error al consultar el estado del pago." };
    }
  });

  // -----------------------------
  // LISTADO DE TRANSACCIONES
  // -----------------------------
  ipcMain.handle("get-mp-transactions", async (_event, filters) => {
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
      if (!admin?.mp_access_token) {
        throw new Error("El Access Token de Mercado Pago no está configurado.");
      }

      const payments = await listPayments(admin.mp_access_token, filters);
      return { success: true, data: payments };
    } catch (error) {
      console.error("get-mp-transactions error:", error);
      return { success: false, message: "Error al comunicarse con Mercado Pago." };
    }
  });
}

module.exports = { registerMercadoPagoHandlers };
