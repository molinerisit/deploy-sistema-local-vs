// src/migrations/0001-add-sync-columns.js
/**
 * Agrega columnas de sincronización y algunos índices base.
 * Tablas: insumo_familias, movimientos_cuenta_corriente, productos,
 * producto_departamentos, producto_familias, proveedores, ventas
 */
async function ensureColumn(q, table, colName, desc, colDef) {
  if (!desc[colName]) {
    await q.addColumn(table, colName, colDef);
  }
}

async function ensureIndex(q, table, fields, options = {}) {
  // nombre determinístico del índice
  const name = options.name || (`idx_${table}_${fields.join('_')}`).slice(0, 62);
  // sqlite no devuelve lista de índices fácil con qi, así que intentamos crear y si existe, ignoramos
  try {
    await q.addIndex(table, { fields, name, unique: !!options.unique });
  } catch (e) {
    // si ya existe, ignoramos
  }
}

const TABLES = [
  'insumo_familias',
  'movimientos_cuenta_corriente',
  'productos',
  'producto_departamentos',
  'producto_familias',
  'proveedores',
  'ventas',
];

module.exports.up = async (queryInterface, sequelize) => {
  const { STRING, BOOLEAN } = sequelize.Sequelize;

  for (const table of TABLES) {
    const desc = await queryInterface.describeTable(table).catch(() => ({}));

    await ensureColumn(queryInterface, table, 'cloud_tenant_id', desc, { type: STRING, allowNull: true });
    await ensureColumn(queryInterface, table, 'cloud_id',        desc, { type: STRING, allowNull: true });
    await ensureColumn(queryInterface, table, 'dirty',           desc, { type: BOOLEAN, allowNull: false, defaultValue: false });

    await ensureIndex(queryInterface, table, ['cloud_tenant_id']);
    await ensureIndex(queryInterface, table, ['updatedAt']); // útil para ordenamiento por cambios
    await ensureIndex(queryInterface, table, ['dirty']);
  }
};

module.exports.down = async (queryInterface, sequelize) => {
  for (const table of TABLES) {
    // borrar índices (best effort)
    for (const f of ['cloud_tenant_id', 'updatedAt', 'dirty']) {
      const name = `idx_${table}_${f}`;
      try { await queryInterface.removeIndex(table, name); } catch {}
    }
    // borrar columnas (best effort)
    for (const c of ['cloud_tenant_id', 'cloud_id', 'dirty']) {
      try { await queryInterface.removeColumn(table, c); } catch {}
    }
  }
};
