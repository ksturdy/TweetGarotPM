const db = require('../config/database');

const Estimate = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO estimates (
        estimate_number, project_name, customer_id, customer_name,
        building_type, square_footage, location, bid_date,
        project_start_date, project_duration,
        estimator_id, estimator_name, status,
        overhead_percentage, profit_percentage, contingency_percentage, bond_percentage,
        scope_of_work, exclusions, assumptions, notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        data.estimate_number, data.project_name, data.customer_id, data.customer_name,
        data.building_type, data.square_footage, data.location, data.bid_date,
        data.project_start_date, data.project_duration,
        data.estimator_id, data.estimator_name, data.status || 'draft',
        data.overhead_percentage || 10.00, data.profit_percentage || 10.00,
        data.contingency_percentage || 5.00, data.bond_percentage || 0,
        data.scope_of_work, data.exclusions, data.assumptions, data.notes,
        data.created_by
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT e.*,
              u1.first_name || ' ' || u1.last_name as estimator_full_name,
              u2.first_name || ' ' || u2.last_name as created_by_name,
              u3.first_name || ' ' || u3.last_name as approved_by_name,
              c.customer_facility
       FROM estimates e
       LEFT JOIN users u1 ON e.estimator_id = u1.id
       LEFT JOIN users u2 ON e.created_by = u2.id
       LEFT JOIN users u3 ON e.approved_by = u3.id
       LEFT JOIN customers c ON e.customer_id = c.id
       WHERE e.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findAll(filters = {}) {
    let query = `
      SELECT e.*,
             u1.first_name || ' ' || u1.last_name as estimator_full_name,
             c.customer_facility
      FROM estimates e
      LEFT JOIN users u1 ON e.estimator_id = u1.id
      LEFT JOIN customers c ON e.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      params.push(filters.status);
      query += ` AND e.status = $${paramCount++}`;
    }

    if (filters.estimator_id) {
      params.push(filters.estimator_id);
      query += ` AND e.estimator_id = $${paramCount++}`;
    }

    if (filters.customer_id) {
      params.push(filters.customer_id);
      query += ` AND e.customer_id = $${paramCount++}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (e.project_name ILIKE $${paramCount} OR e.estimate_number ILIKE $${paramCount} OR e.customer_name ILIKE $${paramCount})`;
      paramCount++;
    }

    query += ' ORDER BY e.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'project_name', 'customer_id', 'customer_name', 'building_type',
      'square_footage', 'location', 'bid_date', 'project_start_date',
      'project_duration', 'estimator_id', 'estimator_name', 'status',
      'overhead_percentage', 'profit_percentage', 'contingency_percentage',
      'bond_percentage', 'scope_of_work', 'exclusions', 'assumptions', 'notes',
      'approved_by'
    ];

    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key) && data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE estimates SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM estimates WHERE id = $1', [id]);
  },

  async getNextEstimateNumber() {
    const year = new Date().getFullYear();
    const prefix = `EST-${year}-`;

    const result = await db.query(
      `SELECT estimate_number FROM estimates
       WHERE estimate_number LIKE $1
       ORDER BY estimate_number DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    if (result.rows.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = parseInt(result.rows[0].estimate_number.split('-')[2]);
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `${prefix}${nextNumber}`;
  },

  async updateStatus(id, status, userId) {
    const updates = { status };

    if (status === 'approved') {
      updates.approved_by = userId;
      const result = await db.query(
        `UPDATE estimates
         SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, userId, id]
      );
      return result.rows[0];
    }

    if (status === 'pending') {
      const result = await db.query(
        `UPDATE estimates
         SET status = $1, submitted_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );
      return result.rows[0];
    }

    return this.update(id, updates);
  },
};

module.exports = Estimate;
