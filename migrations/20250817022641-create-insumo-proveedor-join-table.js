'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('insumo_proveedor', {
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
      InsumoId: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        references: {
          model: 'insumos', // Nombre de la tabla de insumos
          key: 'id'
        },
        onDelete: 'CASCADE'
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('insumo_proveedor');
  }
};