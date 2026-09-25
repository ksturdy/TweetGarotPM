const db = require('../config/database');

// Format a date string or JS Date.toString() into "May 5, 2026"
function normalizeDateDisplay(val) {
  if (!val || val === '—') return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const OpportunityHistory = {
  async log({ opportunityId, tenantId, userId, eventType, summary, changes = [] }) {
    await db.query(
      `INSERT INTO opportunity_history (opportunity_id, tenant_id, user_id, event_type, summary, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opportunityId, tenantId, userId, eventType, summary, JSON.stringify(changes)]
    );
  },

  async findByOpportunity(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT h.*, u.first_name || ' ' || u.last_name AS user_name
       FROM opportunity_history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.opportunity_id = $1 AND h.tenant_id = $2
       ORDER BY h.created_at DESC`,
      [opportunityId, tenantId]
    );

    const rows = result.rows;

    // Collect any numeric stage values that were stored as raw IDs (legacy bug)
    const stageIdSet = new Set();
    for (const row of rows) {
      const changes = typeof row.changes === 'string' ? JSON.parse(row.changes) : (row.changes || []);
      for (const change of changes) {
        if (change.field === 'Stage') {
          if (/^\d+$/.test(change.old)) stageIdSet.add(Number(change.old));
          if (/^\d+$/.test(change.new)) stageIdSet.add(Number(change.new));
        }
      }
    }

    // Batch-resolve any raw stage IDs to names
    const stageMap = {};
    if (stageIdSet.size > 0) {
      const stageResult = await db.query(
        `SELECT id, name FROM pipeline_stages WHERE id = ANY($1) AND tenant_id = $2`,
        [Array.from(stageIdSet), tenantId]
      );
      stageResult.rows.forEach(s => { stageMap[s.id] = s.name; });
    }

    // Post-process each row's changes to fix legacy bad data
    for (const row of rows) {
      let changes = typeof row.changes === 'string' ? JSON.parse(row.changes) : (row.changes || []);

      changes = changes
        .map(change => {
          if (change.field === 'Stage') {
            if (/^\d+$/.test(change.old)) change.old = stageMap[Number(change.old)] || change.old;
            if (/^\d+$/.test(change.new)) change.new = stageMap[Number(change.new)] || change.new;
          }
          if (change.field === 'Start Date') {
            change.old = normalizeDateDisplay(change.old);
            change.new = normalizeDateDisplay(change.new);
          }
          return change;
        })
        .filter(change => change.old !== change.new);

      row.changes = changes;
    }

    return rows;
  },
};

module.exports = OpportunityHistory;
