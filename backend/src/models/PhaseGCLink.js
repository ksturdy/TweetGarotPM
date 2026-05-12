const db = require('../config/database');

const PhaseGCLink = {
  async getActiveVersionId(projectId, tenantId) {
    const result = await db.query(
      `SELECT id FROM gc_schedule_versions
       WHERE tenant_id = $1 AND project_id = $2 AND parse_status = 'completed'
       ORDER BY uploaded_at DESC LIMIT 1`,
      [tenantId, projectId]
    );
    return result.rows[0]?.id || null;
  },

  async getItemTenant(itemId) {
    const result = await db.query(
      `SELECT tenant_id, project_id FROM phase_schedule_items WHERE id = $1`,
      [itemId]
    );
    return result.rows[0] || null;
  },

  async listForItem(itemId, tenantId) {
    const result = await db.query(
      `SELECT id, project_id, schedule_item_id, gc_activity_id, link_type, notes, created_by, created_at
       FROM phase_code_activity_links
       WHERE schedule_item_id = $1 AND tenant_id = $2
       ORDER BY gc_activity_id`,
      [itemId, tenantId]
    );
    return result.rows;
  },

  async hasAnyLinks(itemId, tenantId) {
    const result = await db.query(
      `SELECT 1 FROM phase_code_activity_links WHERE schedule_item_id = $1 AND tenant_id = $2 LIMIT 1`,
      [itemId, tenantId]
    );
    return result.rowCount > 0;
  },

  // Replaces the full link set for a phase item. Atomic: wipe + reinsert in a transaction.
  // gcActivityIds: array of strings (gc_schedule_activities.activity_id text values).
  async replaceForItem({ itemId, projectId, tenantId, gcActivityIds, userId }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM phase_code_activity_links WHERE schedule_item_id = $1 AND tenant_id = $2`,
        [itemId, tenantId]
      );
      const inserted = [];
      const unique = Array.from(new Set((gcActivityIds || []).filter((s) => typeof s === 'string' && s.trim().length > 0)));
      for (const activityId of unique) {
        const r = await client.query(
          `INSERT INTO phase_code_activity_links
             (tenant_id, project_id, schedule_item_id, gc_activity_id, link_type, created_by)
           VALUES ($1, $2, $3, $4, 'manual', $5)
           RETURNING id, gc_activity_id`,
          [tenantId, projectId, itemId, activityId, userId || null]
        );
        inserted.push(r.rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async addOne({ itemId, projectId, tenantId, gcActivityId, userId }) {
    const result = await db.query(
      `INSERT INTO phase_code_activity_links
         (tenant_id, project_id, schedule_item_id, gc_activity_id, link_type, created_by)
       VALUES ($1, $2, $3, $4, 'manual', $5)
       ON CONFLICT (project_id, schedule_item_id, gc_activity_id) DO NOTHING
       RETURNING id, gc_activity_id`,
      [tenantId, projectId, itemId, gcActivityId, userId || null]
    );
    return result.rows[0] || null;
  },

  async removeOne({ itemId, tenantId, gcActivityId }) {
    const result = await db.query(
      `DELETE FROM phase_code_activity_links
       WHERE schedule_item_id = $1 AND tenant_id = $2 AND gc_activity_id = $3
       RETURNING id`,
      [itemId, tenantId, gcActivityId]
    );
    return result.rowCount > 0;
  },
};

module.exports = PhaseGCLink;
