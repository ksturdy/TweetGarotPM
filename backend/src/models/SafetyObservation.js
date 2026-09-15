const db = require('../config/database');

const SafetyObservation = {
  async create({ projectId, tenantId, number, observerId, dateOfObservation, weather, temperature, stretchAndFlex, feedbackNotes, sections, status, createdBy }) {
    const result = await db.query(
      `INSERT INTO safety_observations
         (project_id, tenant_id, number, observer_id, date_of_observation, weather, temperature, stretch_and_flex, feedback_notes, sections, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        projectId,
        tenantId,
        number,
        observerId,
        dateOfObservation,
        weather || null,
        temperature !== undefined ? temperature : null,
        stretchAndFlex !== undefined ? stretchAndFlex : null,
        feedbackNotes || null,
        JSON.stringify(sections || []),
        status || 'submitted',
        createdBy,
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT o.*,
              p.name AS project_name,
              p.number AS project_number,
              u1.first_name || ' ' || u1.last_name AS observer_name,
              u2.first_name || ' ' || u2.last_name AS reviewed_by_name
       FROM safety_observations o
       JOIN projects p ON o.project_id = p.id
       LEFT JOIN users u1 ON o.observer_id = u1.id
       LEFT JOIN users u2 ON o.reviewed_by = u2.id
       WHERE o.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT o.*,
             u.first_name || ' ' || u.last_name AS observer_name
      FROM safety_observations o
      LEFT JOIN users u ON o.observer_id = u.id
      WHERE o.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND o.status = $${params.length}`;
    }

    query += ' ORDER BY o.date_of_observation DESC, o.number DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async findByTenant(tenantId, filters = {}) {
    let query = `
      SELECT o.*,
             p.name AS project_name,
             p.number AS project_number,
             u.first_name || ' ' || u.last_name AS observer_name
      FROM safety_observations o
      JOIN projects p ON o.project_id = p.id
      LEFT JOIN users u ON o.observer_id = u.id
      WHERE o.tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND o.status = $${params.length}`;
    }
    if (filters.projectId) {
      params.push(filters.projectId);
      query += ` AND o.project_id = $${params.length}`;
    }

    query += ' ORDER BY o.date_of_observation DESC, o.id DESC LIMIT 200';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, { dateOfObservation, weather, temperature, stretchAndFlex, feedbackNotes, sections, status }) {
    const fields = [];
    const values = [];
    let p = 1;

    if (dateOfObservation !== undefined) { fields.push(`date_of_observation = $${p++}`); values.push(dateOfObservation); }
    if (weather !== undefined)           { fields.push(`weather = $${p++}`);             values.push(weather); }
    if (temperature !== undefined)       { fields.push(`temperature = $${p++}`);         values.push(temperature); }
    if (stretchAndFlex !== undefined)    { fields.push(`stretch_and_flex = $${p++}`);    values.push(stretchAndFlex); }
    if (feedbackNotes !== undefined)     { fields.push(`feedback_notes = $${p++}`);      values.push(feedbackNotes); }
    if (sections !== undefined)          { fields.push(`sections = $${p++}`);            values.push(JSON.stringify(sections)); }
    if (status !== undefined)            { fields.push(`status = $${p++}`);              values.push(status); }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE safety_observations SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${p}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async review(id, reviewedBy) {
    const result = await db.query(
      `UPDATE safety_observations
       SET status = 'reviewed', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reviewedBy, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM safety_observations WHERE id = $1', [id]);
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next_number FROM safety_observations WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },

  async countOpen(tenantId) {
    const result = await db.query(
      `SELECT COUNT(*) AS count FROM safety_observations
       WHERE tenant_id = $1 AND status = 'submitted'`,
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = SafetyObservation;
