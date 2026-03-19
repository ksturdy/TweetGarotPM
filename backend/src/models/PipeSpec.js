const db = require('../config/database');

const PipeSpec = {
  async findAll(tenantId) {
    const result = await db.query(
      `SELECT * FROM pipe_specs WHERE tenant_id = $1 ORDER BY is_default DESC, name`,
      [tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT * FROM pipe_specs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    const spec = result.rows[0];
    if (!spec) return null;

    // Attach all rate sub-tables
    spec.pipe_rates = await this.getPipeRates(id);
    spec.fitting_rates = await this.getFittingRates(id);
    spec.reducing_rates = await this.getReducingRates(id);
    spec.reducing_tee_rates = await this.getReducingTeeRates(id);
    spec.cross_reducing_rates = await this.getCrossReducingRates(id);

    return spec;
  },

  async create(tenantId, data) {
    const result = await db.query(
      `INSERT INTO pipe_specs (tenant_id, name, joint_method, material, schedule, stock_pipe_length, joint_type, pipe_material, is_default, est_install_type, est_material, est_filters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [tenantId, data.name, data.joint_method, data.material, data.schedule,
       data.stock_pipe_length || 21, data.joint_type, data.pipe_material, data.is_default || false,
       data.est_install_type || null, data.est_material || null, data.est_filters ? JSON.stringify(data.est_filters) : '{}']
    );
    return result.rows[0];
  },

  async update(id, tenantId, data) {
    const fields = [];
    const params = [id, tenantId];
    let paramIdx = 3;

    const allowed = ['name', 'joint_method', 'material', 'schedule', 'stock_pipe_length', 'joint_type', 'pipe_material', 'is_default', 'est_install_type', 'est_material'];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx++}`);
        params.push(data[field]);
      }
    }
    // Handle est_filters separately (JSONB)
    if (data.est_filters !== undefined) {
      fields.push(`est_filters = $${paramIdx++}`);
      params.push(JSON.stringify(data.est_filters));
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    const result = await db.query(
      `UPDATE pipe_specs SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM pipe_specs WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async duplicate(id, tenantId, newName) {
    const source = await this.findById(id, tenantId);
    if (!source) return null;

    const newSpec = await this.create(tenantId, {
      name: newName,
      joint_method: source.joint_method,
      material: source.material,
      schedule: source.schedule,
      stock_pipe_length: source.stock_pipe_length,
      joint_type: source.joint_type,
      pipe_material: source.pipe_material,
      is_default: false,
      est_install_type: source.est_install_type,
      est_material: source.est_material,
      est_filters: source.est_filters,
    });

    // Copy all rates
    if (source.pipe_rates.length > 0) {
      await this.bulkUpsertPipeRates(newSpec.id, source.pipe_rates.map(r => ({ pipe_size: r.pipe_size, hours_per_foot: r.hours_per_foot })));
    }
    if (source.fitting_rates.length > 0) {
      await this.bulkUpsertFittingRates(newSpec.id, source.fitting_rates.map(r => ({ fitting_type: r.fitting_type, pipe_size: r.pipe_size, hours_per_unit: r.hours_per_unit })));
    }
    if (source.reducing_rates.length > 0) {
      await this.bulkUpsertReducingRates(newSpec.id, source.reducing_rates.map(r => ({ fitting_type: r.fitting_type, main_size: r.main_size, reducing_size: r.reducing_size, hours_per_unit: r.hours_per_unit })));
    }
    if (source.reducing_tee_rates.length > 0) {
      await this.bulkUpsertReducingTeeRates(newSpec.id, source.reducing_tee_rates.map(r => ({ main_size: r.main_size, branch_size: r.branch_size, hours_per_unit: r.hours_per_unit })));
    }
    if (source.cross_reducing_rates.length > 0) {
      await this.bulkUpsertCrossReducingRates(newSpec.id, source.cross_reducing_rates.map(r => ({ main_size: r.main_size, reducing_size: r.reducing_size, hours_per_unit: r.hours_per_unit })));
    }

    return this.findById(newSpec.id, tenantId);
  },

  // ─── Pipe Rates ───

  async getPipeRates(specId) {
    const result = await db.query(
      `SELECT * FROM pipe_spec_pipe_rates WHERE pipe_spec_id = $1 ORDER BY pipe_size`,
      [specId]
    );
    return result.rows;
  },

  async bulkUpsertPipeRates(specId, rates) {
    if (!rates || rates.length === 0) return;
    const values = rates.map((r, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
    const params = [specId];
    for (const r of rates) {
      params.push(r.pipe_size, r.hours_per_foot);
    }
    await db.query(
      `INSERT INTO pipe_spec_pipe_rates (pipe_spec_id, pipe_size, hours_per_foot) VALUES ${values}
       ON CONFLICT (pipe_spec_id, pipe_size) DO UPDATE SET hours_per_foot = EXCLUDED.hours_per_foot`,
      params
    );
  },

  async lookupPipeRate(specId, pipeSize) {
    const result = await db.query(
      `SELECT hours_per_foot FROM pipe_spec_pipe_rates WHERE pipe_spec_id = $1 AND pipe_size = $2`,
      [specId, pipeSize]
    );
    return result.rows[0] || null;
  },

  // ─── Fitting Rates ───

  async getFittingRates(specId) {
    const result = await db.query(
      `SELECT * FROM pipe_spec_fitting_rates WHERE pipe_spec_id = $1 ORDER BY fitting_type, pipe_size`,
      [specId]
    );
    return result.rows;
  },

  async bulkUpsertFittingRates(specId, rates) {
    if (!rates || rates.length === 0) return;
    const values = rates.map((r, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ');
    const params = [specId];
    for (const r of rates) {
      params.push(r.fitting_type, r.pipe_size, r.hours_per_unit);
    }
    await db.query(
      `INSERT INTO pipe_spec_fitting_rates (pipe_spec_id, fitting_type, pipe_size, hours_per_unit) VALUES ${values}
       ON CONFLICT (pipe_spec_id, fitting_type, pipe_size) DO UPDATE SET hours_per_unit = EXCLUDED.hours_per_unit`,
      params
    );
  },

  async lookupFittingRate(specId, fittingType, pipeSize) {
    const result = await db.query(
      `SELECT hours_per_unit FROM pipe_spec_fitting_rates WHERE pipe_spec_id = $1 AND fitting_type = $2 AND pipe_size = $3`,
      [specId, fittingType, pipeSize]
    );
    return result.rows[0] || null;
  },

  // ─── Reducing Rates ───

  async getReducingRates(specId) {
    const result = await db.query(
      `SELECT * FROM pipe_spec_reducing_rates WHERE pipe_spec_id = $1 ORDER BY fitting_type, main_size, reducing_size`,
      [specId]
    );
    return result.rows;
  },

  async bulkUpsertReducingRates(specId, rates) {
    if (!rates || rates.length === 0) return;
    const values = rates.map((r, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(', ');
    const params = [specId];
    for (const r of rates) {
      params.push(r.fitting_type, r.main_size, r.reducing_size, r.hours_per_unit);
    }
    await db.query(
      `INSERT INTO pipe_spec_reducing_rates (pipe_spec_id, fitting_type, main_size, reducing_size, hours_per_unit) VALUES ${values}
       ON CONFLICT (pipe_spec_id, fitting_type, main_size, reducing_size) DO UPDATE SET hours_per_unit = EXCLUDED.hours_per_unit`,
      params
    );
  },

  async lookupReducingRate(specId, fittingType, mainSize, reducingSize) {
    const result = await db.query(
      `SELECT hours_per_unit FROM pipe_spec_reducing_rates WHERE pipe_spec_id = $1 AND fitting_type = $2 AND main_size = $3 AND reducing_size = $4`,
      [specId, fittingType, mainSize, reducingSize]
    );
    return result.rows[0] || null;
  },

  // ─── Reducing Tee Rates ───

  async getReducingTeeRates(specId) {
    const result = await db.query(
      `SELECT * FROM pipe_spec_reducing_tee_rates WHERE pipe_spec_id = $1 ORDER BY main_size, branch_size`,
      [specId]
    );
    return result.rows;
  },

  async bulkUpsertReducingTeeRates(specId, rates) {
    if (!rates || rates.length === 0) return;
    const values = rates.map((r, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ');
    const params = [specId];
    for (const r of rates) {
      params.push(r.main_size, r.branch_size, r.hours_per_unit);
    }
    await db.query(
      `INSERT INTO pipe_spec_reducing_tee_rates (pipe_spec_id, main_size, branch_size, hours_per_unit) VALUES ${values}
       ON CONFLICT (pipe_spec_id, main_size, branch_size) DO UPDATE SET hours_per_unit = EXCLUDED.hours_per_unit`,
      params
    );
  },

  async lookupReducingTeeRate(specId, mainSize, branchSize) {
    const result = await db.query(
      `SELECT hours_per_unit FROM pipe_spec_reducing_tee_rates WHERE pipe_spec_id = $1 AND main_size = $2 AND branch_size = $3`,
      [specId, mainSize, branchSize]
    );
    return result.rows[0] || null;
  },

  // ─── Cross Reducing Rates ───

  async getCrossReducingRates(specId) {
    const result = await db.query(
      `SELECT * FROM pipe_spec_cross_reducing_rates WHERE pipe_spec_id = $1 ORDER BY main_size, reducing_size`,
      [specId]
    );
    return result.rows;
  },

  async bulkUpsertCrossReducingRates(specId, rates) {
    if (!rates || rates.length === 0) return;
    const values = rates.map((r, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ');
    const params = [specId];
    for (const r of rates) {
      params.push(r.main_size, r.reducing_size, r.hours_per_unit);
    }
    await db.query(
      `INSERT INTO pipe_spec_cross_reducing_rates (pipe_spec_id, main_size, reducing_size, hours_per_unit) VALUES ${values}
       ON CONFLICT (pipe_spec_id, main_size, reducing_size) DO UPDATE SET hours_per_unit = EXCLUDED.hours_per_unit`,
      params
    );
  },

  async lookupCrossReducingRate(specId, mainSize, reducingSize) {
    const result = await db.query(
      `SELECT hours_per_unit FROM pipe_spec_cross_reducing_rates WHERE pipe_spec_id = $1 AND main_size = $2 AND reducing_size = $3`,
      [specId, mainSize, reducingSize]
    );
    return result.rows[0] || null;
  },
};

module.exports = PipeSpec;
