require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function runMigrations() {
  const client = await db.getClient();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Get already executed migrations
    const { rows: executed } = await client.query('SELECT name FROM migrations');
    const executedNames = executed.map(r => r.name);

    // Run pending migrations
    for (const file of files) {
      if (!executedNames.includes(file)) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Migration ${file} completed successfully`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    }

    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigrations();
