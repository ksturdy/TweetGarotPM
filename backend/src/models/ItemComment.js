const db = require('../config/database');

const ItemComment = {
  async findByEntityKey(tenantId, projectId, entityType, entityKey) {
    const result = await db.query(
      `SELECT ic.*,
              u.first_name || ' ' || u.last_name AS commenter_name,
              u.email AS commenter_email
       FROM item_comments ic
       JOIN users u ON ic.user_id = u.id
       WHERE ic.tenant_id = $1 AND ic.project_id = $2
         AND ic.entity_type = $3 AND ic.entity_key = $4
       ORDER BY ic.created_at ASC`,
      [tenantId, projectId, entityType, entityKey]
    );
    return result.rows;
  },

  async findCountsByEntityType(tenantId, projectId, entityType) {
    const result = await db.query(
      `SELECT entity_key, COUNT(*) AS count
       FROM item_comments
       WHERE tenant_id = $1 AND project_id = $2 AND entity_type = $3
       GROUP BY entity_key`,
      [tenantId, projectId, entityType]
    );
    return result.rows;
  },

  async create({ tenantId, projectId, userId, entityType, entityKey, comment, link }) {
    const result = await db.query(
      `INSERT INTO item_comments (tenant_id, project_id, user_id, entity_type, entity_key, comment, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, projectId, userId, entityType, entityKey, comment, link || null]
    );
    return result.rows[0];
  },

  async delete(id, userId, tenantId) {
    const result = await db.query(
      `DELETE FROM item_comments
       WHERE id = $1 AND user_id = $2 AND tenant_id = $3
       RETURNING *`,
      [id, userId, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = ItemComment;
