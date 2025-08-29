'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('insumos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      stock: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      unidad: {
        type: Sequelize.STRING
      },
      ultimoPrecioCompra: {
        type: Sequelize.FLOAT
      },
      InsumoDepartamentoId: {
        type: Sequelize.INTEGER,
        allowNull: true
        // references: { model: 'insumo_departamentos', key: 'id' } // Se añade después
      },
      InsumoFamiliaId: {
        type: Sequelize.INTEGER,
        allowNull: true
        // references: { model: 'insumo_familias', key: 'id' } // Se añade después
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('insumos');
  }
};