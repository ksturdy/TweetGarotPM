const pool = require('../config/database');

const opportunities = {
  // Get all opportunities with stage and assigned user info
  async findAll(filters = {}) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (filters.stage_id) {
      conditions.push(`o.stage_id = $${paramCount++}`);
      params.push(filters.stage_id);
    }

    if (filters.assigned_to) {
      conditions.push(`o.assigned_to = $${paramCount++}`);
      params.push(filters.assigned_to);
    }

    if (filters.priority) {
      conditions.push(`o.priority = $${paramCount++}`);
      params.push(filters.priority);
    }

    if (filters.search) {
      conditions.push(`(o.title ILIKE $${paramCount} OR o.client_name ILIKE $${paramCount} OR o.client_company ILIKE $${paramCount})`);
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        o.*,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.probability as stage_probability,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        (SELECT COUNT(*) FROM opportunity_activities WHERE opportunity_id = o.id) as activity_count,
        (SELECT COUNT(*) FROM opportunity_activities WHERE opportunity_id = o.id AND is_completed = false AND activity_type = 'task') as open_tasks_count
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.assigned_to = u.id
      LEFT JOIN users creator ON o.created_by = creator.id
      ${whereClause}
      ORDER BY o.last_activity_at DESC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get opportunities grouped by stage (for Kanban view)
  async findByStages() {
    const query = `
      WITH opportunity_data AS (
        SELECT
          o.*,
          ps.name as stage_name,
          ps.color as stage_color,
          ps.display_order,
          u.first_name || ' ' || u.last_name as assigned_to_name,
          (SELECT COUNT(*) FROM opportunity_activities WHERE opportunity_id = o.id AND is_completed = false AND activity_type = 'task') as open_tasks_count
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        LEFT JOIN users u ON o.assigned_to = u.id
      )
      SELECT
        ps.id as stage_id,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.display_order,
        ps.probability,
        COALESCE(json_agg(
          json_build_object(
            'id', od.id,
            'title', od.title,
            'client_name', od.client_name,
            'client_company', od.client_company,
            'estimated_value', od.estimated_value,
            'priority', od.priority,
            'assigned_to', od.assigned_to,
            'assigned_to_name', od.assigned_to_name,
            'open_tasks_count', od.open_tasks_count,
            'created_at', od.created_at,
            'last_activity_at', od.last_activity_at
          ) ORDER BY od.last_activity_at DESC
        ) FILTER (WHERE od.id IS NOT NULL), '[]') as opportunities
      FROM pipeline_stages ps
      LEFT JOIN opportunity_data od ON ps.id = od.stage_id
      WHERE ps.is_active = true
      GROUP BY ps.id, ps.name, ps.color, ps.display_order, ps.probability
      ORDER BY ps.display_order
    `;

    const result = await pool.query(query);
    return result.rows;
  },

  // Get single opportunity with full details
  async findById(id) {
    const query = `
      SELECT
        o.*,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.probability as stage_probability,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        u.email as assigned_to_email,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        p.name as converted_project_name
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.assigned_to = u.id
      LEFT JOIN users creator ON o.created_by = creator.id
      LEFT JOIN projects p ON o.converted_to_project_id = p.id
      WHERE o.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  // Create new opportunity
  async create(opportunityData, userId) {
    const {
      title, description, estimated_value, estimated_start_date, estimated_duration_days,
      construction_type, project_type, location, stage_id, priority, assigned_to, source,
      market, owner, general_contractor, architect, engineer, campaign_id
    } = opportunityData;

    // Use construction_type if provided, otherwise fall back to project_type for backward compatibility
    const typeValue = construction_type || project_type;

    const query = `
      INSERT INTO opportunities (
        title, description, estimated_value, estimated_start_date, estimated_duration_days,
        construction_type, project_type, location, stage_id, priority, assigned_to, source,
        market, owner, general_contractor, architect, engineer, campaign_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const result = await pool.query(query, [
      title, description, estimated_value, estimated_start_date, estimated_duration_days,
      typeValue, typeValue, location, stage_id, priority, assigned_to, source,
      market, owner, general_contractor, architect, engineer, campaign_id, userId
    ]);

    return result.rows[0];
  },

  // Update opportunity
  async update(id, opportunityData) {
    const {
      title, description, estimated_value, estimated_start_date, estimated_duration_days,
      construction_type, project_type, location, stage_id, priority, assigned_to, probability, lost_reason,
      market, owner, general_contractor, architect, engineer, campaign_id
    } = opportunityData;

    // Use construction_type if provided, otherwise fall back to project_type for backward compatibility
    const typeValue = construction_type || project_type;

    const query = `
      UPDATE opportunities SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        estimated_value = COALESCE($3, estimated_value),
        estimated_start_date = COALESCE($4, estimated_start_date),
        estimated_duration_days = COALESCE($5, estimated_duration_days),
        construction_type = COALESCE($6, construction_type),
        project_type = COALESCE($7, project_type),
        location = COALESCE($8, location),
        stage_id = COALESCE($9, stage_id),
        priority = COALESCE($10, priority),
        assigned_to = COALESCE($11, assigned_to),
        probability = COALESCE($12, probability),
        lost_reason = COALESCE($13, lost_reason),
        market = COALESCE($14, market),
        owner = COALESCE($15, owner),
        general_contractor = COALESCE($16, general_contractor),
        architect = COALESCE($17, architect),
        engineer = COALESCE($18, engineer),
        campaign_id = $19,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `;

    const result = await pool.query(query, [
      title, description, estimated_value, estimated_start_date, estimated_duration_days,
      typeValue, typeValue, location, stage_id, priority, assigned_to, probability, lost_reason,
      market, owner, general_contractor, architect, engineer, campaign_id, id
    ]);

    return result.rows[0];
  },

  // Move opportunity to different stage
  async updateStage(id, stageId) {
    const query = `
      UPDATE opportunities
      SET stage_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [stageId, id]);
    return result.rows[0];
  },

  // Convert opportunity to project
  async convertToProject(id, projectId) {
    const query = `
      UPDATE opportunities
      SET
        converted_to_project_id = $1,
        converted_at = CURRENT_TIMESTAMP,
        stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Won' LIMIT 1),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [projectId, id]);
    return result.rows[0];
  },

  // Mark as lost
  async markAsLost(id, reason) {
    const query = `
      UPDATE opportunities
      SET
        lost_reason = $1,
        stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Lost' LIMIT 1),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [reason, id]);
    return result.rows[0];
  },

  // Delete opportunity
  async delete(id) {
    const query = 'DELETE FROM opportunities WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  // Get pipeline analytics
  async getAnalytics(filters = {}) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (filters.assigned_to) {
      conditions.push(`assigned_to = $${paramCount++}`);
      params.push(filters.assigned_to);
    }

    if (filters.date_from) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(filters.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        COUNT(*) as total_opportunities,
        SUM(estimated_value) as total_pipeline_value,
        SUM(CASE WHEN converted_to_project_id IS NOT NULL THEN estimated_value ELSE 0 END) as won_value,
        SUM(CASE WHEN stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Lost') THEN estimated_value ELSE 0 END) as lost_value,
        COUNT(CASE WHEN converted_to_project_id IS NOT NULL THEN 1 END) as won_count,
        COUNT(CASE WHEN stage_id = (SELECT id FROM pipeline_stages WHERE name = 'Lost') THEN 1 END) as lost_count,
        AVG(EXTRACT(DAY FROM (COALESCE(converted_at, CURRENT_TIMESTAMP) - created_at))) as avg_days_to_close
      FROM opportunities
      ${whereClause}
    `;

    const result = await pool.query(query, params);
    return result.rows[0];
  },

  // Get pipeline trend over time (monthly snapshots)
  async getPipelineTrend(months = 7) {
    const query = `
      WITH RECURSIVE months AS (
        -- Generate the last N months
        SELECT
          DATE_TRUNC('month', CURRENT_DATE - (generate_series(0, $1 - 1) || ' months')::interval) as month
      ),
      monthly_pipeline AS (
        SELECT
          DATE_TRUNC('month', o.created_at) as month,
          SUM(o.estimated_value) as pipeline_value,
          COUNT(*) as opportunity_count
        FROM opportunities o
        WHERE
          o.created_at >= DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::interval)
          AND o.stage_id != (SELECT id FROM pipeline_stages WHERE name = 'Lost' LIMIT 1)
        GROUP BY DATE_TRUNC('month', o.created_at)
      )
      SELECT
        TO_CHAR(m.month, 'Mon') as month_label,
        EXTRACT(YEAR FROM m.month) as year,
        EXTRACT(MONTH FROM m.month) as month_num,
        COALESCE(mp.pipeline_value, 0) as pipeline_value,
        COALESCE(mp.opportunity_count, 0) as opportunity_count
      FROM months m
      LEFT JOIN monthly_pipeline mp ON m.month = mp.month
      ORDER BY m.month ASC
    `;

    const result = await pool.query(query, [months]);
    return result.rows;
  }
};

module.exports = opportunities;
