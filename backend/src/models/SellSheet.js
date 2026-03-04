const db = require('../config/database');

const SellSheet = {
  async create(data, tenantId) {
    const {
      service_name, title, subtitle, layout_style,
      overview, content, sidebar_content, page2_content, footer_content,
      created_by
    } = data;

    const result = await db.query(
      `INSERT INTO sell_sheets (
        service_name, title, subtitle, layout_style,
        overview, content, sidebar_content, page2_content, footer_content,
        created_by, tenant_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        service_name, title || service_name, subtitle, layout_style || 'full_width',
        overview, content, sidebar_content, page2_content, footer_content,
        created_by, tenantId, 'draft'
      ]
    );
    return result.rows[0];
  },

  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT ss.*,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM sell_sheets ss
       LEFT JOIN users u ON ss.created_by = u.id
       WHERE ss.id = $1 AND ss.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT ss.*,
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
             (SELECT COUNT(*) FROM sell_sheet_images WHERE sell_sheet_id = ss.id) as image_count,
             (SELECT json_agg(json_build_object('id', ssi.id, 'file_path', ssi.file_path, 'is_hero_image', ssi.is_hero_image) ORDER BY ssi.display_order)
              FROM sell_sheet_images ssi WHERE ssi.sell_sheet_id = ss.id) as images
      FROM sell_sheets ss
      LEFT JOIN users u ON ss.created_by = u.id
      WHERE ss.tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND ss.status = $${params.length}`;
    }

    if (filters.service_name) {
      params.push(filters.service_name);
      query += ` AND ss.service_name = $${params.length}`;
    }

    if (filters.featured !== undefined) {
      params.push(filters.featured);
      query += ` AND ss.featured = $${params.length}`;
    }

    query += ' ORDER BY ss.display_order NULLS LAST, ss.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, data, tenantId) {
    const {
      service_name, title, subtitle, layout_style,
      overview, content, sidebar_content, page2_content, footer_content,
      featured, display_order
    } = data;

    const result = await db.query(
      `UPDATE sell_sheets SET
        service_name = COALESCE($1, service_name),
        title = COALESCE($2, title),
        subtitle = $3,
        layout_style = COALESCE($4, layout_style),
        overview = $5,
        content = $6,
        sidebar_content = $7,
        page2_content = $8,
        footer_content = $9,
        featured = COALESCE($10, featured),
        display_order = COALESCE($11, display_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND tenant_id = $13
       RETURNING *`,
      [
        service_name, title, subtitle !== undefined ? subtitle : null,
        layout_style,
        overview !== undefined ? overview : null,
        content !== undefined ? content : null,
        sidebar_content !== undefined ? sidebar_content : null,
        page2_content !== undefined ? page2_content : null,
        footer_content !== undefined ? footer_content : null,
        featured, display_order, id, tenantId
      ]
    );
    return result.rows[0];
  },

  async publish(id, userId, tenantId) {
    const result = await db.query(
      `UPDATE sell_sheets SET
        status = 'published',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async archive(id, tenantId) {
    const result = await db.query(
      `UPDATE sell_sheets SET
        status = 'archived',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async unarchive(id, tenantId) {
    const result = await db.query(
      `UPDATE sell_sheets SET
        status = 'draft',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2 AND status = 'archived'
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM sell_sheets WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM sell_sheets WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  }
};

module.exports = SellSheet;
