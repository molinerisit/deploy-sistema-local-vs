'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('movimientos_cuenta_corriente', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      fecha: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      tipo: {
        type: Sequelize.ENUM('DEBITO', 'CREDITO'),
        allowNull: false
      },
      monto: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      concepto: {
        type: Sequelize.STRING
      },
      saldoAnterior: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      saldoNuevo: {
        type: Sequelize.FLOAT,
        allowNull: false
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
    await queryInterface.dropTable('movimientos_cuenta_corriente');
  }
};