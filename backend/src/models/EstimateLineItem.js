const db = require('../config/database');

const EstimateLineItem = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO estimate_line_items (
        estimate_id, section_id, item_order, item_type,
        description, specification, notes,
        quantity, unit,
        labor_hours, labor_rate, labor_cost, labor_burden_percentage, labor_burden_amount,
        material_unit_cost, material_cost, material_waste_percentage, material_waste_amount,
        equipment_unit_cost, equipment_cost,
        subcontractor_name, subcontractor_cost,
        rental_description, rental_duration, rental_rate, rental_cost,
        total_cost
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *`,
      [
        data.estimate_id, data.section_id, data.item_order || 0, data.item_type,
        data.description, data.specification, data.notes,
        data.quantity || 1, data.unit,
        data.labor_hours || 0, data.labor_rate || 0, data.labor_cost || 0,
        data.labor_burden_percentage || 0, data.labor_burden_amount || 0,
        data.material_unit_cost || 0, data.material_cost || 0,
        data.material_waste_percentage || 0, data.material_waste_amount || 0,
        data.equipment_unit_cost || 0, data.equipment_cost || 0,
        data.subcontractor_name, data.subcontractor_cost || 0,
        data.rental_description, data.rental_duration || 0, data.rental_rate || 0, data.rental_cost || 0,
        data.total_cost || 0
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM estimate_line_items WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findByEstimate(estimateId) {
    const result = await db.query(
      `SELECT eli.*, es.section_name
       FROM estimate_line_items eli
       LEFT JOIN estimate_sections es ON eli.section_id = es.id
       WHERE eli.estimate_id = $1
       ORDER BY es.section_order ASC, eli.item_order ASC`,
      [estimateId]
    );
    return result.rows;
  },

  async findBySection(sectionId) {
    const result = await db.query(
      `SELECT * FROM estimate_line_items
       WHERE section_id = $1
       ORDER BY item_order ASC`,
      [sectionId]
    );
    return result.rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'section_id', 'item_order', 'item_type', 'description', 'specification', 'notes',
      'quantity', 'unit',
      'labor_hours', 'labor_rate', 'labor_cost', 'labor_burden_percentage', 'labor_burden_amount',
      'material_unit_cost', 'material_cost', 'material_waste_percentage', 'material_waste_amount',
      'equipment_unit_cost', 'equipment_cost',
      'subcontractor_name', 'subcontractor_cost',
      'rental_description', 'rental_duration', 'rental_rate', 'rental_cost',
      'total_cost'
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
      `UPDATE estimate_line_items SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM estimate_line_items WHERE id = $1', [id]);
  },

  async bulkCreate(items) {
    const promises = items.map(item => this.create(item));
    return Promise.all(promises);
  },

  async bulkUpdate(items) {
    const promises = items.map(item => this.update(item.id, item));
    return Promise.all(promises);
  },

  async reorder(sectionId, itemOrders) {
    // itemOrders is an array of { id, item_order }
    const promises = itemOrders.map(({ id, item_order }) =>
      db.query(
        'UPDATE estimate_line_items SET item_order = $1, updated_at = NOW() WHERE id = $2 AND section_id = $3',
        [item_order, id, sectionId]
      )
    );
    await Promise.all(promises);
  },
};

module.exports = EstimateLineItem;
