'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('arqueos_caja', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      fechaApertura: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      montoInicial: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      fechaCierre: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      montoFinalEstimado: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      montoFinalReal: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      diferencia: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      totalVentasEfectivo: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      totalVentasDebito: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      totalVentasCredito: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      totalVentasQR: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      observaciones: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      estado: {
        type: Sequelize.ENUM('ABIERTA', 'CERRADA'),
        defaultValue: 'ABIERTA',
      },
      UsuarioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Usuario', // Nombre de la tabla a la que hace referencia
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('arqueos_caja');
  }
};