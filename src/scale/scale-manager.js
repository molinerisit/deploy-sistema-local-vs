const { sendViaTCP, sendViaBT } = require("./transports");

function composeKretzCommand(cmd, fields = []) {
  const STX = "\x02";
  const ETX = "\x03";
  const line = [cmd, ...fields.map(String)].join(";");
  return Buffer.from(`${STX}${line}${ETX}\r\n`, "ascii");
}
function parseAck(buffer) {
  const s = buffer?.toString("ascii").trim();
  return s || "Sin eco (posible OK)";
}

// ======== BARCODE helpers (mismo criterio que en renderer) =========
function luhnMod10(numStr) {
  let sum = 0, dbl = false;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let d = parseInt(numStr[i], 10);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  const mod = sum % 10;
  return (mod === 0 ? 0 : (10 - mod)).toString();
}
function buildBarcodeFromConfig(cfg, { plu, priceCent = 0, weightGr = 0 }) {
  const prefijo = String(cfg.prefijo || "20");
  const pluStr  = String(plu).padStart(cfg.codigo_longitud || 5, "0");
  let valorStr;
  if (cfg.tipo_valor === "peso") {
    const scaled = Math.round(weightGr || 0);
    valorStr = String(scaled).padStart(cfg.valor_longitud || 5, "0");
  } else {
    const scaled = Math.round(priceCent || 0);
    valorStr = String(scaled).padStart(cfg.valor_longitud || 5, "0");
  }
  const base = `${prefijo}${pluStr}${valorStr}`;
  const check = luhnMod10(base);
  return `${base}${check}`;
}
// ===================================================================

let _instance = null;

class ScaleManager {
  constructor(models) {
    this.models = models;
    this.cfg = null;           // transporte (tcp/bt)
    this.formatCfg = null;     // formato balanza (prefijo, etc.)
  }
  async reloadConfig() {
    const { Usuario } = this.models;
    const admin = await Usuario.findOne({ where: { rol: "administrador" }, raw: true });
    this.cfg       = admin?.config_balanza_conexion || null;
    this.formatCfg = admin?.config_balanza || null;
  }
  async ensureConfig() {
    if (!this.cfg || !this.formatCfg) await this.reloadConfig();
    if (!this.cfg)       throw new Error("Sin configuración de conexión de balanza.");
    if (!this.formatCfg) throw new Error("Sin formato de código de balanza configurado.");
  }
  async _send(buffer) {
    await this.ensureConfig();
    const { transport, ip, port, btAddress, timeoutMs } = this.cfg;
    if (transport === "tcp") {
      if (!ip || !port) throw new Error("Falta IP/puerto.");
      return await sendViaTCP({ ip, port, timeoutMs }, buffer);
    } else if (transport === "bt") {
      if (!btAddress) throw new Error("Falta dirección BT.");
      return await sendViaBT({ btAddress, timeoutMs }, buffer);
    }
    throw new Error("Transporte no soportado.");
  }
  async testConnection() {
    const buf = composeKretzCommand("PING");
    const res = await this._send(buf);
    return parseAck(res);
  }

  buildBarcodeFromConfig(cfg, params) {
    return buildBarcodeFromConfig(cfg || this.formatCfg, params);
  }

  async upsertPLU({ plu, name, price, tare = 0, barcode = null, autoBarcode = false }) {
    if (!plu || !name || !Number.isFinite(price))
      throw new Error("PLU, nombre y precio son obligatorios.");

    let code = barcode;
    if ((!code || autoBarcode) && this.formatCfg) {
      code = buildBarcodeFromConfig(this.formatCfg, {
        plu: parseInt(plu),
        priceCent: (this.formatCfg.tipo_valor === "precio") ? price : 0,
        weightGr:  (this.formatCfg.tipo_valor === "peso")   ? 1000 : 0
      });
    }

    // Comando extendido (si el firmware soporta guardar el código):
    // Ej: PLUSET;PLU;NOMBRE;PRECIO_CENT;TARA_G;BARCODE
    const fields = [plu, name, price, tare];
    if (code) fields.push(code);

    const buf = composeKretzCommand("PLUSET", fields);
    const res = await this._send(buf);
    return parseAck(res);
  }

  async deletePLU(plu) {
    if (!plu) throw new Error("PLU requerido.");
    const buf = composeKretzCommand("PLUDEL", [plu]);
    const res = await this._send(buf);
    return parseAck(res);
  }

  async syncAll(items = []) {
    if (!Array.isArray(items) || !items.length) throw new Error("No hay PLUs.");
    let ok = 0, fail = 0;
    for (const it of items) {
      try {
        await this.upsertPLU(it);
        ok++;
        await new Promise(r => setTimeout(r, 60));
      } catch {
        fail++;
      }
    }
    return `Sincronización completada. OK: ${ok}, Fallos: ${fail}`;
  }
}

async function getScaleManager(models) {
  if (!_instance) _instance = new ScaleManager(models);
  return _instance;
}

module.exports = { getScaleManager };
