'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('insumo_departamentos', {
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
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('insumo_departamentos');
  }
};