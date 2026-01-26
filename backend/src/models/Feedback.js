const pool = require('../config/database');

class Feedback {
  // Get all feedback with optional filters
  static async findAll({ status, module, type, sortBy = 'votes', order = 'desc' } = {}) {
    let query = `
      SELECT
        f.*,
        u.first_name || ' ' || u.last_name as submitter_name,
        u.email as submitter_email,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'up'), 0) as upvotes,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'down'), 0) as downvotes
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND f.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (module) {
      query += ` AND f.module = $${paramCount}`;
      params.push(module);
      paramCount++;
    }

    if (type) {
      query += ` AND f.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    // Sort options
    const validSortColumns = {
      'votes': 'f.votes_count',
      'created': 'f.created_at',
      'updated': 'f.updated_at',
      'status': 'f.status',
      'priority': 'f.priority'
    };

    const sortColumn = validSortColumns[sortBy] || 'f.votes_count';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortColumn} ${sortOrder}, f.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get all feedback with optional filters (tenant-scoped)
  static async findAllByTenant({ status, module, type, sortBy = 'votes', order = 'desc' } = {}, tenantId) {
    let query = `
      SELECT
        f.*,
        u.first_name || ' ' || u.last_name as submitter_name,
        u.email as submitter_email,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'up'), 0) as upvotes,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'down'), 0) as downvotes
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      WHERE f.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (status) {
      query += ` AND f.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (module) {
      query += ` AND f.module = $${paramCount}`;
      params.push(module);
      paramCount++;
    }

    if (type) {
      query += ` AND f.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    // Sort options
    const validSortColumns = {
      'votes': 'f.votes_count',
      'created': 'f.created_at',
      'updated': 'f.updated_at',
      'status': 'f.status',
      'priority': 'f.priority'
    };

    const sortColumn = validSortColumns[sortBy] || 'f.votes_count';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortColumn} ${sortOrder}, f.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get feedback by ID with full details
  static async findById(id) {
    const query = `
      SELECT
        f.*,
        u.first_name || ' ' || u.last_name as submitter_name,
        u.email as submitter_email,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'up'), 0) as upvotes,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'down'), 0) as downvotes
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Get feedback by ID with tenant verification
  static async findByIdAndTenant(id, tenantId) {
    const query = `
      SELECT
        f.*,
        u.first_name || ' ' || u.last_name as submitter_name,
        u.email as submitter_email,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'up'), 0) as upvotes,
        COALESCE((SELECT COUNT(*) FROM feedback_votes WHERE feedback_id = f.id AND vote_type = 'down'), 0) as downvotes
      FROM feedback f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = $1 AND f.tenant_id = $2
    `;
    const result = await pool.query(query, [id, tenantId]);
    return result.rows[0];
  }

  // Create new feedback
  static async create({ userId, module, submodule, title, description, type, priority = 'medium' }, tenantId = null) {
    const query = `
      INSERT INTO feedback (user_id, module, submodule, title, description, type, priority, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await pool.query(query, [userId, module, submodule, title, description, type, priority, tenantId]);
    return result.rows[0];
  }

  // Update feedback
  static async update(id, updates, tenantId = null) {
    const allowedFields = ['status', 'priority', 'title', 'description', 'module', 'submodule', 'type'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = fields.map(field => updates[field]);

    let whereClause = 'WHERE id = $1';
    if (tenantId) {
      whereClause += ` AND tenant_id = $${fields.length + 2}`;
      values.push(tenantId);
    }

    // If status is being set to 'completed', set completed_at
    if (updates.status === 'completed') {
      const query = `
        UPDATE feedback
        SET ${setClause}, completed_at = CURRENT_TIMESTAMP
        ${whereClause}
        RETURNING *
      `;
      const result = await pool.query(query, [id, ...values]);
      return result.rows[0];
    }

    const query = `
      UPDATE feedback
      SET ${setClause}
      ${whereClause}
      RETURNING *
    `;
    const result = await pool.query(query, [id, ...values]);
    return result.rows[0];
  }

  // Delete feedback
  static async delete(id, tenantId = null) {
    let query = 'DELETE FROM feedback WHERE id = $1';
    const params = [id];
    if (tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }
    query += ' RETURNING *';
    const result = await pool.query(query, params);
    return result.rows[0];
  }

  // Get user's vote on feedback
  static async getUserVote(feedbackId, userId) {
    const query = 'SELECT * FROM feedback_votes WHERE feedback_id = $1 AND user_id = $2';
    const result = await pool.query(query, [feedbackId, userId]);
    return result.rows[0];
  }

  // Add or update vote
  static async vote(feedbackId, userId, voteType) {
    const query = `
      INSERT INTO feedback_votes (feedback_id, user_id, vote_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (feedback_id, user_id)
      DO UPDATE SET vote_type = $3
      RETURNING *
    `;
    const result = await pool.query(query, [feedbackId, userId, voteType]);
    return result.rows[0];
  }

  // Remove vote
  static async removeVote(feedbackId, userId) {
    const query = 'DELETE FROM feedback_votes WHERE feedback_id = $1 AND user_id = $2 RETURNING *';
    const result = await pool.query(query, [feedbackId, userId]);
    return result.rows[0];
  }

  // Get all comments for feedback
  static async getComments(feedbackId) {
    const query = `
      SELECT
        fc.*,
        u.first_name || ' ' || u.last_name as commenter_name,
        u.email as commenter_email
      FROM feedback_comments fc
      JOIN users u ON fc.user_id = u.id
      WHERE fc.feedback_id = $1
      ORDER BY fc.created_at ASC
    `;
    const result = await pool.query(query, [feedbackId]);
    return result.rows;
  }

  // Add comment
  static async addComment(feedbackId, userId, comment) {
    const query = `
      INSERT INTO feedback_comments (feedback_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [feedbackId, userId, comment]);
    return result.rows[0];
  }

  // Update comment
  static async updateComment(commentId, userId, comment) {
    const query = `
      UPDATE feedback_comments
      SET comment = $3
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [commentId, userId, comment]);
    return result.rows[0];
  }

  // Delete comment
  static async deleteComment(commentId, userId) {
    const query = 'DELETE FROM feedback_comments WHERE id = $1 AND user_id = $2 RETURNING *';
    const result = await pool.query(query, [commentId, userId]);
    return result.rows[0];
  }

  // Get feedback statistics
  static async getStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN type = 'bug' THEN 1 END) as bugs,
        COUNT(CASE WHEN type = 'enhancement' THEN 1 END) as enhancements,
        COUNT(CASE WHEN type = 'feature_request' THEN 1 END) as feature_requests
      FROM feedback
    `;
    const result = await pool.query(query);
    return result.rows[0];
  }

  // Get feedback statistics (tenant-scoped)
  static async getStatsByTenant(tenantId) {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
        COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN type = 'bug' THEN 1 END) as bugs,
        COUNT(CASE WHEN type = 'enhancement' THEN 1 END) as enhancements,
        COUNT(CASE WHEN type = 'feature_request' THEN 1 END) as feature_requests
      FROM feedback
      WHERE tenant_id = $1
    `;
    const result = await pool.query(query, [tenantId]);
    return result.rows[0];
  }
}

module.exports = Feedback;
