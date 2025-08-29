// src/ipc-handlers/ventas-handlers.js (VERSIÓN FINAL)
const { ipcMain } = require("electron");
const { Op } = require("sequelize");

const { generarFacturaAFIP } = require("../services/afip-service");
const { findPaymentByReference } = require("../services/mercadoPago-Service");
// Nota: node-thermal-printer / electron-pos-printer no se usan aquí (ticket se imprime desde admin-handlers)

function registerVentasHandlers(models, sequelize) {
  const { Producto, Venta, DetalleVenta, Cliente, Usuario, Factura } = models;

  // --- Utilidad: crear venta en transacción (para reuso) ---
  const createSaleTx = async (ventaData, t) => {
    const {
      detalles,
      metodoPago,
      ClienteId,
      dniCliente,
      UsuarioId,
      montoPagado,
      externalReference,
    } = ventaData;

    if (!detalles || detalles.length === 0) throw new Error("No hay items en la venta.");

    // Subtotal
    let subtotal = 0;
    for (const it of detalles) {
      subtotal += Number(it.precioUnitario || 0) * Number(it.cantidad || 0);
    }

    // Config admin (descuentos/recargos)
    const adminConfig = await Usuario.findOne({
      where: { rol: "administrador" },
      transaction: t,
      raw: true,
    });
    const recargoPorcentaje = Number(adminConfig?.config_recargo_credito || 0);
    const descEfPorcentaje = Number(adminConfig?.config_descuento_efectivo || 0);

    // Cliente (por ID o DNI)
    let cliente = null;
    if (ClienteId) {
      cliente = await Cliente.findByPk(ClienteId, { transaction: t });
    } else if (dniCliente) {
      [cliente] = await Cliente.findOrCreate({
        where: { dni: dniCliente },
        defaults: { nombre: "Cliente Ocasional", descuento: 0 },
        transaction: t,
      });
    }

    // Descuentos
    let descCliente = 0;
    if (cliente && Number(cliente.descuento) > 0) {
      descCliente = subtotal * (Number(cliente.descuento) / 100);
    }
    let descEfectivo = 0;
    if (metodoPago === "Efectivo" && descEfPorcentaje > 0) {
      descEfectivo = (subtotal - descCliente) * (descEfPorcentaje / 100);
    }
    const descuentoTotal = descCliente + descEfectivo;

    const totalTrasDesc = subtotal - descuentoTotal;

    // Recargo (Crédito)
    const recargo = metodoPago === "Crédito" ? totalTrasDesc * (recargoPorcentaje / 100) : 0;

    const totalFinal = totalTrasDesc + recargo;

    // Monto pagado y vuelto
    const montoPagadoFinal = metodoPago === "Efectivo" ? Number(montoPagado || 0) : totalFinal;
    const vuelto = metodoPago === "Efectivo" ? montoPagadoFinal - totalFinal : 0;

    if (metodoPago === "Efectivo" && montoPagadoFinal < totalFinal) {
      throw new Error("El monto pagado es insuficiente.");
    }

    // Crear venta
    const venta = await Venta.create(
      {
        metodoPago,
        total: totalFinal,
        montoPagado: montoPagadoFinal,
        vuelto: vuelto > 0 ? vuelto : 0,
        dniCliente,
        montoDescuento: descuentoTotal,
        recargo,
        UsuarioId,
        ClienteId: cliente ? cliente.id : null,
        facturada: false,
      },
      { transaction: t }
    );

    // Crear detalles y actualizar stock
    const detallesRows = [];
    for (const item of detalles) {
      const cantidad = Number(item.cantidad || 0);
      const pUnit = Number(item.precioUnitario || 0);
      detallesRows.push({
        VentaId: venta.id,
        ProductoId: item.ProductoId,
        cantidad,
        precioUnitario: pUnit,
        subtotal: cantidad * pUnit,
        nombreProducto: item.nombreProducto,
      });

      if (item.ProductoId && !String(item.ProductoId).startsWith("manual-")) {
        await Producto.increment(
          { stock: -cantidad },
          { where: { id: item.ProductoId }, transaction: t }
        );
      }
    }
    // bulk para menos roundtrips
    if (detallesRows.length) {
      await DetalleVenta.bulkCreate(detallesRows, { transaction: t });
    }

    // Mercado Pago (opcional) — consulta del pago por referencia
    let datosPagoMP = null;
    if (metodoPago === "QR" && externalReference) {
      if (adminConfig && adminConfig.mp_access_token) {
        // pequeña espera para que el pago aparezca
        await new Promise((r) => setTimeout(r, 1500));
        const payment = await findPaymentByReference(adminConfig.mp_access_token, externalReference);
        if (payment) {
          datosPagoMP = {
            id: payment.id,
            status: payment.status,
            date_approved: payment.date_approved,
          };
        }
      }
    }

    return {
      venta,
      datosRecibo: {
        items: detalles,
        total: totalFinal,
        descuento: descuentoTotal,
        recargo,
        metodoPago,
        montoPagado: montoPagadoFinal,
        vuelto: vuelto > 0 ? vuelto : 0,
        dniCliente,
      },
      datosPagoMP,
    };
  };

  // Listado de ventas (con joins principales)
  ipcMain.handle("get-ventas", async (_event, filters) => {
    try {
      const { fechaInicio, fechaFin } = filters || {};
      const whereClause = {};
      if (fechaInicio && fechaFin) {
        whereClause.createdAt = {
          [Op.between]: [new Date(fechaInicio), new Date(fechaFin)],
        };
      }
      const ventas = await Venta.findAll({
        where: whereClause,
        include: [
          {
            model: DetalleVenta,
            as: "detalles",
            include: [{ model: Producto, as: "producto", paranoid: false }],
          },
          { model: Cliente, as: "cliente", attributes: ["nombre", "apellido", "dni"] },
          { model: Usuario, as: "usuario", attributes: ["nombre"] },
          { model: Factura, as: "factura" },
        ],
        order: [["createdAt", "DESC"]],
      });
      return ventas.map((v) => v.toJSON());
    } catch (error) {
      console.error("Error al obtener ventas:", error);
      return [];
    }
  });

  // Búsqueda inteligente (código de barras / balanza / nombre)
  ipcMain.handle("busqueda-inteligente", async (_event, texto) => {
    if (!texto) return null;
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
      const cfg = admin ? admin.config_balanza : null;

      // Si es código de balanza
      if (cfg?.prefijo && String(texto).startsWith(cfg.prefijo)) {
        const ci = Number(cfg.codigo_inicio) - 1;
        const vi = Number(cfg.valor_inicio) - 1;
        const codigoProducto = String(texto).substring(ci, ci + Number(cfg.codigo_longitud));
        const valorStr = String(texto).substring(vi, vi + Number(cfg.valor_longitud));
        const valor = parseFloat(valorStr) / (Number(cfg.valor_divisor) || 1);

        const producto = await Producto.findOne({ where: { codigo_barras: codigoProducto } });
        if (producto) {
          const pj = producto.toJSON();
          if (cfg.tipo_valor === "peso") {
            pj.cantidad = valor;
          } else {
            pj.cantidad = 1;
            pj.precioVenta = valor;
          }
          return pj;
        }
      }

      // Si no, buscar por barcode exacto o nombre like
      const whereClause = {
        [Op.or]: [
          { codigo_barras: String(texto) },
          { nombre: { [Op.like]: `%${String(texto)}%` } },
        ],
      };
      const producto = await Producto.findOne({ where: whereClause });
      return producto ? producto.toJSON() : null;
    } catch (error) {
      console.error("Error en búsqueda inteligente:", error);
      return null;
    }
  });

  // Registrar venta
  ipcMain.handle("registrar-venta", async (_event, ventaData) => {
    const t = await sequelize.transaction();
    try {
      const { venta, datosRecibo, datosPagoMP } = await createSaleTx(ventaData, t);
      await t.commit();
      return {
        success: true,
        ventaId: venta.id,
        message: `Venta #${venta.id} registrada.`,
        datosRecibo,
        datosPagoMP,
      };
    } catch (error) {
      await t.rollback();
      console.error("Error al registrar la venta:", error);
      return { success: false, message: error.message || "Error al guardar la venta." };
    }
  });

  // Registrar venta y facturar (reusa la misma lógica de registrar)
  ipcMain.handle("registrar-venta-y-facturar", async (_event, ventaData) => {
    const t = await sequelize.transaction();
    try {
      const { venta, datosRecibo, datosPagoMP } = await createSaleTx(ventaData, t);
      await t.commit();

      try {
        const c = venta.ClienteId ? await Cliente.findByPk(venta.ClienteId) : null;
        const admin = await Usuario.findOne({ where: { rol: "administrador" } });
        const resultadoFactura = await generarFacturaAFIP({
          venta,
          cliente: c,
          admin,
          models,
        });

        return {
          success: true,
          ventaId: venta.id,
          message: `Venta #${venta.id} registrada. ${resultadoFactura.message}`,
          datosRecibo,
          datosPagoMP,
        };
      } catch (facturaError) {
        console.error("Venta guardada, pero Facturación falló:", facturaError);
        let msg = facturaError.message || "Error facturando.";
        if (
          msg.includes("getaddrinfo ENOTFOUND") ||
          msg.includes("ERR_NAME_NOT_RESOLVED") ||
          msg.includes("ECONNRESET")
        ) {
          msg = "No se pudo conectar con los servidores de AFIP. Verifica internet/firewall.";
        }
        return {
          success: true,
          ventaId: venta.id,
          message: `Venta #${venta.id} registrada. PERO NO SE PUDO FACTURAR: ${msg}`,
          datosRecibo,
          datosPagoMP,
        };
      }
    } catch (error) {
      await t.rollback();
      console.error("Error al registrar la venta+facturar:", error);
      return { success: false, message: error.message || "Error al guardar la venta." };
    }
  });
}

module.exports = { registerVentasHandlers };
