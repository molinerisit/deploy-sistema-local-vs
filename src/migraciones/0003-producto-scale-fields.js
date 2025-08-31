// 0003-producto-scale-fields.js
const { DataTypes } = require("sequelize");

module.exports.up = async (sequelize, qi) => {
  const table = "Productos";
  const cols = await qi.describeTable(table).catch(() => ({}));
  const add = async (name, def) => (!cols[name] ? qi.addColumn(table, name, def) : null);

  await add("plu", { type: DataTypes.INTEGER, allowNull: true, unique: false });
  await add("pesable", { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false });
  await add("tara", { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }); // gramos
  await add("barcode", { type: DataTypes.STRING, allowNull: true });

  // índices
  const indexes = await qi.showIndex(table);
  const ensureIdx = async (name, fields, unique=false) => {
    if (!indexes.some(i => i.name === name)) {
      await qi.addIndex(table, fields, { name, unique });
    }
  };

  await ensureIdx("productos_plu_idx", ["plu"], false);
  await ensureIdx("productos_barcode_idx", ["barcode"], false);
};
