'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Usamos una transacción para asegurar que todos los cambios se apliquen o ninguno.
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('Usuario', 'sync_enabled', {
        type: Sequelize.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }, { transaction });
      
      await queryInterface.addColumn('Usuario', 'sync_api_url', {
        type: Sequelize.DataTypes.STRING,
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('Usuario', 'license_key', {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        // Importante: No podemos usar defaultValue UUIDV4 aquí directamente.
        // Sequelize lo manejará a nivel de modelo, la base de datos tendrá un valor único por registro.
        // Para SQLite, el modelo se encargará de generar el UUID al crear un nuevo usuario.
      }, { transaction });
      
      await queryInterface.addColumn('Usuario', 'subscription_status', {
        type: Sequelize.DataTypes.JSON,
        allowNull: true
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('Usuario', 'sync_enabled', { transaction });
      await queryInterface.removeColumn('Usuario', 'sync_api_url', { transaction });
      await queryInterface.removeColumn('Usuario', 'license_key', { transaction });
      await queryInterface.removeColumn('Usuario', 'subscription_status', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};