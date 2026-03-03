const db = require('../config/database');

const SafetyJsa = {
  async create({ projectId, tenantId, number, taskDescription, workLocation, dateOfWork, weather, temperature, ppeRequired, customerName, departmentTrade, filledOutBy, permitsRequired, equipmentRequired, additionalComments, workerNames, notes, createdBy }) {
    const result = await db.query(
      `INSERT INTO safety_jsa (project_id, tenant_id, number, task_description, work_location, date_of_work, weather, temperature, ppe_required, customer_name, department_trade, filled_out_by, permits_required, equipment_required, additional_comments, worker_names, notes, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'draft')
       RETURNING *`,
      [projectId, tenantId, number, taskDescription, workLocation, dateOfWork, weather, temperature, JSON.stringify(ppeRequired || []), customerName || null, departmentTrade || null, filledOutBy || null, JSON.stringify(permitsRequired || []), JSON.stringify(equipmentRequired || []), additionalComments || null, JSON.stringify(workerNames || []), notes, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT j.*,
              p.name as project_name, p.number as project_number,
              u1.first_name || ' ' || u1.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as reviewed_by_name
       FROM safety_jsa j
       JOIN projects p ON j.project_id = p.id
       LEFT JOIN users u1 ON j.created_by = u1.id
       LEFT JOIN users u2 ON j.reviewed_by = u2.id
       WHERE j.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT j.*,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM safety_jsa j
      LEFT JOIN users u ON j.created_by = u.id
      WHERE j.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND j.status = $${params.length}`;
    }

    query += ' ORDER BY j.date_of_work DESC, j.number DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, updates) {
    const jsonbFields = ['ppeRequired', 'permitsRequired', 'equipmentRequired', 'workerNames'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (jsonbFields.includes(key)) {
          fields.push(`${dbField} = $${paramCount}`);
          values.push(JSON.stringify(updates[key]));
        } else {
          fields.push(`${dbField} = $${paramCount}`);
          values.push(updates[key]);
        }
        paramCount++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE safety_jsa SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM safety_jsa WHERE id = $1', [id]);
  },

  async activate(id) {
    const result = await db.query(
      `UPDATE safety_jsa SET status = 'active', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async complete(id, { reviewedBy }) {
    const result = await db.query(
      `UPDATE safety_jsa SET status = 'completed', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reviewedBy, id]
    );
    return result.rows[0];
  },

  async updateWorkerNames(jsaId, names) {
    const result = await db.query(
      `UPDATE safety_jsa SET worker_names = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [jsaId, JSON.stringify(names || [])]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM safety_jsa WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },

  // Hazards
  async addHazard(jsaId, { sortOrder, stepDescription, hazard, controlMeasure, responsiblePerson }) {
    const result = await db.query(
      `INSERT INTO safety_jsa_hazards (jsa_id, sort_order, step_description, hazard, control_measure, responsible_person)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [jsaId, sortOrder || 0, stepDescription, hazard, controlMeasure, responsiblePerson]
    );
    return result.rows[0];
  },

  async updateHazard(hazardId, updates) {
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

    if (fields.length === 0) return null;

    values.push(hazardId);
    const result = await db.query(
      `UPDATE safety_jsa_hazards SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteHazard(hazardId) {
    await db.query('DELETE FROM safety_jsa_hazards WHERE id = $1', [hazardId]);
  },

  async getHazards(jsaId) {
    const result = await db.query(
      'SELECT * FROM safety_jsa_hazards WHERE jsa_id = $1 ORDER BY sort_order, id',
      [jsaId]
    );
    return result.rows;
  },

  // Signatures
  async addSignature(jsaId, { employeeName, employeeId, signatureData }) {
    const result = await db.query(
      `INSERT INTO safety_jsa_signatures (jsa_id, employee_name, employee_id, signature_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [jsaId, employeeName, employeeId || null, signatureData || null]
    );
    return result.rows[0];
  },

  async getSignatures(jsaId) {
    const result = await db.query(
      'SELECT * FROM safety_jsa_signatures WHERE jsa_id = $1 ORDER BY signed_at',
      [jsaId]
    );
    return result.rows;
  },
};

module.exports = SafetyJsa;
