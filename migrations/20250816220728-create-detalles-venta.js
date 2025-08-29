'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('detalles_venta', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombreProducto: {
        type: Sequelize.STRING,
        allowNull: false
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
      // Las claves foráneas (VentaId, ProductoId) se añadirán en otra migración
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('detalles_venta');
  }
};