require('dotenv').config();
const fs = require('fs');
const db = require('./src/config/database');

/**
 * Backup Production Database
 * Exports all critical data to a migration file that can restore the database
 */
async function backupDatabase() {
  const client = await db.getClient();

  try {
    console.log('📦 Starting database backup...\n');

    // Tables to backup in dependency order
    const tables = [
      'users',
      'office_locations',
      'departments',
      'employees',
      'customers',
      'vendors',
      'companies',
      'projects',
      'feedback',
      'feedback_comments',
      'feedback_votes',
      'contract_reviews',
      'contract_risk_findings',
      'contract_annotations',
    ];

    // Tables with circular dependencies that need special handling
    const circularDependencyTables = {
      'departments': { column: 'manager_id', referencesTable: 'employees' }
    };

    let migrationSql = `-- Auto-generated production data restore
-- Generated: ${new Date().toISOString()}
-- This migration restores production data if the database is wiped

`;

    const deferredUpdates = [];

    for (const table of tables) {
      console.log(`Backing up table: ${table}`);

      // Check if table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table]);

      if (!tableCheck.rows[0].exists) {
        console.log(`  ⚠️  Table ${table} does not exist, skipping`);
        continue;
      }

      // Get all data from table
      const result = await client.query(`SELECT * FROM ${table}`);

      if (result.rows.length === 0) {
        console.log(`  ℹ️  Table ${table} is empty, skipping`);
        continue;
      }

      console.log(`  ✓ Found ${result.rows.length} rows`);

      // Get column names
      let columns = Object.keys(result.rows[0]);
      const circularDep = circularDependencyTables[table];

      // For tables with circular dependencies, exclude the circular column initially
      const excludedColumn = circularDep ? circularDep.column : null;
      const insertColumns = excludedColumn ? columns.filter(c => c !== excludedColumn) : columns;

      migrationSql += `\n-- Restore ${table} (${result.rows.length} rows)\n`;
      migrationSql += `INSERT INTO ${table} (${insertColumns.join(', ')})\nVALUES\n`;

      const valueRows = result.rows.map(row => {
        const values = insertColumns.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          // Escape single quotes in strings
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        return `  (${values.join(', ')})`;
      });

      migrationSql += valueRows.join(',\n');
      migrationSql += '\nON CONFLICT (id) DO UPDATE SET\n';

      const updateClauses = insertColumns
        .filter(col => col !== 'id')
        .map(col => `  ${col} = EXCLUDED.${col}`);

      migrationSql += updateClauses.join(',\n');
      migrationSql += ';\n';

      // Update sequence
      migrationSql += `SELECT setval('${table}_id_seq', (SELECT MAX(id) FROM ${table}));\n`;

      // If this table has a circular dependency, save updates for later
      if (excludedColumn) {
        const updates = result.rows
          .filter(row => row[excludedColumn] !== null)
          .map(row => `UPDATE ${table} SET ${excludedColumn} = ${row[excludedColumn]} WHERE id = ${row.id};`);
        if (updates.length > 0) {
          deferredUpdates.push({
            table,
            column: excludedColumn,
            afterTable: circularDep.referencesTable,
            updates
          });
        }
      }
    }

    // Add deferred updates after all tables
    if (deferredUpdates.length > 0) {
      migrationSql += `\n-- Deferred updates for circular dependencies\n`;
      for (const deferred of deferredUpdates) {
        migrationSql += `\n-- Update ${deferred.table}.${deferred.column} (after ${deferred.afterTable} was inserted)\n`;
        migrationSql += deferred.updates.join('\n') + '\n';
      }
    }

    // Write to migration file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `src/migrations/024_backup_${timestamp}.sql`;

    fs.writeFileSync(filename, migrationSql);

    console.log(`\n✅ Backup complete!`);
    console.log(`📁 Written to: ${filename}`);
    console.log(`\nThis migration will restore your data if the database is wiped.`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

backupDatabase();
