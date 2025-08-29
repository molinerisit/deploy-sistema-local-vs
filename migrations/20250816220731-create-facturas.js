'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('facturas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      cae: {
        type: Sequelize.STRING,
        allowNull: false
      },
      caeVto: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      tipoComp: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      ptoVta: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      nroComp: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      docTipo: {
        type: Sequelize.INTEGER
      },
      docNro: {
        type: Sequelize.STRING
      },
      impTotal: {
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
      // La clave foránea VentaId se añadirá en otra migración
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('facturas');
  }
};