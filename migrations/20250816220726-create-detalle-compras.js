'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('detalle_compras', {
      id: { // Es buena práctica tener un ID, aunque no esté en el modelo
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      cantidad: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      precioUnitario: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      subtotal: {
        type: Sequelize.FLOAT,
        allowNull: false
      }
      // Las claves foráneas (CompraId, ProductoId) se añadirán en otra migración
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('detalle_compras');
  }
};