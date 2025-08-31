// 0001-usuario-admin-config.js
const { DataTypes } = require("sequelize");

module.exports.up = async (sequelize, qi) => {
  const table = "Usuarios";
  const cols = await qi.describeTable(table).catch(() => ({}));
  const add = async (name, def) => (!cols[name] ? qi.addColumn(table, name, def) : null);

  await add("sync_enabled", { type: DataTypes.BOOLEAN, allowNull: true });
  await add("sync_api_url", { type: DataTypes.STRING, allowNull: true });
  await add("license_key", { type: DataTypes.STRING, allowNull: true });
  await add("subscription_status", { type: DataTypes.JSON, allowNull: true });

  // Mercado Pago
  await add("mp_access_token", { type: DataTypes.STRING, allowNull: true });
  await add("mp_user_id", { type: DataTypes.STRING, allowNull: true });
  await add("mp_pos_id", { type: DataTypes.STRING, allowNull: true });

  // Balanza + hardware + caja + generales
  await add("config_balanza", { type: DataTypes.JSON, allowNull: true });
  await add("config_balanza_conexion", { type: DataTypes.JSON, allowNull: true });
  await add("config_arqueo_caja", { type: DataTypes.JSON, allowNull: true });
  await add("config_recargo_credito", { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 });
  await add("config_descuento_efectivo", { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 });
  await add("config_puerto_scanner", { type: DataTypes.STRING, allowNull: true });
  await add("config_puerto_impresora", { type: DataTypes.STRING, allowNull: true });

  // Branding/negocio
  await add("logo_url", { type: DataTypes.STRING, allowNull: true });
  await add("nombre_negocio", { type: DataTypes.STRING, allowNull: true });
  await add("slogan_negocio", { type: DataTypes.STRING, allowNull: true });
  await add("footer_ticket", { type: DataTypes.STRING, allowNull: true });

  // AFIP
  await add("afip_cuit", { type: DataTypes.STRING, allowNull: true });
  await add("afip_pto_vta", { type: DataTypes.STRING, allowNull: true });
  await add("afip_cert_path", { type: DataTypes.STRING, allowNull: true });
  await add("afip_key_path", { type: DataTypes.STRING, allowNull: true });

  // Facturación toggle
  await add("facturacion_activa", { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false });

  // Permisos: asegurar JSON (si tu modelo lo define)
  if (cols.permisos && cols.permisos.type?.toLowerCase?.().includes("string")) {
    // opcional: si algún esquema viejo guardaba como TEXT
    // no hacemos conversión automática para evitar riesgos
  }

  // Índices útiles
  const indexes = await qi.showIndex(table);
  const hasIdx = (name) => indexes.some(i => i.name === name);

  if (!hasIdx("usuarios_license_key_idx")) {
    await qi.addIndex(table, ["license_key"], { name: "usuarios_license_key_idx", unique: false });
  }
};
