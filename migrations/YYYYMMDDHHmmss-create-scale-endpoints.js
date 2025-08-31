"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ScaleEndpoints", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      cloud_tenant_id: { type: Sequelize.STRING(64), allowNull: true }, // opcional
      label: { type: Sequelize.STRING(128), allowNull: true },

      transport: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "tcp" }, // tcp | bt
      ip: { type: Sequelize.STRING(64), allowNull: true },
      port: { type: Sequelize.INTEGER, allowNull: true },
      bt_address: { type: Sequelize.STRING(64), allowNull: true },
      protocol: { type: Sequelize.STRING(32), allowNull: false, defaultValue: "kretz-report" },
      timeout_ms: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 4000 },

      // Auditoría opcional
      created_by_device_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "LocalDevices", key: "id" },
        onUpdate: "SET NULL",
        onDelete: "SET NULL",
      },

      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("ScaleEndpoints", ["cloud_tenant_id"], { name: "idx_scale_tenant" });
    await queryInterface.addIndex("ScaleEndpoints", ["is_active"], { name: "idx_scale_active" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ScaleEndpoints");
  },
};
