// src/ipc-handlers/dashboard-handlers.js
const { ipcMain } = require("electron");
const { Op } = require("sequelize");

function registerDashboardHandlers(models, sequelize) {
  ipcMain.handle("get-dashboard-stats", async (_event, { dateFrom, dateTo, familiaId, departamentoId }) => {
    try {
      const startDate = new Date(dateFrom);
      const endDate = new Date(dateTo);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      const dateWhere = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } };

      // Filtrado por catálogo
      let productIdsToFilter = null;
      if (familiaId) {
        const products = await models.Producto.findAll({
          where: { FamiliaId: familiaId },
          attributes: ["id"],
          raw: true,
        });
        productIdsToFilter = products.map((p) => p.id);
      } else if (departamentoId) {
        const products = await models.Producto.findAll({
          attributes: ["id"],
          include: [
            {
              model: models.ProductoFamilia,
              as: "familia",
              attributes: [],
              required: true,
              where: { DepartamentoId: departamentoId },
            },
          ],
          raw: true,
        });
        productIdsToFilter = products.map((p) => p.id);
      }

      // Ventas del periodo (IDs, filtradas por detalle si corresponde)
      const ventaIdsQuery = { where: dateWhere, attributes: ["id"] };
      if (productIdsToFilter && productIdsToFilter.length > 0) {
        ventaIdsQuery.include = [
          {
            model: models.DetalleVenta,
            as: "detalles",
            attributes: [],
            required: true,
            where: { ProductoId: { [Op.in]: productIdsToFilter } },
          },
        ];
      }
      const ventaIds = (await models.Venta.findAll(ventaIdsQuery)).map((v) => v.id);

      if (ventaIds.length === 0) {
        return {
          success: true,
          stats: {
            totalFacturado: 0,
            numeroVentas: 0,
            ticketPromedio: 0,
            gananciaBruta: 0,
            margenGanancia: 0,
            productosMasVendidos: [],
            ventasPorDia: [],
            totalFacturadoAnterior: 0,
            totalComprasproducto: 0,
            totalGastosFijos: 0,
          },
        };
      }

      // Totales ventas
      const ventasPeriodo = await models.Venta.findAll({ where: { id: { [Op.in]: ventaIds } }, raw: true });
      const totalFacturado = ventasPeriodo.reduce((sum, v) => sum + (v.total || 0), 0);
      const numeroVentas = ventasPeriodo.length;
      const ticketPromedio = numeroVentas > 0 ? totalFacturado / numeroVentas : 0;

      // Detalles (para margen)
      const detalles = await models.DetalleVenta.findAll({
        include: [{ model: models.Producto, as: "producto", attributes: ["precioCompra"], required: true }],
        where: { VentaId: { [Op.in]: ventaIds } },
        raw: true,
        nest: true,
      });

      const gananciaBruta = detalles.reduce((sum, d) => {
        const costo = Number(d.producto?.precioCompra) || 0;
        const precio = Number(d.precioUnitario) || 0;
        const cant = Number(d.cantidad) || 0;
        return sum + (precio - costo) * cant;
      }, 0);
      const margenGanancia = totalFacturado > 0 ? (gananciaBruta / totalFacturado) * 100 : 0;

      // Top productos
      const productosMasVendidos = await models.DetalleVenta.findAll({
        where: { VentaId: { [Op.in]: ventaIds } },
        attributes: ["ProductoId", [sequelize.fn("SUM", sequelize.col("cantidad")), "total_vendido"]],
        include: [{ model: models.Producto, as: "producto", attributes: ["nombre"], required: true }],
        group: ["ProductoId", "producto.id", "producto.nombre"],
        order: [[sequelize.literal("total_vendido"), "DESC"]],
        limit: 5,
        raw: true,
        nest: true,
      });

      // Serie temporal
      const ventasPorDia = await models.Venta.findAll({
        attributes: [
          [sequelize.fn("DATE", sequelize.col("createdAt")), "fecha"],
          [sequelize.fn("SUM", sequelize.col("total")), "total_diario"],
        ],
        where: { id: { [Op.in]: ventaIds } },
        group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
        order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
        raw: true,
      });

      // Periodo anterior
      const diffDias = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const prevStart = new Date(startDate); prevStart.setDate(prevStart.getDate() - diffDias);
      const prevEnd = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1);

      const ventaIdsAnterioresQuery = {
        where: { createdAt: { [Op.gte]: prevStart, [Op.lte]: prevEnd } },
        attributes: ["id"],
      };
      if (productIdsToFilter && productIdsToFilter.length > 0) {
        ventaIdsAnterioresQuery.include = [
          {
            model: models.DetalleVenta,
            as: "detalles",
            attributes: [],
            required: true,
            where: { ProductoId: { [Op.in]: productIdsToFilter } },
          },
        ];
      }
      const ventaIdsAnteriores = (await models.Venta.findAll(ventaIdsAnterioresQuery)).map((v) => v.id);
      const totalFacturadoAnterior =
        (await models.Venta.sum("total", { where: { id: { [Op.in]: ventaIdsAnteriores } } })) || 0;

      // Compras y gastos
      const totalComprasproducto =
        (await models.Compra.sum("total", { where: { fecha: { [Op.gte]: startDate, [Op.lte]: endDate } } })) || 0;
      const totalGastosFijos = (await models.GastoFijo.sum("monto")) || 0;

      return {
        success: true,
        stats: {
          totalFacturado,
          numeroVentas,
          ticketPromedio,
          gananciaBruta,
          margenGanancia,
          productosMasVendidos,
          ventasPorDia,
          totalFacturadoAnterior,
          totalComprasproducto,
          totalGastosFijos,
        },
      };
    } catch (error) {
      console.error("Error al obtener estadísticas del dashboard:", error);
      return { success: false, message: error.message };
    }
  });
}

module.exports = { registerDashboardHandlers };
