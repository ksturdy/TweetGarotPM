/**
 * One-shot script to fire a sample opportunity reminder email.
 * Usage: node scripts/testOpportunityReminder.js <opportunityId> <userId>
 *
 * Example: node scripts/testOpportunityReminder.js 42 1
 *
 * This inserts a past-due reminder for the given opportunity/user, runs the
 * cron job function once, then removes the test row.
 */
require('dotenv').config();
const db = require('../src/config/database');
const { runOpportunityReminders } = require('../src/jobs/opportunityReminders');

async function main() {
  const opportunityId = parseInt(process.argv[2], 10);
  const userId = parseInt(process.argv[3], 10);

  if (!opportunityId || !userId) {
    console.error('Usage: node scripts/testOpportunityReminder.js <opportunityId> <userId>');
    process.exit(1);
  }

  // Get tenant_id from the opportunity
  const oppResult = await db.query(
    'SELECT tenant_id, title FROM opportunities WHERE id = $1',
    [opportunityId]
  );
  if (!oppResult.rows[0]) {
    console.error(`Opportunity ${opportunityId} not found`);
    process.exit(1);
  }
  const { tenant_id, title } = oppResult.rows[0];
  console.log(`Firing test reminder for "${title}" (opp ${opportunityId}) → user ${userId}`);

  // Insert a past-due one-shot reminder
  const inserted = await db.query(
    `INSERT INTO opportunity_reminders (tenant_id, opportunity_id, user_id, remind_at, note)
     VALUES ($1, $2, $3, NOW() - INTERVAL '1 minute', 'Test reminder — this is a sample')
     RETURNING id`,
    [tenant_id, opportunityId, userId]
  );
  const reminderId = inserted.rows[0].id;

  // Run the job
  await runOpportunityReminders();

  // Clean up
  await db.query('DELETE FROM opportunity_reminders WHERE id = $1', [reminderId]);
  console.log('Done. Check the notification bell and inbox for the reminder email.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
