const db = require('../config/database');

const ScheduleItem = {
  async create({ projectId, name, description, startDate, endDate, percentComplete, parentId, assignedTo, createdBy }) {
    const result = await db.query(
      `INSERT INTO schedule_items (project_id, name, description, start_date, end_date, percent_complete, parent_id, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [projectId, name, description, startDate, endDate, percentComplete || 0, parentId, assignedTo, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT si.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as assigned_to_name
       FROM schedule_items si
       JOIN projects p ON si.project_id = p.id
       LEFT JOIN users u ON si.assigned_to = u.id
       WHERE si.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId) {
    const result = await db.query(
      `SELECT si.*, u.first_name || ' ' || u.last_name as assigned_to_name
       FROM schedule_items si
       LEFT JOIN users u ON si.assigned_to = u.id
       WHERE si.project_id = $1
       ORDER BY si.start_date, si.name`,
      [projectId]
    );
    return result.rows;
  },

  async findChildren(parentId) {
    const result = await db.query(
      `SELECT si.*, u.first_name || ' ' || u.last_name as assigned_to_name
       FROM schedule_items si
       LEFT JOIN users u ON si.assigned_to = u.id
       WHERE si.parent_id = $1
       ORDER BY si.start_date, si.name`,
      [parentId]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    values.push(id);
    const result = await db.query(
      `UPDATE schedule_items SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async updateProgress(id, percentComplete) {
    const result = await db.query(
      `UPDATE schedule_items SET percent_complete = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [percentComplete, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM schedule_items WHERE id = $1', [id]);
  },

  async getProjectProgress(projectId) {
    const result = await db.query(
      `SELECT
         COUNT(*) as total_items,
         AVG(percent_complete) as average_progress,
         COUNT(*) FILTER (WHERE percent_complete = 100) as completed_items,
         MIN(start_date) as project_start,
         MAX(end_date) as project_end
       FROM schedule_items
       WHERE project_id = $1 AND parent_id IS NULL`,
      [projectId]
    );
    return result.rows[0];
  },
};

module.exports = ScheduleItem;
