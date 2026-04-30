const db = require('../config/database');

const OrgChart = {
  // ── Chart CRUD ──

  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT oc.*,
        p.name AS project_name,
        u.first_name || ' ' || u.last_name AS created_by_name,
        (SELECT COUNT(*) FROM org_chart_members WHERE org_chart_id = oc.id) AS member_count
      FROM org_charts oc
      LEFT JOIN projects p ON oc.project_id = p.id
      LEFT JOIN users u ON oc.created_by = u.id
      WHERE oc.tenant_id = $1
    `;
    const params = [tenantId];
    let idx = 2;

    if (filters.project_id) {
      query += ` AND oc.project_id = $${idx}`;
      params.push(filters.project_id);
      idx++;
    }

    if (filters.search) {
      query += ` AND (oc.name ILIKE $${idx} OR oc.description ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }

    query += ' ORDER BY oc.updated_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async findByIdAndTenant(id, tenantId) {
    const chartResult = await db.query(`
      SELECT oc.*,
        p.name AS project_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM org_charts oc
      LEFT JOIN projects p ON oc.project_id = p.id
      LEFT JOIN users u ON oc.created_by = u.id
      WHERE oc.id = $1 AND oc.tenant_id = $2
    `, [id, tenantId]);

    if (chartResult.rows.length === 0) return null;

    const chart = chartResult.rows[0];

    // Load members with hierarchy info
    const membersResult = await db.query(`
      SELECT m.*,
        mgr.first_name || ' ' || mgr.last_name AS manager_name
      FROM org_chart_members m
      LEFT JOIN org_chart_members mgr ON m.reports_to = mgr.id
      WHERE m.org_chart_id = $1
      ORDER BY m.sort_order, m.created_at
    `, [id]);

    chart.members = membersResult.rows;
    return chart;
  },

  async create(data, tenantId) {
    const result = await db.query(`
      INSERT INTO org_charts (tenant_id, project_id, name, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      tenantId,
      data.project_id || null,
      data.name,
      data.description || null,
      data.created_by || null
    ]);
    return result.rows[0];
  },

  async update(id, data, tenantId) {
    const result = await db.query(`
      UPDATE org_charts SET
        name = $1,
        description = $2,
        project_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
      RETURNING *
    `, [
      data.name,
      data.description || null,
      data.project_id || null,
      id,
      tenantId
    ]);
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM org_charts WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows[0];
  },

  // ── Member CRUD ──

  async getMembersWithHierarchy(orgChartId) {
    const result = await db.query(`
      SELECT m.*,
        mgr.first_name || ' ' || mgr.last_name AS manager_name
      FROM org_chart_members m
      LEFT JOIN org_chart_members mgr ON m.reports_to = mgr.id
      WHERE m.org_chart_id = $1
      ORDER BY m.sort_order, m.created_at
    `, [orgChartId]);
    return result.rows;
  },

  async createMember(orgChartId, data) {
    if (data.reports_to) {
      await this.validateNoCircularReporting(-1, data.reports_to, orgChartId);
    }

    const result = await db.query(`
      INSERT INTO org_chart_members (
        org_chart_id, first_name, last_name, title,
        email, phone, reports_to, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      orgChartId,
      data.first_name,
      data.last_name,
      data.title || null,
      data.email || null,
      data.phone || null,
      data.reports_to || null,
      data.sort_order || 0
    ]);
    return result.rows[0];
  },

  async updateMember(memberId, data, orgChartId) {
    if (data.reports_to !== undefined && data.reports_to !== null) {
      await this.validateNoCircularReporting(memberId, data.reports_to, orgChartId);
    }

    const result = await db.query(`
      UPDATE org_chart_members SET
        first_name = $1,
        last_name = $2,
        title = $3,
        email = $4,
        phone = $5,
        reports_to = $6,
        sort_order = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND org_chart_id = $9
      RETURNING *
    `, [
      data.first_name,
      data.last_name,
      data.title || null,
      data.email || null,
      data.phone || null,
      data.reports_to !== undefined ? data.reports_to : null,
      data.sort_order || 0,
      memberId,
      orgChartId
    ]);
    return result.rows[0];
  },

  async deleteMember(memberId, orgChartId) {
    const result = await db.query(
      'DELETE FROM org_chart_members WHERE id = $1 AND org_chart_id = $2 RETURNING id',
      [memberId, orgChartId]
    );
    return result.rows[0];
  },

  // ── Validation ──

  async validateNoCircularReporting(memberId, reportsTo, orgChartId) {
    if (!reportsTo) return true;

    if (memberId === reportsTo) {
      throw new Error('Member cannot report to themselves');
    }

    let current = reportsTo;
    const visited = new Set([memberId]);
    const maxDepth = 50;
    let depth = 0;

    while (current && depth < maxDepth) {
      if (visited.has(current)) {
        throw new Error('Circular reporting relationship detected');
      }
      visited.add(current);

      const result = await db.query(
        'SELECT reports_to FROM org_chart_members WHERE id = $1 AND org_chart_id = $2',
        [current, orgChartId]
      );

      if (result.rows.length === 0) break;
      current = result.rows[0].reports_to;
      depth++;
    }

    return true;
  },

  // ── Ownership verification ──

  async verifyChartOwnership(chartId, tenantId) {
    const result = await db.query(
      'SELECT id FROM org_charts WHERE id = $1 AND tenant_id = $2',
      [chartId, tenantId]
    );
    return result.rows.length > 0;
  }
};

module.exports = OrgChart;
