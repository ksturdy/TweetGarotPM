const db = require('../config/database');
const { notify } = require('../utils/notificationService');

const EXCLUDED_STAGE_NAMES = ['Awarded', 'Lost', 'Passed'];
const DEDUP_DAYS = 7; // re-notify weekly until the start date is updated

async function runStaleOpportunityStartDate() {
  const result = await db.query(
    `SELECT
       o.id,
       o.title,
       o.tenant_id,
       o.created_by,
       COALESCE(o.user_adjusted_start_date, o.estimated_start_date) AS effective_start_date,
       ps.name AS stage_name,
       u.id   AS assignee_user_id
     FROM opportunities o
     JOIN pipeline_stages ps ON ps.id = o.stage_id
     LEFT JOIN employees e ON e.id = o.assigned_to
     LEFT JOIN users u ON u.id = e.user_id AND u.is_active = true
     WHERE o.tenant_id IS NOT NULL
       AND ps.name NOT IN (${EXCLUDED_STAGE_NAMES.map((_, i) => `$${i + 1}`).join(', ')})
       AND COALESCE(o.user_adjusted_start_date, o.estimated_start_date) < CURRENT_DATE
       -- exclude if we already sent this notification within the dedup window
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.entity_type = 'opportunity'
           AND n.entity_id = o.id
           AND n.event_type = 'stale_start_date'
           AND n.created_at >= NOW() - ($${EXCLUDED_STAGE_NAMES.length + 1} * INTERVAL '1 day')
       )`,
    [...EXCLUDED_STAGE_NAMES, DEDUP_DAYS]
  );

  if (result.rows.length === 0) return;
  console.log(`[Cron] Sending ${result.rows.length} stale start date notification(s)`);

  for (const opp of result.rows) {
    const targetUserId = opp.assignee_user_id || opp.created_by;
    if (!targetUserId) continue;

    const startDate = new Date(opp.effective_start_date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });

    await notify({
      tenantId: opp.tenant_id,
      projectId: null,
      entityType: 'opportunity',
      entityId: opp.id,
      eventType: 'stale_start_date',
      title: `Start date needs updating: ${opp.title}`,
      message: `Start date (${startDate}) has passed — please update the projected start date`,
      link: `/sales?opportunityId=${opp.id}`,
      createdBy: targetUserId,
      emailSubject: `Action needed: update start date for "${opp.title}"`,
      emailDetails: [
        { label: 'Opportunity', value: opp.title },
        { label: 'Stage', value: opp.stage_name },
        { label: 'Start Date', value: startDate },
        { label: 'Action', value: 'Please open the opportunity and update the projected start date' },
      ],
      targetUserId,
      contextName: 'Sales Pipeline',
    });
  }
}

module.exports = { runStaleOpportunityStartDate };
