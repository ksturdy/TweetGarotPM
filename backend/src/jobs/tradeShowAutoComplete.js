const db = require('../config/database');

/**
 * Auto-transitions trade shows whose end date has passed to 'completed'.
 * Only affects shows currently in upcoming / registered / in_progress.
 * Runs nightly via cron.
 */
async function runTradeShowAutoComplete() {
  const result = await db.query(`
    UPDATE trade_shows
    SET status = 'completed', updated_at = NOW()
    WHERE status IN ('upcoming', 'registered', 'in_progress')
      AND event_end_date IS NOT NULL
      AND event_end_date < CURRENT_DATE
    RETURNING id, name, tenant_id
  `);

  if (result.rows.length > 0) {
    console.log(`[Cron] Auto-completed ${result.rows.length} trade show(s):`,
      result.rows.map(r => `#${r.id} ${r.name}`).join(', '));
  }
}

module.exports = { runTradeShowAutoComplete };
