const pool = require('../config/database');

class Budget {
  static async create(budgetData) {
    const {
      tenant_id,
      project_name,
      building_type,
      project_type,
      bid_type,
      square_footage,
      scope_notes,
      estimated_total,
      cost_per_sqft,
      confidence_level,
      methodology,
      labor_subtotal,
      material_subtotal,
      equipment_subtotal,
      subcontract_subtotal,
      direct_cost_subtotal,
      overhead,
      profit,
      contingency,
      grand_total,
      overhead_percent,
      profit_percent,
      contingency_percent,
      sections,
      assumptions,
      risks,
      comparable_projects,
      status,
      created_by
    } = budgetData;

    const result = await pool.query(
      `INSERT INTO budgets (
        tenant_id, project_name, building_type, project_type, bid_type,
        square_footage, scope_notes, estimated_total, cost_per_sqft,
        confidence_level, methodology, labor_subtotal, material_subtotal,
        equipment_subtotal, subcontract_subtotal, direct_cost_subtotal,
        overhead, profit, contingency, grand_total, overhead_percent,
        profit_percent, contingency_percent, sections, assumptions, risks,
        comparable_projects, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      RETURNING *`,
      [
        tenant_id, project_name, building_type, project_type, bid_type,
        square_footage, scope_notes, estimated_total, cost_per_sqft,
        confidence_level, methodology, labor_subtotal || 0, material_subtotal || 0,
        equipment_subtotal || 0, subcontract_subtotal || 0, direct_cost_subtotal || 0,
        overhead || 0, profit || 0, contingency || 0, grand_total || 0, overhead_percent || 10,
        profit_percent || 10, contingency_percent || 5, JSON.stringify(sections || []),
        JSON.stringify(assumptions || []), JSON.stringify(risks || []),
        JSON.stringify(comparable_projects || []), status || 'draft', created_by
      ]
    );
    return result.rows[0];
  }

  static async findById(id, tenantId) {
    const result = await pool.query(
      `SELECT b.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM budgets b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.id = $1 AND b.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async findAll(tenantId, filters = {}) {
    let query = `
      SELECT b.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM budgets b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.tenant_id = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.building_type) {
      query += ` AND b.building_type = $${paramIndex}`;
      params.push(filters.building_type);
      paramIndex++;
    }

    if (filters.project_type) {
      query += ` AND b.project_type = $${paramIndex}`;
      params.push(filters.project_type);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND b.project_name ILIKE $${paramIndex}`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ' ORDER BY b.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id, tenantId, updates) {
    const allowedFields = [
      'project_name', 'building_type', 'project_type', 'bid_type',
      'square_footage', 'scope_notes', 'estimated_total', 'cost_per_sqft',
      'confidence_level', 'methodology', 'labor_subtotal', 'material_subtotal',
      'equipment_subtotal', 'subcontract_subtotal', 'direct_cost_subtotal',
      'overhead', 'profit', 'contingency', 'grand_total', 'overhead_percent',
      'profit_percent', 'contingency_percent', 'sections', 'assumptions',
      'risks', 'comparable_projects', 'status'
    ];

    const setClauses = [];
    const params = [id, tenantId];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramIndex}`);
        // Stringify JSON fields
        if (['sections', 'assumptions', 'risks', 'comparable_projects'].includes(key)) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.findById(id, tenantId);
    }

    const result = await pool.query(
      `UPDATE budgets SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      params
    );
    return result.rows[0];
  }

  static async delete(id, tenantId) {
    const result = await pool.query(
      'DELETE FROM budgets WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  }

  static async getStats(tenantId) {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total_budgets,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'final' THEN 1 END) as final_count,
        COALESCE(SUM(grand_total), 0) as total_value,
        COALESCE(AVG(grand_total), 0) as avg_value,
        COALESCE(AVG(cost_per_sqft), 0) as avg_cost_per_sqft
       FROM budgets
       WHERE tenant_id = $1`,
      [tenantId]
    );
    return result.rows[0];
  }
}

module.exports = Budget;
