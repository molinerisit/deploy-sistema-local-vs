const { ipcMain } = require("electron");
const { getScaleManager } = require("../scale/scale-manager");

function registerScaleHandlers(models) {
  ipcMain.handle("scale-upsert-plu", async (_e, payload) => {
    try {
      const mgr = await getScaleManager(models);
      const res = await mgr.upsertPLU(payload); // ahora maneja barcode
      return { success: !!res, message: res || "OK" };
    } catch (e) {
      console.error("[SCALE][UPSERT] Error:", e);
      return { success: false, message: e.message || "Error" };
    }
  });

  ipcMain.handle("scale-delete-plu", async (_e, { plu }) => {
    try {
      const mgr = await getScaleManager(models);
      const res = await mgr.deletePLU(plu);
      return { success: !!res, message: res || "OK" };
    } catch (e) {
      console.error("[SCALE][DELETE] Error:", e);
      return { success: false, message: e.message || "Error" };
    }
  });

  ipcMain.handle("scale-sync-all-plu", async () => {
    try {
      const mgr = await getScaleManager(models);
      const { Producto, Usuario } = models;

      const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
      const cfg = admin?.config_balanza || null;

      const products = await Producto.findAll({
        attributes: ["plu","nombre","precio","pesable","tara","barcode"],
        where: { pesable: true }, raw: true
      });

      const mapped = (products || []).map(p => {
        const priceCent = Math.round((+p.precio || 0) * 100);
        let code = p.barcode || null;
        if (!code && cfg) {
          // autogeneramos si falta y hay formato
          code = mgr.buildBarcodeFromConfig(cfg, {
            plu: parseInt(p.plu),
            priceCent: (cfg.tipo_valor === "precio") ? priceCent : 0,
            weightGr:  (cfg.tipo_valor === "peso") ? 1000 : 0
          });
        }
        return {
          plu:   parseInt(p.plu),
          name:  String(p.nombre || "").slice(0, 24),
          price: priceCent,
          tare:  parseInt(p.tara) || 0,
          barcode: code
        };
      }).filter(x => x.plu && x.name && Number.isFinite(x.price));

      const report = await mgr.syncAll(mapped);
      return { success: true, message: report || `Enviados ${mapped.length} PLUs` };
    } catch (e) {
      console.error("[SCALE][SYNC-ALL] Error:", e);
      return { success: false, message: e.message || "Error" };
    }
  });
}

module.exports = { registerScaleHandlers };
