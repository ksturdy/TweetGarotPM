const db = require('../config/database');

const Takeoff = {
  async create({ tenantId, takeoffNumber, name, description, estimateId, performanceFactor, notes, createdBy, takeoffType, pipeSpecId, estimatorId, laborRatePerHour }) {
    const result = await db.query(
      `INSERT INTO takeoffs (tenant_id, takeoff_number, name, description, estimate_id, performance_factor, notes, created_by, status, takeoff_type, pipe_spec_id, estimator_id, labor_rate_per_hour)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11, $12)
       RETURNING *`,
      [tenantId, takeoffNumber, name, description || null, estimateId || null, performanceFactor || 0, notes || null, createdBy, takeoffType || 'manual', pipeSpecId || null, estimatorId || null, laborRatePerHour || 0]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT t.*,
              u.first_name || ' ' || u.last_name as created_by_name,
              est_u.first_name || ' ' || est_u.last_name as estimator_name,
              e.estimate_number, e.project_name as estimate_project_name
       FROM takeoffs t
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users est_u ON t.estimator_id = est_u.id
       LEFT JOIN estimates e ON t.estimate_id = e.id
       WHERE t.id = $1`,
      [id]
    );
    const takeoff = result.rows[0];
    if (takeoff) {
      takeoff.items = await this.getItems(id);
    }
    return takeoff;
  },

  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT t.*,
              u.first_name || ' ' || u.last_name as created_by_name,
              est_u.first_name || ' ' || est_u.last_name as estimator_name,
              e.estimate_number, e.project_name as estimate_project_name
       FROM takeoffs t
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users est_u ON t.estimator_id = est_u.id
       LEFT JOIN estimates e ON t.estimate_id = e.id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, tenantId]
    );
    const takeoff = result.rows[0];
    if (takeoff) {
      takeoff.items = await this.getItems(id);
    }
    return takeoff;
  },

  async findAll(filters = {}, tenantId) {
    let query = `
      SELECT t.*,
             u.first_name || ' ' || u.last_name as created_by_name,
             est_u.first_name || ' ' || est_u.last_name as estimator_name,
             e.estimate_number, e.project_name as estimate_project_name
      FROM takeoffs t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users est_u ON t.estimator_id = est_u.id
      LEFT JOIN estimates e ON t.estimate_id = e.id
      WHERE t.tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND t.status = $${params.length}`;
    }

    if (filters.estimate_id) {
      params.push(filters.estimate_id);
      query += ` AND t.estimate_id = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (t.name ILIKE $${params.length} OR t.takeoff_number ILIKE $${params.length} OR t.description ILIKE $${params.length})`;
    }

    query += ' ORDER BY t.updated_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, updates, tenantId) {
    const allowedFields = ['name', 'description', 'estimate_id', 'performance_factor', 'status', 'notes', 'takeoff_type', 'pipe_spec_id', 'estimator_id', 'labor_rate_per_hour'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    }

    if (fields.length === 0) return this.findByIdAndTenant(id, tenantId);

    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE takeoffs SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    await db.query('DELETE FROM takeoffs WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  },

  async getNextNumber(tenantId) {
    const year = new Date().getFullYear();
    const prefix = `TO-${year}-`;

    const result = await db.query(
      `SELECT takeoff_number FROM takeoffs
       WHERE takeoff_number LIKE $1 AND tenant_id = $2
       ORDER BY takeoff_number DESC
       LIMIT 1`,
      [`${prefix}%`, tenantId]
    );

    if (result.rows.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = result.rows[0].takeoff_number;
    const lastSeq = parseInt(lastNumber.replace(prefix, ''), 10);
    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  },

  // --- Line item methods ---

  async getItems(takeoffId) {
    const result = await db.query(
      'SELECT * FROM takeoff_items WHERE takeoff_id = $1 ORDER BY sort_order',
      [takeoffId]
    );
    return result.rows;
  },

  async addItem(takeoffId, { sortOrder, fittingType, size, joinType, quantity, baseHoursPerUnit, baseHoursTotal, adjustedHours, materialUnitCost, materialCost, remarks }) {
    const result = await db.query(
      `INSERT INTO takeoff_items (takeoff_id, sort_order, fitting_type, size, join_type, quantity, base_hours_per_unit, base_hours_total, adjusted_hours, material_unit_cost, material_cost, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [takeoffId, sortOrder || 1, fittingType, size, joinType || null, quantity || 1, baseHoursPerUnit || 0, baseHoursTotal || 0, adjustedHours || 0, materialUnitCost || 0, materialCost || 0, remarks || null]
    );
    return result.rows[0];
  },

  async updateItem(itemId, data) {
    const allowedFields = ['sort_order', 'fitting_type', 'size', 'join_type', 'quantity', 'base_hours_per_unit', 'base_hours_total', 'adjusted_hours', 'material_unit_cost', 'material_cost', 'remarks'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      const result = await db.query('SELECT * FROM takeoff_items WHERE id = $1', [itemId]);
      return result.rows[0];
    }

    values.push(itemId);
    const result = await db.query(
      `UPDATE takeoff_items SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteItem(itemId) {
    await db.query('DELETE FROM takeoff_items WHERE id = $1', [itemId]);
  },

  async findItemById(itemId) {
    const result = await db.query('SELECT * FROM takeoff_items WHERE id = $1', [itemId]);
    return result.rows[0];
  },

  /**
   * Bulk sync items from the traceover workspace.
   * Deletes existing items and inserts the new set, preserving trigger-based totals.
   */
  async syncItems(takeoffId, items) {
    // Delete all existing items for this takeoff
    await db.query('DELETE FROM takeoff_items WHERE takeoff_id = $1', [takeoffId]);

    if (items.length === 0) {
      // Trigger won't fire on empty delete-only, so manually zero out totals
      await db.query(
        `UPDATE takeoffs SET total_items = 0, total_base_hours = 0, total_adjusted_hours = 0, total_material_cost = 0 WHERE id = $1`,
        [takeoffId]
      );
      return [];
    }

    const inserted = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const result = await db.query(
        `INSERT INTO takeoff_items (
          takeoff_id, sort_order, fitting_type, size, join_type, quantity,
          base_hours_per_unit, base_hours_total, adjusted_hours,
          material_unit_cost, material_cost, remarks,
          source, traceover_run_id, document_id, page_number,
          component_type, label, description, material, pipe_material,
          labor_hours, reducing_size, confidence, verified
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21,
          $22, $23, $24, $25
        ) RETURNING *`,
        [
          takeoffId,
          item.sort_order || i + 1,
          item.fitting_type || 'pipe',
          item.size || '',
          item.join_type || null,
          item.quantity || 0,
          item.base_hours_per_unit || 0,
          item.base_hours_total || 0,
          item.adjusted_hours || 0,
          item.material_unit_cost || 0,
          item.material_cost || 0,
          item.remarks || null,
          item.source || 'traceover',
          item.traceover_run_id || null,
          item.document_id || null,
          item.page_number || null,
          item.component_type || null,
          item.label || '',
          item.description || '',
          item.material || '',
          item.pipe_material || '',
          item.labor_hours || 0,
          item.reducing_size || null,
          item.confidence || null,
          item.verified || false,
        ]
      );
      inserted.push(result.rows[0]);
    }
    return inserted;
  },

  /**
   * Recalculate all items for a takeoff based on current performance factor.
   * Useful when performance factor changes or productivity rates are updated.
   */
  async recalculateItems(takeoffId, performanceFactor) {
    const items = await this.getItems(takeoffId);
    const multiplier = 1 + (performanceFactor / 100);

    for (const item of items) {
      const baseHoursTotal = item.base_hours_per_unit * item.quantity;
      const adjustedHours = baseHoursTotal * multiplier;
      const materialCost = item.material_unit_cost * item.quantity;

      await db.query(
        `UPDATE takeoff_items SET base_hours_total = $1, adjusted_hours = $2, material_cost = $3
         WHERE id = $4`,
        [baseHoursTotal, adjustedHours, materialCost, item.id]
      );
    }

    // Trigger will update takeoff totals
    return this.getItems(takeoffId);
  },
};

module.exports = Takeoff;
