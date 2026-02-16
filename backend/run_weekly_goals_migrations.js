require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

async function runWeeklyGoalsMigrations() {
  try {
    console.log('🔗 Connecting to production database...');
    
    // Only run the weekly goals related migrations
    const migrationsToRun = [
      '086_create_weekly_goal_plans.sql',
      '087_create_weekly_goal_tasks.sql',
      '088_add_email_distribution_list.sql',
      '089_add_rescheduled_to_incomplete_reason.sql',
      '089_create_daily_trade_actuals.sql'
    ];

    const migrationsDir = path.join(__dirname, 'src', 'migrations');

    for (const file of migrationsToRun) {
      const filePath = path.join(migrationsDir, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${file} (file not found)`);
        continue;
      }

      console.log(`\n🔄 Running migration: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await db.query(sql);
        console.log(`✅ Migration ${file} completed successfully`);
      } catch (error) {
        if (error.code === '42P07') {
          console.log(`⚠️  Migration ${file} - table/index already exists, continuing...`);
        } else {
          console.error(`❌ Error running migration ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✅ All weekly goals migrations completed!');
    await db.end();
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runWeeklyGoalsMigrations();
