'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('insumo_familias', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      nombre: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // ✅ ESTA ES LA COLUMNA CRÍTICA QUE FALTABA
      InsumoDepartamentoId: {
        type: Sequelize.INTEGER,
        allowNull: false, // Una familia debe pertenecer a un departamento
        references: {
          model: 'insumo_departamentos', // Se conecta a la tabla que ya tienes
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE' // Si se borra un depto, se borran sus familias
      },
      // Añadimos timestamps para consistencia
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
    await queryInterface.dropTable('insumo_familias');
  }
};