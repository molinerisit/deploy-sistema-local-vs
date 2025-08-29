// src/migrations/migrator.js
const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');

/**
 * Corre todas las migraciones pendientes usando el mismo Sequelize de la app.
 * Debe llamarse ANTES de sequelize.sync(...)
 */
async function runMigrations(sequelize) {
  const umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, './*.js'),
      // Pasamos queryInterface como "context" para usarlo en las migraciones
      resolve: ({ name, path: filepath, context }) => {
        const migration = require(filepath);
        return {
          name,
          up:   async () => migration.up(context, sequelize),
          down: async () => migration.down(context, sequelize),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  await umzug.up();
  console.log('✅ Migraciones aplicadas');
}

module.exports = { runMigrations };
