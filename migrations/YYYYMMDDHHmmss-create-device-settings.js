"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DeviceSettings", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      device_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "LocalDevices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      key: { type: Sequelize.STRING(128), allowNull: false },   // ej: selected_mp_token_id
      value: { type: Sequelize.TEXT, allowNull: true },         // guarda string/JSON

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("DeviceSettings", ["device_id", "key"], {
      unique: true,
      name: "ux_devicesettings_device_key",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("DeviceSettings");
  },
};
