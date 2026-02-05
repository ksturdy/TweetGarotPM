const db = require('../config/database');

const Customer = {
  /**
   * Find all customers (global - use findAllByTenant for multi-tenant)
   */
  async findAll() {
    const result = await db.query(
      `SELECT * FROM customers ORDER BY customer_facility ASC`
    );
    return result.rows;
  },

  /**
   * Find all customers within a tenant
   */
  async findAllByTenant(tenantId) {
    const result = await db.query(
      `SELECT * FROM customers WHERE tenant_id = $1 ORDER BY customer_facility ASC`,
      [tenantId]
    );
    return result.rows;
  },

  /**
   * Count customers in a tenant (for limit checking)
   */
  async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM customers WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find customer by ID with tenant check
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  },

  async findByOwner(owner, tenantId) {
    const result = await db.query(
      'SELECT * FROM customers WHERE customer_owner ILIKE $1 AND tenant_id = $2 ORDER BY customer_facility ASC',
      [`%${owner}%`, tenantId]
    );
    return result.rows;
  },

  async search(searchTerm, tenantId) {
    const result = await db.query(
      `SELECT * FROM customers
       WHERE tenant_id = $1
         AND (customer_facility ILIKE $2
          OR customer_owner ILIKE $2
          OR city ILIKE $2
          OR state ILIKE $2)
       ORDER BY customer_facility ASC`,
      [tenantId, `%${searchTerm}%`]
    );
    return result.rows;
  },

  async create(data, tenantId) {
    const result = await db.query(
      `INSERT INTO customers (
        customer_facility, customer_owner, account_manager, field_leads,
        customer_number, address, city, state, zip_code,
        controls, department, market, customer_score, active_customer, notes, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        data.customer_facility, data.customer_owner, data.account_manager, data.field_leads,
        data.customer_number, data.address, data.city, data.state, data.zip_code,
        data.controls, data.department, data.market, data.customer_score, data.active_customer, data.notes,
        tenantId
      ]
    );
    return result.rows[0];
  },

  async bulkCreate(customers, tenantId) {
    const inserted = [];
    for (const customer of customers) {
      const result = await this.create(customer, tenantId);
      inserted.push(result);
    }
    return inserted;
  },

  async update(id, data, tenantId) {
    // Build dynamic update query for partial updates
    const allowedFields = [
      'customer_facility', 'customer_owner', 'account_manager', 'field_leads',
      'customer_number', 'address', 'city', 'state', 'zip_code',
      'controls', 'department', 'market', 'customer_score', 'active_customer', 'notes', 'favorite'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      // No fields to update, just return the existing record
      return this.findByIdAndTenant(id, tenantId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE customers SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING *
    `;
    values.push(id, tenantId);

    const result = await db.query(query, values);
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  },

  async deleteAll(tenantId) {
    await db.query('DELETE FROM customers WHERE tenant_id = $1', [tenantId]);
  },

  async getStats(tenantId) {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_customers,
        COUNT(CASE WHEN active_customer = true THEN 1 END) as active_customers,
        COUNT(DISTINCT customer_owner) as unique_owners,
        COUNT(DISTINCT account_manager) as account_managers,
        COUNT(DISTINCT state) as states_covered
      FROM customers
      WHERE tenant_id = $1
    `, [tenantId]);
    return result.rows[0];
  },

  async getMetrics(customerId, tenantId) {
    const result = await db.query(`
      SELECT
        c.customer_score,
        COUNT(DISTINCT p.id) as total_projects,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_projects,
        COUNT(DISTINCT e.id) as total_bids,
        COUNT(CASE WHEN e.status = 'won' THEN 1 END) as won_estimates,
        COUNT(CASE WHEN e.status IN ('won', 'lost') THEN 1 END) as decided_estimates,
        COALESCE(SUM(CASE WHEN e.status = 'won' THEN e.total_cost ELSE 0 END), 0) as total_revenue,
        CASE
          WHEN COUNT(DISTINCT e.id) > 0
          THEN ROUND((COUNT(CASE WHEN e.status = 'won' THEN 1 END)::numeric / COUNT(DISTINCT e.id)::numeric * 100), 2)
          ELSE 0
        END as hit_rate
      FROM customers c
      LEFT JOIN projects p ON p.customer_id = c.id
      LEFT JOIN estimates e ON e.customer_id = c.id
      WHERE c.id = $1 AND c.tenant_id = $2
      GROUP BY c.id, c.customer_score
    `, [customerId, tenantId]);

    return result.rows[0] || {
      customer_score: 0,
      total_projects: 0,
      completed_projects: 0,
      total_bids: 0,
      won_estimates: 0,
      decided_estimates: 0,
      total_revenue: 0,
      hit_rate: 0
    };
  },

  /**
   * Get enhanced metrics for a company (all facilities under same owner)
   * Optionally filter by specific facility_id
   */
  async getCompanyMetrics(customerOwner, tenantId, facilityId = null) {
    // Build facility filter - note: uses table name not alias in CTE
    const facilityFilter = facilityId ? 'AND customers.id = $3' : '';
    const params = facilityId ? [customerOwner, tenantId, facilityId] : [customerOwner, tenantId];

    const result = await db.query(`
      WITH customer_ids AS (
        SELECT id FROM customers
        WHERE customer_owner = $1 AND tenant_id = $2 ${facilityFilter}
      ),
      estimate_metrics AS (
        SELECT
          COUNT(DISTINCT e.id) as total_estimates,
          COUNT(CASE WHEN e.status = 'won' THEN 1 END) as won_estimates,
          COUNT(CASE WHEN e.status IN ('won', 'lost') THEN 1 END) as decided_estimates,
          COALESCE(SUM(CASE WHEN e.status = 'won' THEN e.total_cost ELSE 0 END), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN e.status = 'won' AND EXTRACT(YEAR FROM e.bid_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN e.total_cost ELSE 0 END), 0) as ytd_revenue,
          COALESCE(AVG(CASE WHEN e.status = 'won' THEN e.gross_margin_percentage END), 0) as avg_gm_percent,
          MIN(EXTRACT(YEAR FROM e.bid_date)) as first_year,
          MAX(EXTRACT(YEAR FROM e.bid_date)) as last_year
        FROM estimates e
        WHERE e.customer_id IN (SELECT id FROM customer_ids)
      ),
      project_metrics AS (
        SELECT
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(CASE WHEN p.status IN ('active', 'in_progress', 'Open') THEN 1 END) as active_projects,
          COUNT(CASE WHEN p.status IN ('completed', 'Hard-Closed') THEN 1 END) as completed_projects,
          COALESCE(SUM(p.contract_value), 0) as proj_contract_total,
          -- YTD: projects started this year OR projects with remaining backlog (active work)
          COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM p.start_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN p.contract_value ELSE 0 END), 0) as proj_ytd_revenue,
          -- Earned revenue = contract value - backlog (what's been billed/completed)
          COALESCE(SUM(p.contract_value - COALESCE(p.backlog, 0)), 0) as proj_earned_revenue,
          COALESCE(SUM(p.backlog), 0) as proj_backlog,
          -- Weighted average GM% by contract value
          CASE
            WHEN SUM(CASE WHEN p.gross_margin_percent IS NOT NULL THEN p.contract_value ELSE 0 END) > 0
            THEN SUM(CASE WHEN p.gross_margin_percent IS NOT NULL THEN p.gross_margin_percent * p.contract_value ELSE 0 END) /
                 SUM(CASE WHEN p.gross_margin_percent IS NOT NULL THEN p.contract_value ELSE 0 END)
            ELSE NULL
          END as proj_avg_gm_percent,
          MIN(EXTRACT(YEAR FROM p.start_date)) as proj_first_year,
          MAX(EXTRACT(YEAR FROM p.start_date)) as proj_last_year
        FROM projects p
        WHERE p.customer_id IN (SELECT id FROM customer_ids)
           OR p.owner_customer_id IN (SELECT id FROM customer_ids)
      ),
      work_order_metrics AS (
        SELECT
          COUNT(*) as total_work_orders,
          COUNT(CASE WHEN status NOT IN ('Closed', 'Complete', 'Completed') THEN 1 END) as open_work_orders,
          COALESCE(SUM(contract_amount), 0) as wo_contract_total,
          COALESCE(SUM(backlog), 0) as wo_backlog,
          COALESCE(SUM(billed_amount), 0) as wo_earned_revenue,
          COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM entered_date) = EXTRACT(YEAR FROM CURRENT_DATE) THEN contract_amount ELSE 0 END), 0) as wo_ytd_revenue,
          MIN(EXTRACT(YEAR FROM entered_date)) as wo_first_year,
          MAX(EXTRACT(YEAR FROM entered_date)) as wo_last_year
        FROM vp_work_orders
        WHERE tenant_id = $2 AND linked_customer_id IN (SELECT id FROM customer_ids)
      ),
      opportunity_metrics AS (
        SELECT
          COUNT(*) as total_opportunities,
          COALESCE(SUM(o.estimated_value), 0) as pipeline_value
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        WHERE o.customer_id IN (SELECT id FROM customer_ids)
          AND (ps.name IS NULL OR ps.name NOT IN ('Won', 'Lost'))
      )
      SELECT
        em.total_estimates,
        em.won_estimates,
        em.decided_estimates,
        em.total_revenue,
        -- Combined Earned Revenue (WO billed + Project completed work)
        (COALESCE(wm.wo_earned_revenue, 0) + COALESCE(pm.proj_earned_revenue, 0)) as earned_revenue,
        wm.wo_earned_revenue,
        pm.proj_earned_revenue,
        -- Keep YTD for reference (WO + Projects started this year)
        (wm.wo_ytd_revenue + pm.proj_ytd_revenue) as ytd_revenue,
        wm.wo_ytd_revenue,
        pm.proj_ytd_revenue,
        -- Combined GM%: weighted average from projects (if available), otherwise from estimates
        ROUND(COALESCE(pm.proj_avg_gm_percent, em.avg_gm_percent, 0)::numeric, 1) as avg_gm_percent,
        -- Separate GM% values for debugging/display
        ROUND(COALESCE(pm.proj_avg_gm_percent, 0)::numeric, 1) as proj_gm_percent,
        ROUND(COALESCE(em.avg_gm_percent, 0)::numeric, 1) as estimate_gm_percent,
        wm.wo_first_year as first_year,
        wm.wo_last_year as last_year,
        -- Year span for avg annual calculation
        CASE
          WHEN GREATEST(wm.wo_last_year, pm.proj_last_year) IS NOT NULL
               AND LEAST(wm.wo_first_year, pm.proj_first_year) IS NOT NULL
               AND GREATEST(wm.wo_last_year, pm.proj_last_year) > LEAST(wm.wo_first_year, pm.proj_first_year)
          THEN (GREATEST(wm.wo_last_year, pm.proj_last_year) - LEAST(wm.wo_first_year, pm.proj_first_year) + 1)
          ELSE 1
        END as year_span,
        -- Combined Avg Annual Revenue
        CASE
          WHEN GREATEST(wm.wo_last_year, pm.proj_last_year) IS NOT NULL
               AND LEAST(wm.wo_first_year, pm.proj_first_year) IS NOT NULL
               AND GREATEST(wm.wo_last_year, pm.proj_last_year) > LEAST(wm.wo_first_year, pm.proj_first_year)
          THEN ROUND(((wm.wo_contract_total + pm.proj_contract_total) /
               (GREATEST(wm.wo_last_year, pm.proj_last_year) - LEAST(wm.wo_first_year, pm.proj_first_year) + 1))::numeric, 0)
          ELSE (wm.wo_contract_total + pm.proj_contract_total)
        END as avg_annual_revenue,
        -- WO-only avg annual
        CASE
          WHEN wm.wo_last_year IS NOT NULL AND wm.wo_first_year IS NOT NULL AND wm.wo_last_year > wm.wo_first_year
          THEN ROUND((wm.wo_contract_total / (wm.wo_last_year - wm.wo_first_year + 1))::numeric, 0)
          ELSE wm.wo_contract_total
        END as wo_avg_annual_revenue,
        -- Project-only avg annual
        CASE
          WHEN pm.proj_last_year IS NOT NULL AND pm.proj_first_year IS NOT NULL AND pm.proj_last_year > pm.proj_first_year
          THEN ROUND((pm.proj_contract_total / (pm.proj_last_year - pm.proj_first_year + 1))::numeric, 0)
          ELSE pm.proj_contract_total
        END as proj_avg_annual_revenue,
        CASE
          WHEN em.total_estimates > 0
          THEN ROUND((em.won_estimates::numeric / em.total_estimates::numeric * 100), 1)
          ELSE 0
        END as hit_rate,
        pm.total_projects,
        pm.active_projects,
        pm.completed_projects,
        pm.proj_contract_total,
        pm.proj_earned_revenue,
        -- Combined backlog (WO + Projects)
        (COALESCE(wm.wo_backlog, 0) + COALESCE(pm.proj_backlog, 0)) as total_backlog,
        wm.total_work_orders,
        wm.open_work_orders,
        wm.wo_contract_total,
        wm.wo_backlog,
        pm.proj_backlog,
        om.total_opportunities,
        om.pipeline_value
      FROM estimate_metrics em, project_metrics pm, work_order_metrics wm, opportunity_metrics om
    `, params);

    return result.rows[0] || {
      total_estimates: 0,
      won_estimates: 0,
      decided_estimates: 0,
      total_revenue: 0,
      earned_revenue: 0,
      wo_earned_revenue: 0,
      ytd_revenue: 0,
      wo_ytd_revenue: 0,
      proj_ytd_revenue: 0,
      avg_gm_percent: 0,
      proj_gm_percent: 0,
      estimate_gm_percent: 0,
      year_span: 1,
      avg_annual_revenue: 0,
      wo_avg_annual_revenue: 0,
      proj_avg_annual_revenue: 0,
      hit_rate: 0,
      total_projects: 0,
      active_projects: 0,
      completed_projects: 0,
      proj_contract_total: 0,
      proj_earned_revenue: 0,
      total_backlog: 0,
      total_work_orders: 0,
      open_work_orders: 0,
      wo_contract_total: 0,
      wo_backlog: 0,
      proj_backlog: 0,
      total_opportunities: 0,
      pipeline_value: 0
    };
  },

  /**
   * Get all facilities for a company (same customer_owner)
   */
  async getFacilities(customerOwner, tenantId) {
    const result = await db.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM estimates WHERE customer_id = c.id) as estimate_count,
        (SELECT COUNT(*) FROM projects WHERE customer_id = c.id OR owner_customer_id = c.id) as project_count,
        (SELECT COUNT(*) FROM vp_work_orders WHERE linked_customer_id = c.id) as work_order_count
      FROM customers c
      WHERE c.customer_owner = $1 AND c.tenant_id = $2
      ORDER BY c.customer_facility ASC
    `, [customerOwner, tenantId]);
    return result.rows;
  },

  /**
   * Get work orders for a customer (or all customers under same owner)
   */
  async getWorkOrders(customerId, tenantId, includeAllFacilities = false) {
    if (includeAllFacilities) {
      // Get the customer_owner first, then fetch all work orders for all facilities
      const customerResult = await db.query(
        'SELECT customer_owner FROM customers WHERE id = $1 AND tenant_id = $2',
        [customerId, tenantId]
      );
      if (customerResult.rows.length === 0) return [];

      const customerOwner = customerResult.rows[0].customer_owner;
      const result = await db.query(`
        SELECT
          wo.id,
          wo.work_order_number,
          wo.description,
          wo.entered_date,
          wo.status,
          wo.contract_amount,
          wo.actual_cost,
          wo.billed_amount,
          wo.backlog,
          wo.project_manager_name,
          c.customer_facility
        FROM vp_work_orders wo
        JOIN customers c ON wo.linked_customer_id = c.id
        WHERE c.customer_owner = $1 AND wo.tenant_id = $2
        ORDER BY wo.entered_date DESC NULLS LAST, wo.work_order_number DESC
        LIMIT 50
      `, [customerOwner, tenantId]);
      return result.rows;
    } else {
      const result = await db.query(`
        SELECT
          id,
          work_order_number,
          description,
          entered_date,
          status,
          contract_amount,
          actual_cost,
          billed_amount,
          backlog,
          project_manager_name
        FROM vp_work_orders
        WHERE linked_customer_id = $1 AND tenant_id = $2
        ORDER BY entered_date DESC NULLS LAST, work_order_number DESC
        LIMIT 50
      `, [customerId, tenantId]);
      return result.rows;
    }
  },

  /**
   * Get projects for a customer (or all customers under same owner)
   * Includes projects where this company is either the GC (customer_id) or Owner (owner_customer_id)
   */
  async getProjectsForCompany(customerId, tenantId) {
    // Get the customer_owner first, then fetch all projects for all facilities
    const customerResult = await db.query(
      'SELECT customer_owner FROM customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenantId]
    );
    if (customerResult.rows.length === 0) return [];

    const customerOwner = customerResult.rows[0].customer_owner;
    const result = await db.query(`
      SELECT DISTINCT
        p.id,
        p.number,
        p.name,
        p.start_date as date,
        COALESCE(p.contract_value, 0) as contract_value,
        0 as gm_percent,
        p.status,
        p.description,
        COALESCE(gc.customer_facility, oc.customer_facility) as customer_facility,
        CASE
          WHEN oc.customer_owner = $1 AND (gc.customer_owner IS NULL OR gc.customer_owner != $1) THEN 'Owner'
          WHEN gc.customer_owner = $1 AND (oc.customer_owner IS NULL OR oc.customer_owner != $1) THEN 'GC'
          ELSE 'GC & Owner'
        END as relationship
      FROM projects p
      LEFT JOIN customers gc ON p.customer_id = gc.id
      LEFT JOIN customers oc ON p.owner_customer_id = oc.id
      WHERE p.tenant_id = $2
        AND (gc.customer_owner = $1 OR oc.customer_owner = $1)
      ORDER BY p.number DESC NULLS LAST
      LIMIT 50
    `, [customerOwner, tenantId]);
    return result.rows;
  },

  /**
   * Get estimates/bids for a company (all facilities under same owner)
   */
  async getBidsForCompany(customerId, tenantId) {
    const customerResult = await db.query(
      'SELECT customer_owner FROM customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenantId]
    );
    if (customerResult.rows.length === 0) return [];

    const customerOwner = customerResult.rows[0].customer_owner;
    const result = await db.query(`
      SELECT
        e.id,
        e.estimate_number || ' - ' || e.project_name as name,
        e.bid_date as date,
        e.total_cost as value,
        ROUND(COALESCE(e.gross_margin_percentage, 0)::numeric, 1) as gm_percent,
        e.building_type,
        e.status,
        c.customer_facility
      FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      WHERE c.customer_owner = $1 AND e.tenant_id = $2
      ORDER BY e.bid_date DESC NULLS LAST, e.created_at DESC
      LIMIT 50
    `, [customerOwner, tenantId]);
    return result.rows;
  },

  /**
   * Get opportunities for a company (all facilities under same owner)
   */
  async getOpportunitiesForCompany(customerId, tenantId) {
    const customerResult = await db.query(
      'SELECT customer_owner FROM customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenantId]
    );
    if (customerResult.rows.length === 0) return [];

    const customerOwner = customerResult.rows[0].customer_owner;
    const result = await db.query(`
      SELECT
        o.id,
        o.title,
        o.estimated_value,
        o.created_at,
        ps.name as stage_name,
        ps.color as stage_color,
        c.customer_facility
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      JOIN customers c ON o.customer_id = c.id
      WHERE c.customer_owner = $1 AND o.tenant_id = $2
      ORDER BY o.created_at DESC
      LIMIT 50
    `, [customerOwner, tenantId]);
    return result.rows;
  },

  async getProjects(customerId, tenantId) {
    const result = await db.query(`
      SELECT
        p.id,
        p.number,
        p.name,
        p.start_date as date,
        COALESCE(p.contract_value, 0) as contract_value,
        0 as gm_percent,
        p.status,
        p.description,
        CASE
          WHEN p.owner_customer_id = $1 AND p.customer_id != $1 THEN 'Owner'
          WHEN p.customer_id = $1 AND (p.owner_customer_id IS NULL OR p.owner_customer_id != $1) THEN 'GC'
          ELSE 'GC & Owner'
        END as relationship
      FROM projects p
      WHERE (p.customer_id = $1 OR p.owner_customer_id = $1) AND p.tenant_id = $2
      ORDER BY p.number DESC NULLS LAST
    `, [customerId, tenantId]);
    return result.rows;
  },

  async getBids(customerId, tenantId) {
    const result = await db.query(`
      SELECT
        e.id,
        e.estimate_number || ' - ' || e.project_name as name,
        e.bid_date as date,
        e.total_cost as value,
        ROUND(COALESCE(e.gross_margin_percentage, 0)::numeric, 1) as gm_percent,
        e.building_type,
        e.status
      FROM estimates e
      WHERE e.customer_id = $1 AND e.tenant_id = $2
      ORDER BY e.bid_date DESC NULLS LAST, e.created_at DESC
    `, [customerId, tenantId]);
    return result.rows;
  },

  async getTouchpoints(customerId) {
    const result = await db.query(`
      SELECT
        ct.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM customer_touchpoints ct
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.customer_id = $1
      ORDER BY ct.touchpoint_date DESC, ct.created_at DESC
    `, [customerId]);
    return result.rows;
  },

  async createTouchpoint(customerId, data) {
    const result = await db.query(`
      INSERT INTO customer_touchpoints (
        customer_id, touchpoint_date, touchpoint_type,
        contact_person, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      customerId,
      data.touchpoint_date,
      data.touchpoint_type,
      data.contact_person,
      data.notes,
      data.created_by
    ]);
    return result.rows[0];
  },

  async getAllContacts(tenantId) {
    const result = await db.query(`
      SELECT
        cc.*,
        c.customer_facility,
        c.customer_owner,
        c.city,
        c.state
      FROM customer_contacts cc
      LEFT JOIN customers c ON cc.customer_id = c.id
      WHERE cc.tenant_id = $1
      ORDER BY c.customer_facility ASC NULLS LAST, cc.is_primary DESC, cc.last_name ASC, cc.first_name ASC
    `, [tenantId]);
    return result.rows;
  },

  async getContacts(customerId) {
    const result = await db.query(`
      SELECT *
      FROM customer_contacts
      WHERE customer_id = $1
      ORDER BY is_primary DESC, last_name ASC, first_name ASC
    `, [customerId]);
    return result.rows;
  },

  async createContact(customerId, data, tenantId = null) {
    const result = await db.query(`
      INSERT INTO customer_contacts (
        customer_id, first_name, last_name, title,
        email, phone, mobile, is_primary, notes, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      customerId,
      data.first_name,
      data.last_name,
      data.title,
      data.email,
      data.phone,
      data.mobile,
      data.is_primary,
      data.notes,
      tenantId
    ]);
    return result.rows[0];
  },

  // Create contact without requiring a customer (standalone contact)
  async createStandaloneContact(data, tenantId) {
    const result = await db.query(`
      INSERT INTO customer_contacts (
        customer_id, first_name, last_name, title,
        email, phone, mobile, is_primary, notes, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      data.customer_id || null,
      data.first_name,
      data.last_name,
      data.title,
      data.email,
      data.phone,
      data.mobile,
      data.is_primary || false,
      data.notes,
      tenantId
    ]);
    return result.rows[0];
  },

  async updateContact(contactId, data) {
    const result = await db.query(`
      UPDATE customer_contacts SET
        customer_id = $1, first_name = $2, last_name = $3, title = $4,
        email = $5, phone = $6, mobile = $7, is_primary = $8, notes = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      data.customer_id !== undefined ? data.customer_id : null,
      data.first_name,
      data.last_name,
      data.title,
      data.email,
      data.phone,
      data.mobile,
      data.is_primary,
      data.notes,
      contactId
    ]);
    return result.rows[0];
  },

  // Get a single contact by ID with tenant check
  async getContactById(contactId, tenantId) {
    const result = await db.query(`
      SELECT cc.*, c.customer_facility, c.customer_owner
      FROM customer_contacts cc
      LEFT JOIN customers c ON cc.customer_id = c.id
      WHERE cc.id = $1 AND cc.tenant_id = $2
    `, [contactId, tenantId]);
    return result.rows[0];
  },

  async deleteContact(contactId) {
    await db.query('DELETE FROM customer_contacts WHERE id = $1', [contactId]);
  }
};

module.exports = Customer;
