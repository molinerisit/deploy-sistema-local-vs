// licenseClient.cjs (CommonJS)
const os = require("os");
const fs = require("fs/promises");
const path = require("path");
const jwt = require("jsonwebtoken");

// URLs base (se puede override con VS_BACKEND_BASE)
function getBase() {
  return process.env.VS_BACKEND_BASE || "http://localhost:4000";
}
function publicKeyUrl() { return `${getBase()}/.well-known/venta-simple-license-pubkey`; }
function validateUrl()  { return `${getBase()}/public/license/validate`; }
function refreshUrl()   { return `${getBase()}/public/license/refresh`; }

// Paths de cache
function appDataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), ".venta-simple");
  return path.join(base, "venta-simple");
}
function pubKeyPath() { return path.join(appDataDir(), "license_public.pem"); }
function jwsPath()    { return path.join(appDataDir(), "license.jws"); }
function metaPath()   { return path.join(appDataDir(), "license.meta.json"); }

async function ensureDir() { await fs.mkdir(appDataDir(), { recursive: true }); }

async function loadPublicKey() {
  await ensureDir();
  try {
    const pem = await fs.readFile(pubKeyPath(), "utf8");
    if (pem.includes("BEGIN PUBLIC KEY")) return pem;
    throw new Error("pem corrupto");
  } catch {
    const res = await fetch(publicKeyUrl());
    if (!res.ok) throw new Error("No se pudo descargar la clave pública");
    const pem = await res.text();
    await fs.writeFile(pubKeyPath(), pem, "utf8");
    return pem;
  }
}

async function loadCachedJWS() {
  try { return await fs.readFile(jwsPath(), "utf8"); }
  catch { return null; }
}
async function saveJWS(jws, meta = {}) {
  await ensureDir();
  await fs.writeFile(jwsPath(), jws, "utf8");
  await fs.writeFile(metaPath(), JSON.stringify(meta, null, 2), "utf8");
}

function isExpiringSoon(payload, seconds = 6 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  return (payload.exp || 0) - now < seconds;
}

async function verifyOffline() {
  const pub = await loadPublicKey();
  const jws = await loadCachedJWS();
  if (!jws) return { ok: false, reason: "missing_jws" };
  try {
    const payload = jwt.verify(jws, pub, { algorithms: ["RS256"] });
    return { ok: true, payload, expSoon: isExpiringSoon(payload) };
  } catch (e) {
    return { ok: false, reason: "verify_failed", error: e?.message };
  }
}

async function validateOnline({ token, deviceId }) {
  const res = await fetch(validateUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, deviceId })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "validateOnline failed");
  await saveJWS(json.license_jws, { deviceId, ts: Date.now(), license: json.license });
  return json;
}

async function refreshOnline({ token, deviceId }) {
  const res = await fetch(refreshUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, deviceId })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "refreshOnline failed");
  await saveJWS(json.license_jws, { deviceId, ts: Date.now(), license: json.license });
  return json;
}

async function ensureLicense({ token, deviceId, online = true }) {
  const off = await verifyOffline();
  if (off.ok && !off.expSoon) {
    return { mode: "offline", payload: off.payload };
  }
  if (online) {
    try {
      if (off.ok) {
        const r = await refreshOnline({ token, deviceId });
        const payload = jwt.decode(r.license_jws);
        return { mode: "refresh", payload, license: r.license };
      } else {
        const v = await validateOnline({ token, deviceId });
        const payload = jwt.decode(v.license_jws);
        return { mode: "validate", payload, license: v.license };
      }
    } catch (e) {
      if (off.ok) return { mode: "offline-expiring", payload: off.payload, warning: e?.message };
      return { mode: "fail", error: e?.message || "sin licencia" };
    }
  } else {
    if (off.ok) return { mode: "offline", payload: off.payload };
    return { mode: "fail", error: "offline_sin_licencia" };
  }
}

module.exports = { ensureLicense, verifyOffline, refreshOnline, validateOnline };
