// src/ipc-handlers/mercadoPago-handlers.js
const axios = require("axios");
console.log("[MP HANDLER DEBUG] El archivo mercadoPago-handlers.js ha sido cargado por Node.js (require).");

const { ipcMain } = require("electron");
const { v4: uuidv4 } = require("uuid");
const {
  createOrderForQR,
  findPaymentByReference,
  listPayments,
} = require("../services/mercadoPago-Service"); // Asegurate que el path/casing coincide con el archivo real

function registerMercadoPagoHandlers(models /*, sequelize */) {
  console.log("[MP HANDLER DEBUG] La función registerMercadoPagoHandlers() ha sido llamada por main.js.");
  const { Usuario } = models;

  // POS (cajas)
  ipcMain.handle("get-mp-pos-list", async (_event, { accessToken }) => {
    console.log("[MP HANDLER DEBUG] 'get-mp-pos-list' invocado.");
    if (!accessToken) return { success: false, message: "Se requiere el Access Token." };
    try {
      const url = "https://api.mercadopago.com/pos";
      const headers = { Authorization: `Bearer ${accessToken}` };
      const { data } = await axios.get(url, { headers });

      if (data && Array.isArray(data.results)) {
        return { success: true, data: data.results };
      }
      return { success: false, message: "No se encontraron cajas en la respuesta de MP." };
    } catch (error) {
      console.error("FALLO COMPLETO en get-mp-pos-list:", error);
      const message = error?.response?.data?.message || error?.message || "Error de comunicación con Mercado Pago.";
      return { success: false, message };
    }
  });

  // Crear orden QR
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
      console.error("Error CATASTRÓFICO en 'create-mp-order':", error);
      return { success: false, message: error.message || "Error creando la orden de pago." };
    }
  });

  // Estado de pago por referencia
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

  // Listado de transacciones
  ipcMain.handle("get-mp-transactions", async (_event, filters) => {
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
      if (!admin?.mp_access_token) throw new Error("El Access Token de Mercado Pago no está configurado.");

      const payments = await listPayments(admin.mp_access_token, filters);
      return { success: true, data: payments };
    } catch (error) {
      console.error("get-mp-transactions error:", error);
      return { success: false, message: "Error al comunicarse con Mercado Pago." };
    }
  });
}

module.exports = { registerMercadoPagoHandlers };
