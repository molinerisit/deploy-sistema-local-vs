'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('productos', {
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
        defaultValue: 0
      },
      unidad: {
        type: Sequelize.STRING,
        defaultValue: 'unidad'
      },
      precioCompra: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      precioVenta: {
        type: Sequelize.FLOAT,
        defaultValue: 0
      },
      codigo_barras: {
        type: Sequelize.STRING,
        unique: true
      },
      imagen_url: {
        type: Sequelize.STRING
      },
      precio_oferta: {
        type: Sequelize.FLOAT
      },
      fecha_fin_oferta: {
        type: Sequelize.DATEONLY
      },
      fecha_vencimiento: {
        type: Sequelize.DATEONLY
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      DepartamentoId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      FamiliaId: {
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
    await queryInterface.dropTable('productos');
  }
};