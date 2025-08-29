// src/ipc-handlers/facturacion-handlers.js
const { ipcMain } = require("electron");
const { generarFacturaAFIP } = require("../services/afip-service");

function registerFacturacionHandlers(models) {
  const { Venta, Usuario, Cliente, Factura } = models;

  ipcMain.handle("facturar-venta", async (_event, { ventaId, tipoComp }) => {
    try {
      const admin = await Usuario.findOne({ where: { rol: "administrador" } });
      if (!admin) throw new Error("No se encontró un usuario administrador para AFIP.");

      const venta = await Venta.findByPk(ventaId);
      if (!venta) throw new Error("La venta no existe.");
      if (venta.facturada) throw new Error("Esta venta ya fue facturada previamente.");

      const cliente = venta.ClienteId ? await Cliente.findByPk(venta.ClienteId) : null;

      const resultado = await generarFacturaAFIP({
        venta,
        cliente,
        admin,
        models,
        tipoCompForzado: tipoComp,
      });

      return { success: true, message: resultado.message };
    } catch (error) {
      console.error("ERROR EN EL HANDLER [facturar-venta]:", error);
      return { success: false, message: error.message };
    }
  });

  // Historial de ventas facturadas
  ipcMain.handle("get-ventas-con-factura", async () => {
    try {
      const ventasFacturadas = await Venta.findAll({
        where: { facturada: true },
        include: [
          { model: Factura, as: "factura", required: true },
          { model: Cliente, as: "cliente" },
        ],
        order: [["createdAt", "DESC"]],
      });
      return ventasFacturadas.map((v) => v.toJSON());
    } catch (error) {
      console.error("Error en [get-ventas-con-factura]:", error);
      return [];
    }
  });
}

module.exports = { registerFacturacionHandlers };
