// src/services/afip-service.js

const Afip = require("afip-apis");
const fs = require("fs");

/**
 * Genera una factura fiscal en AFIP para una venta específica.
 * @param {object} params - Un objeto con los parámetros.
 * @param {object} params.venta - La instancia del modelo Venta de Sequelize.
 * @param {object} params.cliente - La instancia del modelo Cliente de Sequelize (puede ser null).
 * @param {object} params.admin - La instancia del modelo Usuario del administrador con la config de AFIP.
 * @param {object} params.models - Objeto con todos los modelos de la DB (Factura, etc.).
 * @param {number} [params.tipoComp] - El tipo de comprobante (opcional). Si no se provee, se autodetecta.
 * @returns {object} Un objeto con los datos de la factura creada.
 * @throws {Error} Si ocurre un error durante el proceso de facturación.
 */
async function generarFacturaAFIP({
  venta,
  cliente,
  admin,
  models,
  tipoComp: tipoCompForzado,
}) {
  const { Factura } = models;

  if (
    !admin.afip_cuit ||
    !admin.afip_pto_vta ||
    !admin.afip_cert_path ||
    !admin.afip_key_path
  ) {
    throw new Error(
      "Configuración de AFIP incompleta. Revisa CUIT, Pto. Venta y archivos."
    );
  }

  if (
    !fs.existsSync(admin.afip_cert_path) ||
    !fs.existsSync(admin.afip_key_path)
  ) {
    throw new Error(`Archivos de AFIP no encontrados. Verifica las rutas.`);
  }

  const afip = new Afip({
    CUIT: admin.afip_cuit,
    certPath: admin.afip_cert_path,
    keyPath: admin.afip_key_path,
    production: false, // ¡IMPORTANTE! Cambiar a `true` para facturación real.
    handleErrors: true,
  });

  // --- Lógica para determinar el tipo de comprobante ---
  let tipoComp = tipoCompForzado;
  let tipoDoc = 99; // Consumidor Final por defecto
  let nroDoc = 0;

  if (!tipoComp) {
    // Si no nos fuerzan un tipo, lo calculamos
    // Esta lógica puede expandirse mucho (ej: checkear condición IVA del admin y del cliente)
    if (cliente) {
      tipoComp = 6; // Factura B por defecto para clientes identificados
      tipoDoc = cliente.cuit ? 80 : 96; // CUIT o DNI
      nroDoc = cliente.cuit || cliente.dni;
    } else {
      tipoComp = 6; // Factura B a Consumidor Final
    }
  }

  const { cbte_nro: ultimoComprobante } =
    await afip.ElectronicBilling.getLastVoucher({
      ptovta: admin.afip_pto_vta,
      tipo_cbte: tipoComp,
    });
  const nroComp = ultimoComprobante + 1;
  const fecha = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const total = parseFloat(venta.total.toFixed(2));

  const data = {
    cant_reg: 1,
    pto_vta: admin.afip_pto_vta,
    tipo_cbte: tipoComp,
    concepto: 1,
    tipo_doc: tipoDoc,
    nro_doc: nroDoc,
    cbte_desde: nroComp,
    cbte_hasta: nroComp,
    cbte_fch: fecha,
    imp_total: total,
    imp_neto: total,
    imp_iva: 0,
    mon_id: "PES",
    mon_cotiz: 1,
  };

  const result = await afip.ElectronicBilling.createVoucher(data);

  if (!result || !result.CAE) {
    const errorMsg =
      result.Errors?.[0]?.Msg ||
      result.Obs?.[0]?.Msg ||
      "AFIP no devolvió un CAE.";
    throw new Error(errorMsg);
  }

  const nuevaFactura = await Factura.create({
    cae: result.CAE,
    caeVto: result.CAEFchVto,
    tipoComp,
    ptoVta: admin.afip_pto_vta,
    nroComp,
    impTotal: total,
    VentaId: venta.id,
  });

  await venta.update({ facturada: true });

  return { factura: nuevaFactura, message: `Factura N° ${nroComp} creada.` };
}

module.exports = { generarFacturaAFIP };
