// src/services/mercadoPagoService.js

const axios = require("axios");
// Se importa 'uuid' para generar claves de idempotencia, una buena práctica para evitar duplicados.
const { v4: uuidv4 } = require("uuid");

const MERCADO_PAGO_API_URL = "https://api.mercadopago.com";

/**
 * Crea una orden para un QR Dinámico.
 * El cliente escanea un QR físico y el monto aparece en su celular.
 * @param {object} config - Las credenciales { accessToken, userId, posId }
 * @param {number} amount - El monto total de la venta
 * @param {string} externalReference - Una referencia única para esta venta
 * @returns {Promise<object>} La respuesta de la API de Mercado Pago
 */
async function createOrderForQR(config, amount, externalReference) {
  const { accessToken, userId, posId } = config;
  if (!accessToken || !userId || !posId) {
    throw new Error("Credenciales de Mercado Pago incompletas.");
  }

  // --- MEJORA CLAVE: Validación y formateo robusto del monto ---
  // 1. Se valida que el monto sea un número y mayor que cero.
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error(`El monto proporcionado no es válido: ${amount}`);
  }
  // 2. Se formatea el monto a dos decimales, un requisito de la API de Mercado Pago.
  const finalAmount = parseFloat(numericAmount.toFixed(2));

  const url = `${MERCADO_PAGO_API_URL}/instore/qr/seller/collectors/${userId}/pos/${posId}/orders`;

  const body = {
    external_reference: externalReference,
    title: "Orden de Compra",
    description: "Orden generada por el sistema de gestión",
    // 3. Se utiliza el monto validado y formateado.
    total_amount: finalAmount,
    items: [
      {
        title: "Productos Varios",
        unit_price: finalAmount,
        quantity: 1,
        total_amount: finalAmount,
        unit_measure: "unit",
      },
    ],
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    // 4. Se añade Idempotency-Key para evitar ordenes duplicadas en caso de reintentos de red.
    "X-Idempotency-Key": uuidv4(),
  };

  // Log mejorado para depuración: ahora muestra el monto final que se envía.
  console.log(
    `Enviando orden a MP para la caja ${posId} por un total de ${finalAmount}. Ref: ${externalReference}`
  );

  // Se utiliza el método PUT como lo requiere la API para órdenes de QR.
  const response = await axios.put(url, body, { headers });
  return response.data;
}

/**
 * Busca un pago en Mercado Pago usando la referencia externa.
 * @param {string} accessToken - Tu token de acceso
 * @param {string} externalReference - La referencia única de la venta
 * @returns {Promise<object|null>} El objeto del pago si se encuentra, o null.
 */
async function findPaymentByReference(accessToken, externalReference) {
  const url = `${MERCADO_PAGO_API_URL}/v1/payments/search`;
  const params = {
    external_reference: externalReference,
    sort: "date_created",
    criteria: "desc",
  };
  const headers = { Authorization: `Bearer ${accessToken}` };

  const response = await axios.get(url, { params, headers });

  // Devolvemos el primer resultado si existe
  if (
    response.data &&
    response.data.results &&
    response.data.results.length > 0
  ) {
    return response.data.results[0];
  }
  return null;
}

/**
 * Busca pagos en Mercado Pago con filtros de fecha y estado.
 * @param {string} accessToken - Tu token de acceso
 * @param {object} filters - Opciones como { dateFrom, dateTo, status }
 * @returns {Promise<Array>} Una lista de objetos de pago.
 */
async function listPayments(accessToken, filters = {}) {
  const url = `${MERCADO_PAGO_API_URL}/v1/payments/search`;

  const params = {
    sort: "date_created",
    criteria: "desc", // Los más nuevos primero
  };

  // La API de Mercado Pago espera el formato ISO 8601 con la 'Z' al final (UTC).
  if (filters.dateFrom) params.begin_date = filters.dateFrom;
  if (filters.dateTo) params.end_date = filters.dateTo;
  if (filters.status) params.status = filters.status;

  const headers = { Authorization: `Bearer ${accessToken}` };

  console.log("Buscando pagos en MP con los filtros:", params);
  const response = await axios.get(url, { params, headers });

  if (response.data && response.data.results) {
    // Filtramos para asegurar que solo mostramos estados relevantes para un TPV.
    return response.data.results.filter(
      (p) =>
        p.status === "approved" ||
        p.status === "pending" ||
        p.status === "rejected" ||
        p.status === "cancelled"
    );
  }
  return [];
}

// Se exportan todas las funciones para que puedan ser utilizadas por los handlers.
module.exports = {
  createOrderForQR,
  findPaymentByReference,
  listPayments,
};
