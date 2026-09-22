const OpportunityReminder = require('../models/OpportunityReminder');
const { notify } = require('../utils/notificationService');

const RECURRENCE_LABELS = {
  7: 'weekly',
  14: 'every 2 weeks',
  30: 'monthly',
  90: 'every 3 months',
  180: 'every 6 months',
};

async function runOpportunityReminders() {
  const pending = await OpportunityReminder.findPending(new Date());
  if (pending.length === 0) return;

  console.log(`[Cron] Firing ${pending.length} opportunity reminder(s)`);

  for (const r of pending) {
    const recurrenceLabel = r.recurrence_days
      ? ` · Repeats ${RECURRENCE_LABELS[r.recurrence_days] || `every ${r.recurrence_days} days`}`
      : '';

    await notify({
      tenantId: r.tenant_id,
      projectId: null,
      entityType: 'opportunity',
      entityId: r.opportunity_id,
      eventType: 'reminder',
      title: `Reminder: ${r.opportunity_title}`,
      message: r.note
        ? `${r.note}${recurrenceLabel}`
        : `Follow-up reminder for "${r.opportunity_title}"${recurrenceLabel}`,
      link: '/sales',
      createdBy: r.user_id,
      emailSubject: `Reminder: ${r.opportunity_title}`,
      emailDetails: [
        { label: 'Opportunity', value: r.opportunity_title },
        ...(r.note ? [{ label: 'Note', value: r.note }] : []),
        ...(r.recurrence_days ? [{ label: 'Recurrence', value: RECURRENCE_LABELS[r.recurrence_days] || `every ${r.recurrence_days} days` }] : []),
      ],
      targetUserId: r.user_id,
      contextName: 'Sales Pipeline',
    });

    await OpportunityReminder.markFired(r.id, r.recurrence_days);
  }
}

module.exports = { runOpportunityReminders };
