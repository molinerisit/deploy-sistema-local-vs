// src/migrations/migrator.js
const fs = require("fs");
const path = require("path");

/**
 * Migrator súper simple basado en Sequelize.queryInterface sin tabla de meta.
 * Marca cada archivo aplicado en una tabla local "MetaMigrations".
 */
async function runMigrations(sequelize) {
  const qi = sequelize.getQueryInterface();
  const migrationsDir = path.join(__dirname);

  // 1) Meta table
  await qi.createTable?.("MetaMigrations", {
    id: { type: require("sequelize").INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: require("sequelize").STRING, unique: true },
    applied_at: { type: require("sequelize").DATE },
  }).catch(() => { /* ya existe */ });

  const applied = new Set(
    (await sequelize.query("SELECT name FROM MetaMigrations", { type: sequelize.QueryTypes.SELECT }).catch(() => []))
      .map(r => r.name)
  );

  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^\d{4}-.+\.js$/.test(f))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const full = path.join(migrationsDir, file);
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const migration = require(full);

    console.log(`[MIGRATOR] Aplicando ${file}...`);
    try {
      if (typeof migration.up === "function") {
        await migration.up(sequelize, qi);
      } else if (typeof migration === "function") {
        await migration(sequelize, qi);
      }
      await sequelize.query("INSERT INTO MetaMigrations (name, applied_at) VALUES (:n, :d)", {
        replacements: { n: file, d: new Date() },
      });
      console.log(`[MIGRATOR] ✔ ${file}`);
    } catch (e) {
      console.error(`[MIGRATOR] ❌ Falló ${file}:`, e?.message || e);
      throw e;
    }
  }
}

module.exports = { runMigrations };
