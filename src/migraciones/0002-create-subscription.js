// 0002-create-subscription.js
const { DataTypes } = require("sequelize");

module.exports.up = async (sequelize, qi) => {
  const table = "Subscriptions";
  const exists = await qi.describeTable(table).then(() => true).catch(() => false);
  if (!exists) {
    await qi.createTable(table, {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      license_key: { type: DataTypes.STRING, allowNull: false, unique: true },
      plan: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: true },
      days_left: { type: DataTypes.INTEGER, allowNull: true },
      features: { type: DataTypes.JSON, allowNull: true },
      last_checked_at: { type: DataTypes.DATE, allowNull: true },
      last_sync_at: { type: DataTypes.DATE, allowNull: true },
      cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
      mp_preapproval_id: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal("CURRENT_TIMESTAMP") },
    });
  }
};
