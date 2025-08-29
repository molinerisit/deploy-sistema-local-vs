// src/migrations/0003-unique-indexes.js
/**
 * Agrega índices únicos compuestos para evitar duplicados por “nombre” dentro de su padre.
 * - producto_familias(DepartamentoId, nombre)
 * - insumo_familias(InsumoDepartamentoId, nombre)
 */
module.exports.up = async (queryInterface) => {
  try {
    await queryInterface.addIndex(
      'producto_familias',
      ['DepartamentoId', 'nombre'],
      { unique: true, name: 'uq_prod_familias_depto_nombre' }
    );
  } catch {}

  try {
    await queryInterface.addIndex(
      'insumo_familias',
      ['InsumoDepartamentoId', 'nombre'],
      { unique: true, name: 'uq_insumo_familias_depto_nombre' }
    );
  } catch {}
};

module.exports.down = async (queryInterface) => {
  try { await queryInterface.removeIndex('producto_familias', 'uq_prod_familias_depto_nombre'); } catch {}
  try { await queryInterface.removeIndex('insumo_familias',  'uq_insumo_familias_depto_nombre'); } catch {}
};
