'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('producto_proveedor', {
      // Sequelize añade createdAt y updatedAt por defecto
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      ProveedorId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'proveedores', // Nombre de la tabla de proveedores
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      ProductoId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'productos', // Nombre de la tabla de productos
          key: 'id'
        },
        onDelete: 'CASCADE'
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('producto_proveedor');
  }
};