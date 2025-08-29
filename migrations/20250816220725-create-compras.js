'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('compras', {
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
      nroFactura: {
        type: Sequelize.STRING,
        allowNull: true
      },
      subtotal: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      descuento: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      recargo: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      total: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      metodoPago: {
        type: Sequelize.ENUM('Efectivo', 'Transferencia', 'Tarjeta', 'Cuenta Corriente'),
        allowNull: true
      },
      montoAbonado: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      estadoPago: {
        type: Sequelize.ENUM('Pagada', 'Pendiente', 'Parcial'),
        defaultValue: 'Pendiente'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
      // Las claves foráneas como ProveedorId y UsuarioId se deben añadir en migraciones separadas
      // después de crear las tablas correspondientes.
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('compras');
  }
};