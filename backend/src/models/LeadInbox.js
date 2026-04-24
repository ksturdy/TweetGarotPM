const pool = require('../config/database');

const LeadInbox = {
  /**
   * Create a new lead from incoming email
   */
  async create(data, tenantId) {
    const {
      fromEmail,
      fromName,
      subject,
      receivedAt,
      bodyText,
      bodyHtml,
      strippedText,
    } = data;

    const result = await pool.query(
      `INSERT INTO lead_inbox
        (tenant_id, from_email, from_name, subject, received_at,
         body_text, body_html, stripped_text, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [tenantId, fromEmail, fromName || null, subject || null, receivedAt,
       bodyText || null, bodyHtml || null, strippedText || null]
    );
    return result.rows[0];
  },

  /**
   * Update extracted data after AI processing
   */
  async updateExtractedData(id, data, tenantId) {
    const { extractedData, aiConfidence, status, error } = data;

    const result = await pool.query(
      `UPDATE lead_inbox
       SET extracted_data = $1,
           ai_confidence = $2,
           status = $3,
           ai_extraction_error = $4,
           updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        extractedData ? JSON.stringify(extractedData) : null,
        aiConfidence || null,
        status || 'ai_processed',
        error || null,
        id,
        tenantId
      ]
    );
    return result.rows[0];
  },

  /**
   * Get all leads for a tenant with optional filters
   */
  async findAllByTenant(tenantId, filters = {}) {
    const { status, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT l.*,
             u.first_name || ' ' || u.last_name as reviewed_by_name,
             (SELECT COUNT(*) FROM lead_inbox_attachments WHERE lead_inbox_id = l.id) as attachment_count
      FROM lead_inbox l
      LEFT JOIN users u ON l.reviewed_by = u.id
      WHERE l.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (status) {
      query += ` AND l.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY l.received_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  },

  /**
   * Get a single lead by ID
   */
  async findById(id, tenantId) {
    const result = await pool.query(
      `SELECT l.*,
              u.first_name || ' ' || u.last_name as reviewed_by_name,
              (SELECT COUNT(*) FROM lead_inbox_attachments WHERE lead_inbox_id = l.id) as attachment_count
       FROM lead_inbox l
       LEFT JOIN users u ON l.reviewed_by = u.id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Get attachments for a lead
   */
  async getAttachments(leadId) {
    const result = await pool.query(
      `SELECT * FROM lead_inbox_attachments
       WHERE lead_inbox_id = $1
       ORDER BY created_at ASC`,
      [leadId]
    );
    return result.rows;
  },

  /**
   * Add an attachment to a lead
   */
  async addAttachment(leadId, data) {
    const { filename, originalName, mimeType, sizeBytes, filePath } = data;

    const result = await pool.query(
      `INSERT INTO lead_inbox_attachments
        (lead_inbox_id, filename, original_name, mime_type, size_bytes, file_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [leadId, filename, originalName, mimeType || null, sizeBytes || null, filePath]
    );
    return result.rows[0];
  },

  /**
   * Log an activity for audit trail
   */
  async logActivity(leadId, data) {
    const { activityType, description, userId, metadata } = data;

    const result = await pool.query(
      `INSERT INTO lead_inbox_activities
        (lead_inbox_id, activity_type, description, user_id, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        leadId,
        activityType,
        description || null,
        userId || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    return result.rows[0];
  },

  /**
   * Get activities for a lead
   */
  async getActivities(leadId) {
    const result = await pool.query(
      `SELECT a.*,
              u.first_name || ' ' || u.last_name as user_name
       FROM lead_inbox_activities a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.lead_inbox_id = $1
       ORDER BY a.created_at DESC`,
      [leadId]
    );
    return result.rows;
  },

  /**
   * Approve a lead and link to opportunity
   */
  async approve(id, userId, opportunityId, tenantId) {
    const result = await pool.query(
      `UPDATE lead_inbox
       SET status = 'approved',
           reviewed_by = $2,
           reviewed_at = NOW(),
           opportunity_id = $3,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $4
       RETURNING *`,
      [id, userId, opportunityId, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Reject a lead with reason
   */
  async reject(id, userId, reason, tenantId) {
    const result = await pool.query(
      `UPDATE lead_inbox
       SET status = 'rejected',
           reviewed_by = $2,
           reviewed_at = NOW(),
           rejection_reason = $3,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $4
       RETURNING *`,
      [id, userId, reason || null, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Get count of leads by status for stats
   */
  async countByStatus(tenantId) {
    const result = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM lead_inbox
       WHERE tenant_id = $1
       GROUP BY status`,
      [tenantId]
    );

    // Transform to object for easier access
    const stats = {
      pending: 0,
      ai_processed: 0,
      approved: 0,
      rejected: 0,
      error: 0,
      total: 0,
    };

    result.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    return stats;
  },

  /**
   * Update extracted data manually (user edits)
   */
  async updateExtractedDataManual(id, extractedData, tenantId) {
    const result = await pool.query(
      `UPDATE lead_inbox
       SET extracted_data = $1,
           ai_confidence = 'manual',
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [JSON.stringify(extractedData), id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = LeadInbox;
