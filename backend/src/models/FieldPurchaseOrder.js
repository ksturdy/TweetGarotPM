const db = require('../config/database');

const FieldPurchaseOrder = {
  async create({ projectId, tenantId, number, vendorId, vendorName, vendorContact, vendorPhone, vendorEmail, description, deliveryDate, deliveryLocation, shippingMethod, subtotal, taxRate, taxAmount, shippingCost, total, costCode, phaseCode, notes, createdBy }) {
    const result = await db.query(
      `INSERT INTO field_purchase_orders (project_id, tenant_id, number, vendor_id, vendor_name, vendor_contact, vendor_phone, vendor_email, description, delivery_date, delivery_location, shipping_method, subtotal, tax_rate, tax_amount, shipping_cost, total, cost_code, phase_code, notes, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'draft')
       RETURNING *`,
      [projectId, tenantId, number, vendorId || null, vendorName, vendorContact, vendorPhone, vendorEmail, description, deliveryDate || null, deliveryLocation, shippingMethod, subtotal || 0, taxRate || 0, taxAmount || 0, shippingCost || 0, total || 0, costCode, phaseCode, notes, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT fpo.*,
              p.name as project_name, p.number as project_number,
              u1.first_name || ' ' || u1.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as approved_by_name
       FROM field_purchase_orders fpo
       JOIN projects p ON fpo.project_id = p.id
       LEFT JOIN users u1 ON fpo.created_by = u1.id
       LEFT JOIN users u2 ON fpo.approved_by = u2.id
       WHERE fpo.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT fpo.*,
             u1.first_name || ' ' || u1.last_name as created_by_name
      FROM field_purchase_orders fpo
      LEFT JOIN users u1 ON fpo.created_by = u1.id
      WHERE fpo.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND fpo.status = $${params.length}`;
    }

    query += ' ORDER BY fpo.number DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, updates) {
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

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE field_purchase_orders SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM field_purchase_orders WHERE id = $1', [id]);
  },

  async approve(id, { approvedBy }) {
    const result = await db.query(
      `UPDATE field_purchase_orders SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedBy, id]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM field_purchase_orders WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },

  // Line items
  async addItem(purchaseOrderId, { description, quantity, unit, unitCost, totalCost, sortOrder }) {
    const result = await db.query(
      `INSERT INTO field_purchase_order_items (purchase_order_id, description, quantity, unit, unit_cost, total_cost, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [purchaseOrderId, description, quantity || 1, unit, unitCost || 0, totalCost || 0, sortOrder || 0]
    );
    return result.rows[0];
  },

  async updateItem(itemId, updates) {
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

    values.push(itemId);
    const result = await db.query(
      `UPDATE field_purchase_order_items SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteItem(itemId) {
    await db.query('DELETE FROM field_purchase_order_items WHERE id = $1', [itemId]);
  },

  async getItems(purchaseOrderId) {
    const result = await db.query(
      `SELECT fpi.*,
              u.first_name || ' ' || u.last_name as received_by_name
       FROM field_purchase_order_items fpi
       LEFT JOIN users u ON fpi.received_by = u.id
       WHERE fpi.purchase_order_id = $1
       ORDER BY fpi.sort_order, fpi.id`,
      [purchaseOrderId]
    );
    return result.rows;
  },

  async getProjectTotals(projectId) {
    const result = await db.query(
      `SELECT
         COUNT(*) as total_count,
         COUNT(*) FILTER (WHERE status = 'approved' OR status = 'ordered' OR status = 'received' OR status = 'closed') as approved_count,
         COALESCE(SUM(total), 0) as total_amount,
         COALESCE(SUM(total) FILTER (WHERE status = 'approved' OR status = 'ordered' OR status = 'received' OR status = 'closed'), 0) as approved_amount
       FROM field_purchase_orders
       WHERE project_id = $1`,
      [projectId]
    );
    return result.rows[0];
  },
};

module.exports = FieldPurchaseOrder;
