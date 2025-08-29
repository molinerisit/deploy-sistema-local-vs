'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crea la tabla con el nombre 'Usuario'
    await queryInterface.createTable('Usuario', {
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
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rol: {
        type: Sequelize.STRING,
        allowNull: false
      },
      permisos: {
        type: Sequelize.JSON,
        allowNull: true
      },
      config_puerto_scanner: {
        type: Sequelize.STRING,
        allowNull: true
      },
      config_puerto_impresora: {
        type: Sequelize.STRING,
        allowNull: true
      },
      mp_access_token: {
        type: Sequelize.STRING,
        allowNull: true
      },
      mp_pos_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      mp_user_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      config_balanza: {
        type: Sequelize.JSON,
        allowNull: true
      },
      config_recargo_credito: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: 0
      },
      nombre_negocio: {
        type: Sequelize.STRING,
        allowNull: true
      },
      slogan_negocio: {
        type: Sequelize.STRING,
        allowNull: true
      },
      footer_ticket: {
        type: Sequelize.STRING,
        allowNull: true
      },
      logo_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      config_descuento_efectivo: {
        type: Sequelize.FLOAT,
        allowNull: true,
        defaultValue: 0
      },
      facturacion_activa: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      afip_cuit: {
        type: Sequelize.STRING,
        allowNull: true
      },
      afip_pto_vta: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      afip_cert_path: {
        type: Sequelize.STRING,
        allowNull: true
      },
      afip_key_path: {
        type: Sequelize.STRING,
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
    // Borra la tabla 'Usuario'
    await queryInterface.dropTable('Usuario');
  }
};