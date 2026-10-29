const db = require('../config/database');

const DrawingIssuePin = {
  async getNextPinNumber(drawingId, pageNumber) {
    const result = await db.query(
      `SELECT COALESCE(MAX(pin_number), 0) + 1 AS next
       FROM drawing_issue_pins
       WHERE drawing_id = $1 AND page_number = $2`,
      [drawingId, pageNumber]
    );
    return result.rows[0].next;
  },

  async create({ tenantId, drawingId, pageNumber, x, y, pinNumber, fieldIssueId, createdBy }) {
    const result = await db.query(
      `INSERT INTO drawing_issue_pins
         (tenant_id, drawing_id, page_number, x, y, pin_number, field_issue_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, drawingId, pageNumber, x, y, pinNumber, fieldIssueId || null, createdBy]
    );
    return result.rows[0];
  },

  async findByDrawingPage(drawingId, pageNumber) {
    const result = await db.query(
      `SELECT p.*,
              i.title   AS issue_title,
              i.status  AS issue_status,
              i.priority AS issue_priority
       FROM drawing_issue_pins p
       LEFT JOIN field_issues i ON p.field_issue_id = i.id
       WHERE p.drawing_id = $1 AND p.page_number = $2
       ORDER BY p.pin_number`,
      [drawingId, pageNumber]
    );
    return result.rows;
  },

  async update(id, tenantId, updates) {
    const allowed = ['x', 'y', 'field_issue_id'];
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE drawing_issue_pins SET ${fields.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    await db.query(
      'DELETE FROM drawing_issue_pins WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  },
};

module.exports = DrawingIssuePin;
