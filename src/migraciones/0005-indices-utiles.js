// 0005-indices-utiles.js
module.exports.up = async (sequelize, qi) => {
  const ensureIdx = async (table, name, fields, unique = false) => {
    const indexes = await qi.showIndex(table).catch(() => []);
    if (!indexes.some(i => i.name === name)) {
      await qi.addIndex(table, fields, { name, unique });
    }
  };

  // Usuarios
  await ensureIdx("Usuarios", "usuarios_nombre_unique", ["nombre"], true);

  // Subscriptions
  await ensureIdx("Subscriptions", "subscriptions_license_unique", ["license_key"], true);
};
