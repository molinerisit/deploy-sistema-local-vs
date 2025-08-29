// src/migrations/0002-create-subscriptions.js
/**
 * Crea la tabla Subscriptions para cachear estado de licencia localmente.
 */
module.exports.up = async (queryInterface, sequelize) => {
  const { INTEGER, STRING, JSON, DATE, INTEGER: INT } = sequelize.Sequelize;

  // Si ya existe, no hacemos nada
  const exists = await queryInterface
    .describeTable('Subscriptions')
    .then(() => true)
    .catch(() => false);

  if (exists) return;

  await queryInterface.createTable('Subscriptions', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    license_key: { type: STRING, allowNull: false },

    plan: { type: STRING },
    status: { type: STRING, defaultValue: 'inactive' },
    expires_at: { type: DATE },
    days_left: { type: INT, defaultValue: 0 },
    features: { type: JSON, defaultValue: {} },

    last_checked_at: { type: DATE },
    last_sync_at: { type: DATE },

    cloud_tenant_id: { type: STRING },
    mp_preapproval_id: { type: STRING },

    createdAt: { type: DATE, allowNull: false, defaultValue: sequelize.fn('datetime', 'now') },
    updatedAt: { type: DATE, allowNull: false, defaultValue: sequelize.fn('datetime', 'now') }
  });

  // índices útiles
  try { await queryInterface.addIndex('Subscriptions', ['cloud_tenant_id'], { name: 'idx_subs_tenant' }); } catch {}
  try { await queryInterface.addIndex('Subscriptions', ['status'], { name: 'idx_subs_status' }); } catch {}
};

module.exports.down = async (queryInterface) => {
  try { await queryInterface.dropTable('Subscriptions'); } catch {}
};
