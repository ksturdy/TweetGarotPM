const db = require('../config/database');

const SELECT_BASE = `
  SELECT pn.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         u.email AS created_by_email,
         a.first_name || ' ' || a.last_name AS assigned_to_name,
         a.email AS assigned_to_email,
         comp.first_name || ' ' || comp.last_name AS completed_by_name,
         ps.snapshot_date AS snapshot_date
  FROM projection_notes pn
  JOIN users u ON pn.created_by = u.id
  LEFT JOIN users a ON pn.assigned_to = a.id
  LEFT JOIN users comp ON pn.completed_by = comp.id
  LEFT JOIN project_snapshots ps ON pn.snapshot_id = ps.id
`;

const ProjectionNote = {
  async findByProject(projectId, tenantId, { type, snapshotId, includeOpenCarryover = true } = {}) {
    const params = [projectId, tenantId];
    const where = ['pn.project_id = $1', 'pn.tenant_id = $2'];

    if (type) {
      params.push(type);
      where.push(`pn.type = $${params.length}`);
    }

    if (snapshotId === null) {
      where.push('pn.snapshot_id IS NULL');
    } else if (snapshotId !== undefined) {
      params.push(snapshotId);
      if (includeOpenCarryover) {
        // Include items attached to this snapshot, plus any open task
        // (assigned_to or due_date set, status='open') from prior snapshots
        where.push(`(pn.snapshot_id = $${params.length} OR (pn.status = 'open' AND (pn.assigned_to IS NOT NULL OR pn.due_date IS NOT NULL)))`);
      } else {
        where.push(`pn.snapshot_id = $${params.length}`);
      }
    }

    const result = await db.query(
      `${SELECT_BASE} WHERE ${where.join(' AND ')} ORDER BY pn.created_at DESC`,
      params
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `${SELECT_BASE} WHERE pn.id = $1 AND pn.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async countsByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT
         COALESCE(cost_type, 0) AS cost_type,
         type,
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE type = 'homework' AND status = 'open')::int AS open_homework,
         COALESCE(SUM(amount) FILTER (WHERE type = 'gain_fade'), 0)::numeric AS net_gain_fade
       FROM projection_notes
       WHERE project_id = $1 AND tenant_id = $2
       GROUP BY cost_type, type`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  async create(data) {
    const {
      tenantId, projectId, snapshotId = null, costType = null, trade = null,
      type, body,
      category = null, groupsAffected = null,
      assignedTo = null, dueDate = null,
      amount = null, recognizedInFinancials = false, recognizedAt = null,
      createdBy,
    } = data;

    const result = await db.query(
      `INSERT INTO projection_notes (
        tenant_id, project_id, snapshot_id, cost_type, trade,
        type, body,
        category, groups_affected,
        assigned_to, due_date,
        amount, recognized_in_financials, recognized_at,
        created_by
      ) VALUES ($1,$2,$3,$4,$5, $6,$7, $8,$9, $10,$11, $12,$13,$14, $15)
      RETURNING id`,
      [
        tenantId, projectId, snapshotId, costType, trade,
        type, body,
        category, groupsAffected,
        assignedTo, dueDate,
        amount, recognizedInFinancials, recognizedAt,
        createdBy,
      ]
    );

    return this.findById(result.rows[0].id, tenantId);
  },

  async update(id, tenantId, userId, data) {
    const fields = [];
    const params = [];
    const allowed = ['body', 'cost_type', 'trade', 'assigned_to', 'due_date',
                     'amount', 'recognized_in_financials', 'recognized_at',
                     'category', 'groups_affected'];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    await db.query(
      `UPDATE projection_notes
       SET ${fields.join(', ')}
       WHERE id = $${params.length - 1} AND tenant_id = $${params.length}`,
      params
    );

    return this.findById(id, tenantId);
  },

  async setStatus(id, tenantId, userId, status) {
    const completed = status === 'done';
    await db.query(
      `UPDATE projection_notes
       SET status = $3,
           completed_at = CASE WHEN $3 = 'done' THEN NOW() ELSE NULL END,
           completed_by = CASE WHEN $3 = 'done' THEN $4 ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND type = 'note'`,
      [id, tenantId, status, completed ? userId : null]
    );
    return this.findById(id, tenantId);
  },

  async delete(id, tenantId, userId) {
    const result = await db.query(
      `DELETE FROM projection_notes
       WHERE id = $1 AND tenant_id = $2 AND created_by = $3
       RETURNING id`,
      [id, tenantId, userId]
    );
    return result.rows[0];
  },

  // Called from the snapshot capture route: attach any unattached notes
  // for this project to the newly created snapshot, so they freeze with
  // the projection cycle.
  async attachUnattachedToSnapshot(projectId, tenantId, snapshotId) {
    const result = await db.query(
      `UPDATE projection_notes
       SET snapshot_id = $3, updated_at = NOW()
       WHERE project_id = $1 AND tenant_id = $2 AND snapshot_id IS NULL
       RETURNING id`,
      [projectId, tenantId, snapshotId]
    );
    return result.rowCount;
  },
};

module.exports = ProjectionNote;
