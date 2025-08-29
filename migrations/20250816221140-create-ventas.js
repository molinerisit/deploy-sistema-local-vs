'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ventas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      metodoPago: {
        type: Sequelize.STRING,
        allowNull: false
      },
      total: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      montoPagado: {
        type: Sequelize.FLOAT
      },
      vuelto: {
        type: Sequelize.FLOAT
      },
      recargo: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      montoDescuento: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      // ✅ CORRECCIÓN: Se define la columna, pero sin la restricción 'references'
      // para evitar el error de que la tabla 'clientes' no exista todavía.
      ClienteId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      dniCliente: {
        type: Sequelize.STRING
      },
      facturada: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      // ✅ CORRECCIÓN: Se define la columna, pero sin la restricción 'references'
      // para evitar el error de que la tabla 'Usuario' no exista todavía.
      UsuarioId: {
        type: Sequelize.INTEGER,
        allowNull: true
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
    await queryInterface.dropTable('ventas');
  }
};