"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("LocalDevices", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      // Clave estable por equipo (ej: machineId, uuid generado y persistido en userData)
      device_key: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      // Nombre amigable (editable)
      name: { type: Sequelize.STRING(128), allowNull: true },
      // Datos opcionales para diagnóstico
      platform: { type: Sequelize.STRING(64), allowNull: true },
      arch: { type: Sequelize.STRING(32), allowNull: true },
      last_seen_at: { type: Sequelize.DATE, allowNull: true },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("CURRENT_TIMESTAMP") },
    });
    await queryInterface.addIndex("LocalDevices", ["device_key"], { unique: true, name: "idx_localdevices_device_key" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("LocalDevices");
  },
};
