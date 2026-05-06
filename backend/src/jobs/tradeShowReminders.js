const TradeShow = require('../models/TradeShow');
const { notify } = require('../utils/notificationService');

/**
 * Find every trade show to-do whose reminder window has hit and fire
 * an in-app + email notification to the assignee. Stamps reminder_sent_at
 * so each reminder fires at most once.
 *
 * Falls back to the trade show coordinator (then sales lead) when the to-do
 * has no assignee.
 */
async function runTradeShowReminders() {
  try {
    const pending = await TradeShow.findPendingReminders(new Date());
    if (pending.length === 0) return;

    console.log(`[Cron] Firing ${pending.length} trade show reminder(s)`);

    for (const todo of pending) {
      const targetUserId =
        todo.assigned_to_user_id ||
        todo.coordinator_id ||
        todo.sales_lead_id ||
        todo.created_by;

      if (!targetUserId) {
        // Nothing we can do; mark as sent so we don't keep retrying.
        await TradeShow.markReminderSent(todo.id);
        continue;
      }

      const dueParts = [todo.due_date, todo.due_time].filter(Boolean).join(' ');

      await notify({
        tenantId: todo.tenant_id,
        projectId: null,
        entityType: 'trade_show_todo',
        entityId: todo.id,
        eventType: 'reminder',
        title: `Reminder: ${todo.title}`,
        message: `Reminder for "${todo.title}" — ${todo.trade_show_name}`,
        link: `/marketing/trade-shows/${todo.trade_show_id}`,
        createdBy: todo.created_by,
        emailSubject: `Reminder: ${todo.title}`,
        emailDetails: [
          { label: 'Trade Show', value: todo.trade_show_name },
          { label: 'Task', value: todo.title },
          { label: 'Priority', value: todo.priority },
          ...(dueParts ? [{ label: 'Due', value: dueParts }] : []),
          ...(todo.description ? [{ label: 'Details', value: todo.description }] : []),
        ],
        targetUserId,
        contextName: `Trade Show: ${todo.trade_show_name}`,
      });

      await TradeShow.markReminderSent(todo.id);
    }
  } catch (err) {
    console.error('[Cron] Trade show reminder job failed:', err);
  }
}

module.exports = { runTradeShowReminders };
