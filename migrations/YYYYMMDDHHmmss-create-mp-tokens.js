"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MPTokens", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },

      // Relación con el tenant/nube (si la tenés desde Subscription.status.cloudTenantId)
      cloud_tenant_id: { type: Sequelize.STRING(64), allowNull: true },

      // Datos de la credencial
      label: { type: Sequelize.STRING(128), allowNull: true }, // ej: "Caja Mostrador"
      access_token: { type: Sequelize.TEXT, allowNull: false }, // almacénalo cifrado si querés
      mp_user_id: { type: Sequelize.STRING(64), allowNull: true },
      mp_pos_id: { type: Sequelize.STRING(64), allowNull: true },

      // Auditoría opcional: quién lo creó
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

    await queryInterface.addIndex("MPTokens", ["cloud_tenant_id"], { name: "idx_mptokens_tenant" });
    await queryInterface.addIndex("MPTokens", ["is_active"], { name: "idx_mptokens_active" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MPTokens");
  },
};
