'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proveedores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombreEmpresa: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      nombreRepartidor: {
        type: Sequelize.STRING
      },
      tipo: {
        type: Sequelize.ENUM('producto', 'insumos', 'ambos'),
        allowNull: false,
        defaultValue: 'producto'
      },
      telefono: {
        type: Sequelize.STRING
      },
      diasReparto: {
        type: Sequelize.STRING
      },
      deuda: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0
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
    await queryInterface.dropTable('proveedores');
  }
};