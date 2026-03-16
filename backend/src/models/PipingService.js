const db = require('../config/database');

const PipingService = {
  async findAll(tenantId) {
    const result = await db.query(
      `SELECT * FROM piping_services WHERE tenant_id = $1 ORDER BY name`,
      [tenantId]
    );

    // Attach size rules to each service
    for (const service of result.rows) {
      service.size_rules = await this.getSizeRules(service.id);
    }
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT * FROM piping_services WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    const service = result.rows[0];
    if (!service) return null;
    service.size_rules = await this.getSizeRules(id);
    return service;
  },

  async create(tenantId, data) {
    const result = await db.query(
      `INSERT INTO piping_services (tenant_id, name, abbreviation, color, service_category, default_pipe_spec_id, fitting_types, valve_types, accessories)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, data.name, data.abbreviation, data.color || '#3b82f6',
       data.service_category, data.default_pipe_spec_id || null,
       JSON.stringify(data.fitting_types || []),
       JSON.stringify(data.valve_types || []),
       JSON.stringify(data.accessories || [])]
    );
    const service = result.rows[0];

    // Create size rules if provided
    if (data.size_rules && data.size_rules.length > 0) {
      for (let i = 0; i < data.size_rules.length; i++) {
        const rule = data.size_rules[i];
        await this.addSizeRule(service.id, {
          max_size_inches: rule.max_size_inches,
          pipe_spec_id: rule.pipe_spec_id,
          sort_order: i,
        });
      }
      service.size_rules = await this.getSizeRules(service.id);
    } else {
      service.size_rules = [];
    }

    return service;
  },

  async update(id, tenantId, data) {
    const fields = [];
    const params = [id, tenantId];
    let paramIdx = 3;

    const allowed = ['name', 'abbreviation', 'color', 'service_category', 'default_pipe_spec_id'];
    for (const field of allowed) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx++}`);
        params.push(data[field]);
      }
    }

    // JSONB fields need special handling
    for (const field of ['fitting_types', 'valve_types', 'accessories']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx++}`);
        params.push(JSON.stringify(data[field]));
      }
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    const result = await db.query(
      `UPDATE piping_services SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    const service = result.rows[0];
    if (service) {
      service.size_rules = await this.getSizeRules(id);
    }
    return service;
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM piping_services WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  // ─── Size Rules ───

  async getSizeRules(serviceId) {
    const result = await db.query(
      `SELECT sr.*, ps.name as pipe_spec_name
       FROM service_size_rules sr
       LEFT JOIN pipe_specs ps ON sr.pipe_spec_id = ps.id
       WHERE sr.piping_service_id = $1
       ORDER BY sr.max_size_inches ASC`,
      [serviceId]
    );
    return result.rows;
  },

  async addSizeRule(serviceId, rule) {
    const result = await db.query(
      `INSERT INTO service_size_rules (piping_service_id, max_size_inches, pipe_spec_id, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [serviceId, rule.max_size_inches, rule.pipe_spec_id, rule.sort_order || 0]
    );
    return result.rows[0];
  },

  async updateSizeRule(ruleId, data) {
    const fields = [];
    const params = [ruleId];
    let paramIdx = 2;

    for (const field of ['max_size_inches', 'pipe_spec_id', 'sort_order']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx++}`);
        params.push(data[field]);
      }
    }

    if (fields.length === 0) return null;

    const result = await db.query(
      `UPDATE service_size_rules SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async deleteSizeRule(ruleId) {
    const result = await db.query(
      `DELETE FROM service_size_rules WHERE id = $1 RETURNING id`,
      [ruleId]
    );
    return result.rows[0];
  },

  /**
   * Resolve which PipeSpec to use for a given pipe size within a service.
   * Returns the spec_id from the first matching size rule, or the default.
   */
  async resolveSpecForSize(serviceId, sizeInches) {
    // First try size rules (ordered by max_size ascending)
    const ruleResult = await db.query(
      `SELECT pipe_spec_id FROM service_size_rules
       WHERE piping_service_id = $1 AND max_size_inches >= $2
       ORDER BY max_size_inches ASC
       LIMIT 1`,
      [serviceId, sizeInches]
    );

    if (ruleResult.rows[0]) {
      return ruleResult.rows[0].pipe_spec_id;
    }

    // Fall back to default spec
    const serviceResult = await db.query(
      `SELECT default_pipe_spec_id FROM piping_services WHERE id = $1`,
      [serviceId]
    );

    return serviceResult.rows[0]?.default_pipe_spec_id || null;
  },
};

module.exports = PipingService;
