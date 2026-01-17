const db = require('../config/database');

const EstimateSection = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO estimate_sections (
        estimate_id, section_name, section_order, description
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [data.estimate_id, data.section_name, data.section_order || 0, data.description]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM estimate_sections WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findByEstimate(estimateId) {
    const result = await db.query(
      `SELECT * FROM estimate_sections
       WHERE estimate_id = $1
       ORDER BY section_order ASC, section_name ASC`,
      [estimateId]
    );
    return result.rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['section_name', 'section_order', 'description'];

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
      `UPDATE estimate_sections SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM estimate_sections WHERE id = $1', [id]);
  },

  async reorder(estimateId, sectionOrders) {
    // sectionOrders is an array of { id, section_order }
    const promises = sectionOrders.map(({ id, section_order }) =>
      db.query(
        'UPDATE estimate_sections SET section_order = $1, updated_at = NOW() WHERE id = $2 AND estimate_id = $3',
        [section_order, id, estimateId]
      )
    );
    await Promise.all(promises);
  },
};

module.exports = EstimateSection;
