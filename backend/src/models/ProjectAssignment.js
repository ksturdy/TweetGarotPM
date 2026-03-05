const db = require('../config/database');

const ProjectAssignment = {
  async findByUserId(userId, tenantId) {
    const result = await db.query(
      `SELECT pa.*, p.name as project_name, p.number as project_number
       FROM project_assignments pa
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.user_id = $1 AND pa.tenant_id = $2
       ORDER BY p.name`,
      [userId, tenantId]
    );
    return result.rows;
  },

  async findByProjectId(projectId, tenantId) {
    const result = await db.query(
      `SELECT pa.*, e.first_name, e.last_name, e.email, e.user_id as emp_user_id
       FROM project_assignments pa
       JOIN employees e ON e.id = pa.employee_id
       WHERE pa.project_id = $1 AND pa.tenant_id = $2
       ORDER BY e.last_name, e.first_name`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  async getProjectIdsForUser(userId, tenantId) {
    // Look up by user_id directly OR via employee linked to user
    const result = await db.query(
      `SELECT DISTINCT pa.project_id FROM project_assignments pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       WHERE pa.tenant_id = $1
         AND (pa.user_id = $2 OR e.user_id = $2)`,
      [tenantId, userId]
    );
    return result.rows.map(r => r.project_id);
  },

  async isAssigned(userId, projectId, tenantId) {
    const result = await db.query(
      `SELECT 1 FROM project_assignments pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       WHERE pa.project_id = $1 AND pa.tenant_id = $2
         AND (pa.user_id = $3 OR e.user_id = $3)`,
      [projectId, tenantId, userId]
    );
    return result.rows.length > 0;
  },

  async addToProject(employeeId, projectId, tenantId, trade, assignedBy) {
    // Look up if this employee has a linked user account
    const empResult = await db.query('SELECT user_id FROM employees WHERE id = $1', [employeeId]);
    const userId = empResult.rows[0]?.user_id || null;

    const result = await db.query(
      `INSERT INTO project_assignments (employee_id, user_id, project_id, tenant_id, trade, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_id, project_id) DO UPDATE SET trade = $5
       RETURNING *`,
      [employeeId, userId, projectId, tenantId, trade || null, assignedBy]
    );
    return result.rows[0];
  },

  async removeFromProject(employeeId, projectId, tenantId) {
    const result = await db.query(
      `DELETE FROM project_assignments
       WHERE employee_id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [employeeId, projectId, tenantId]
    );
    return result.rows[0];
  },

  async updateTrade(employeeId, projectId, tenantId, trade) {
    const result = await db.query(
      `UPDATE project_assignments SET trade = $1
       WHERE employee_id = $2 AND project_id = $3 AND tenant_id = $4
       RETURNING *`,
      [trade, employeeId, projectId, tenantId]
    );
    return result.rows[0];
  },

  // Keep old methods for user-based sync (used by UserManagement)
  async assign(userId, projectId, tenantId, assignedBy) {
    const result = await db.query(
      `INSERT INTO project_assignments (user_id, project_id, tenant_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [userId, projectId, tenantId, assignedBy]
    );
    return result.rows[0];
  },

  async unassign(userId, projectId, tenantId) {
    const result = await db.query(
      `DELETE FROM project_assignments
       WHERE user_id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, projectId, tenantId]
    );
    return result.rows[0];
  },

  async syncForUser(userId, projectIds, tenantId, assignedBy) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM project_assignments WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );
      if (projectIds && projectIds.length > 0) {
        const values = projectIds.map((pid, i) =>
          `($1, $${i + 2}, $${projectIds.length + 2}, $${projectIds.length + 3})`
        ).join(', ');
        const params = [userId, ...projectIds, tenantId, assignedBy];
        await client.query(
          `INSERT INTO project_assignments (user_id, project_id, tenant_id, assigned_by)
           VALUES ${values}`,
          params
        );
      }
      await client.query('COMMIT');
      return this.findByUserId(userId, tenantId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = ProjectAssignment;
