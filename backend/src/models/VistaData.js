const db = require('../config/database');

const VistaData = {
  // ==================== IMPORT BATCHES ====================

  async createImportBatch(data, tenantId) {
    const result = await db.query(
      `INSERT INTO vp_import_batches (
        tenant_id, file_name, file_type, records_total, records_new,
        records_updated, records_auto_matched, imported_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        tenantId,
        data.file_name,
        data.file_type,
        data.records_total || 0,
        data.records_new || 0,
        data.records_updated || 0,
        data.records_auto_matched || 0,
        data.imported_by
      ]
    );
    return result.rows[0];
  },

  async updateImportBatch(id, data) {
    const result = await db.query(
      `UPDATE vp_import_batches SET
        records_total = COALESCE($1, records_total),
        records_new = COALESCE($2, records_new),
        records_updated = COALESCE($3, records_updated),
        records_auto_matched = COALESCE($4, records_auto_matched)
      WHERE id = $5
      RETURNING *`,
      [data.records_total, data.records_new, data.records_updated, data.records_auto_matched, id]
    );
    return result.rows[0];
  },

  async getImportHistory(tenantId, limit = 20) {
    const result = await db.query(
      `SELECT ib.*, u.first_name || ' ' || u.last_name as imported_by_name
       FROM vp_import_batches ib
       LEFT JOIN users u ON ib.imported_by = u.id
       WHERE ib.tenant_id = $1
       ORDER BY ib.imported_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  },

  // ==================== CONTRACTS ====================

  async upsertContract(data, tenantId, batchId = null) {
    // Check if contract already exists
    const existing = await db.query(
      'SELECT id, link_status, linked_project_id, linked_employee_id, linked_customer_id, linked_department_id FROM vp_contracts WHERE tenant_id = $1 AND contract_number = $2',
      [tenantId, data.contract_number]
    );

    if (existing.rows.length > 0) {
      // Update existing record, preserve links
      const result = await db.query(
        `UPDATE vp_contracts SET
          description = $1, status = $2, employee_number = $3, project_manager_name = $4,
          department_code = $5, orig_contract_amount = $6, contract_amount = $7,
          billed_amount = $8, received_amount = $9, backlog = $10, projected_revenue = $11,
          gross_profit_percent = $12, earned_revenue = $13, actual_cost = $14, projected_cost = $15,
          pf_hours_estimate = $16, pf_hours_jtd = $17, sm_hours_estimate = $18, sm_hours_jtd = $19,
          total_hours_estimate = $20, total_hours_jtd = $21, customer_number = $22, customer_name = $23,
          ship_city = $24, ship_state = $25, ship_zip = $26, primary_market = $27,
          negotiated_work = $28, delivery_method = $29, raw_data = $30, import_batch_id = $31,
          -- New fields
          material_jtd = $33, material_estimate = $34, material_projected = $35,
          subcontracts_jtd = $36, subcontracts_estimate = $37, subcontracts_projected = $38,
          rentals_jtd = $39, rentals_estimate = $40, rentals_projected = $41,
          mep_equip_jtd = $42, mep_equip_estimate = $43, mep_equip_projected = $44,
          pl_hours_estimate = $45, pl_hours_jtd = $46, pl_hours_projected = $47,
          pf_hours_projected = $48, sm_hours_projected = $49, total_hours_projected = $50,
          cash_flow = $51, gross_profit_dollars = $52, open_receivables = $53, current_est_cost = $54,
          pending_change_orders = $55, approved_changes = $56, change_order_count = $57,
          original_estimated_margin = $58, original_estimated_margin_pct = $59,
          actual_labor_rate = $60, estimated_labor_rate = $61, current_est_labor_cost = $62,
          ttl_labor_projected = $63, start_month = $64, month_closed = $65,
          ship_address = $66,
          imported_at = CURRENT_TIMESTAMP
        WHERE id = $32
        RETURNING *`,
        [
          data.description, data.status, data.employee_number, data.project_manager_name,
          data.department_code, data.orig_contract_amount, data.contract_amount,
          data.billed_amount, data.received_amount, data.backlog, data.projected_revenue,
          data.gross_profit_percent, data.earned_revenue, data.actual_cost, data.projected_cost,
          data.pf_hours_estimate, data.pf_hours_jtd, data.sm_hours_estimate, data.sm_hours_jtd,
          data.total_hours_estimate, data.total_hours_jtd, data.customer_number, data.customer_name,
          data.ship_city, data.ship_state, data.ship_zip, data.primary_market,
          data.negotiated_work, data.delivery_method, data.raw_data, batchId,
          existing.rows[0].id,
          // New fields
          data.material_jtd, data.material_estimate, data.material_projected,
          data.subcontracts_jtd, data.subcontracts_estimate, data.subcontracts_projected,
          data.rentals_jtd, data.rentals_estimate, data.rentals_projected,
          data.mep_equip_jtd, data.mep_equip_estimate, data.mep_equip_projected,
          data.pl_hours_estimate, data.pl_hours_jtd, data.pl_hours_projected,
          data.pf_hours_projected, data.sm_hours_projected, data.total_hours_projected,
          data.cash_flow, data.gross_profit_dollars, data.open_receivables, data.current_est_cost,
          data.pending_change_orders, data.approved_changes, data.change_order_count,
          data.original_estimated_margin, data.original_estimated_margin_pct,
          data.actual_labor_rate, data.estimated_labor_rate, data.current_est_labor_cost,
          data.ttl_labor_projected, data.start_month, data.month_closed,
          data.ship_address
        ]
      );
      return { record: result.rows[0], isNew: false };
    } else {
      // Insert new record
      const result = await db.query(
        `INSERT INTO vp_contracts (
          tenant_id, contract_number, description, status, employee_number,
          project_manager_name, department_code, orig_contract_amount, contract_amount,
          billed_amount, received_amount, backlog, projected_revenue, gross_profit_percent,
          earned_revenue, actual_cost, projected_cost, pf_hours_estimate, pf_hours_jtd,
          sm_hours_estimate, sm_hours_jtd, total_hours_estimate, total_hours_jtd,
          customer_number, customer_name, ship_address, ship_city, ship_state, ship_zip,
          primary_market, negotiated_work, delivery_method, raw_data, import_batch_id,
          material_jtd, material_estimate, material_projected,
          subcontracts_jtd, subcontracts_estimate, subcontracts_projected,
          rentals_jtd, rentals_estimate, rentals_projected,
          mep_equip_jtd, mep_equip_estimate, mep_equip_projected,
          pl_hours_estimate, pl_hours_jtd, pl_hours_projected,
          pf_hours_projected, sm_hours_projected, total_hours_projected,
          cash_flow, gross_profit_dollars, open_receivables, current_est_cost,
          pending_change_orders, approved_changes, change_order_count,
          original_estimated_margin, original_estimated_margin_pct,
          actual_labor_rate, estimated_labor_rate, current_est_labor_cost,
          ttl_labor_projected, start_month, month_closed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67)
        RETURNING *`,
        [
          tenantId, data.contract_number, data.description, data.status, data.employee_number,
          data.project_manager_name, data.department_code, data.orig_contract_amount, data.contract_amount,
          data.billed_amount, data.received_amount, data.backlog, data.projected_revenue, data.gross_profit_percent,
          data.earned_revenue, data.actual_cost, data.projected_cost, data.pf_hours_estimate, data.pf_hours_jtd,
          data.sm_hours_estimate, data.sm_hours_jtd, data.total_hours_estimate, data.total_hours_jtd,
          data.customer_number, data.customer_name, data.ship_address, data.ship_city, data.ship_state, data.ship_zip,
          data.primary_market, data.negotiated_work, data.delivery_method, data.raw_data, batchId,
          data.material_jtd, data.material_estimate, data.material_projected,
          data.subcontracts_jtd, data.subcontracts_estimate, data.subcontracts_projected,
          data.rentals_jtd, data.rentals_estimate, data.rentals_projected,
          data.mep_equip_jtd, data.mep_equip_estimate, data.mep_equip_projected,
          data.pl_hours_estimate, data.pl_hours_jtd, data.pl_hours_projected,
          data.pf_hours_projected, data.sm_hours_projected, data.total_hours_projected,
          data.cash_flow, data.gross_profit_dollars, data.open_receivables, data.current_est_cost,
          data.pending_change_orders, data.approved_changes, data.change_order_count,
          data.original_estimated_margin, data.original_estimated_margin_pct,
          data.actual_labor_rate, data.estimated_labor_rate, data.current_est_labor_cost,
          data.ttl_labor_projected, data.start_month, data.month_closed
        ]
      );
      return { record: result.rows[0], isNew: true };
    }
  },

  async getAllContracts(filters = {}, tenantId) {
    let query = `
      SELECT vc.*,
        p.name as linked_project_name,
        p.number as linked_project_number,
        e.first_name || ' ' || e.last_name as linked_employee_name,
        COALESCE(c.name, c.customer_owner) as linked_customer_name,
        c.customer_facility as linked_customer_facility,
        c.customer_owner as linked_customer_owner,
        d.name as linked_department_name,
        d.department_number as linked_department_number
      FROM vp_contracts vc
      LEFT JOIN projects p ON vc.linked_project_id = p.id
      LEFT JOIN employees e ON vc.linked_employee_id = e.id
      LEFT JOIN customers c ON vc.linked_customer_id = c.id
      LEFT JOIN departments d ON vc.linked_department_id = d.id
      WHERE vc.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (filters.link_status) {
      query += ` AND vc.link_status = $${paramCount}`;
      params.push(filters.link_status);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (vc.contract_number ILIKE $${paramCount} OR vc.description ILIKE $${paramCount} OR vc.customer_name ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND vc.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    query += ' ORDER BY vc.contract_number DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
      paramCount++;
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  async getContractById(id, tenantId) {
    const result = await db.query(
      `SELECT vc.*,
        p.name as linked_project_name,
        p.number as linked_project_number,
        e.first_name || ' ' || e.last_name as linked_employee_name,
        COALESCE(c.name, c.customer_owner) as linked_customer_name,
        c.customer_facility as linked_customer_facility,
        c.customer_owner as linked_customer_owner,
        d.name as linked_department_name
      FROM vp_contracts vc
      LEFT JOIN projects p ON vc.linked_project_id = p.id
      LEFT JOIN employees e ON vc.linked_employee_id = e.id
      LEFT JOIN customers c ON vc.linked_customer_id = c.id
      LEFT JOIN departments d ON vc.linked_department_id = d.id
      WHERE vc.id = $1 AND vc.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async getContractByProjectId(projectId, tenantId) {
    const result = await db.query(
      `SELECT vc.*,
        p.name as linked_project_name,
        p.number as linked_project_number,
        e.first_name || ' ' || e.last_name as linked_employee_name,
        COALESCE(c.name, c.customer_owner) as linked_customer_name,
        c.customer_facility as linked_customer_facility,
        c.customer_owner as linked_customer_owner,
        d.name as linked_department_name
      FROM vp_contracts vc
      LEFT JOIN projects p ON vc.linked_project_id = p.id
      LEFT JOIN employees e ON vc.linked_employee_id = e.id
      LEFT JOIN customers c ON vc.linked_customer_id = c.id
      LEFT JOIN departments d ON vc.linked_department_id = d.id
      WHERE vc.linked_project_id = $1 AND vc.tenant_id = $2`,
      [projectId, tenantId]
    );
    return result.rows[0];
  },

  async getUnmatchedContracts(tenantId) {
    return this.getAllContracts({ link_status: 'unmatched' }, tenantId);
  },

  async linkContract(id, linkData, userId, tenantId) {
    const result = await db.query(
      `UPDATE vp_contracts SET
        linked_project_id = $1,
        linked_employee_id = $2,
        linked_customer_id = $3,
        linked_department_id = $4,
        link_status = $5,
        link_confidence = $6,
        linked_at = CURRENT_TIMESTAMP,
        linked_by = $7
      WHERE id = $8 AND tenant_id = $9
      RETURNING *`,
      [
        linkData.project_id || null,
        linkData.employee_id || null,
        linkData.customer_id || null,
        linkData.department_id || null,
        linkData.link_status || 'manual_matched',
        linkData.confidence || 1.0,
        userId,
        id,
        tenantId
      ]
    );
    return result.rows[0];
  },

  async unlinkContract(id, tenantId) {
    const result = await db.query(
      `UPDATE vp_contracts SET
        linked_project_id = NULL,
        linked_employee_id = NULL,
        linked_customer_id = NULL,
        linked_department_id = NULL,
        link_status = 'unmatched',
        link_confidence = NULL,
        linked_at = NULL,
        linked_by = NULL
      WHERE id = $1 AND tenant_id = $2
      RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async ignoreContract(id, tenantId) {
    const result = await db.query(
      `UPDATE vp_contracts SET link_status = 'ignored'
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async updateProjectionOverrides(id, overrides, tenantId) {
    const result = await db.query(
      `UPDATE vp_contracts SET
        user_adjusted_end_months = $1,
        user_selected_contour = $2,
        updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [
        overrides.user_adjusted_end_months ?? null,
        overrides.user_selected_contour ?? null,
        id,
        tenantId
      ]
    );
    return result.rows[0];
  },

  // ==================== WORK ORDERS ====================

  async upsertWorkOrder(data, tenantId, batchId = null) {
    const existing = await db.query(
      'SELECT id, link_status, linked_employee_id, linked_customer_id, linked_department_id FROM vp_work_orders WHERE tenant_id = $1 AND work_order_number = $2',
      [tenantId, data.work_order_number]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE vp_work_orders SET
          description = $1,
          entered_date = $2,
          requested_date = $3,
          status = $4,
          employee_number = $5,
          project_manager_name = $6,
          department_code = $7,
          negotiated_work = $8,
          contract_amount = $9,
          actual_cost = $10,
          billed_amount = $11,
          received_amount = $12,
          backlog = $13,
          gross_profit_percent = $14,
          pf_hours_jtd = $15,
          sm_hours_jtd = $16,
          mep_jtd = $17,
          material_jtd = $18,
          subcontracts_jtd = $19,
          rentals_jtd = $20,
          customer_name = $21,
          city = $22,
          state = $23,
          zip = $24,
          primary_market = $25,
          raw_data = $26,
          import_batch_id = $27,
          imported_at = CURRENT_TIMESTAMP
        WHERE id = $28
        RETURNING *`,
        [
          data.description,
          data.entered_date,
          data.requested_date,
          data.status,
          data.employee_number,
          data.project_manager_name,
          data.department_code,
          data.negotiated_work,
          data.contract_amount,
          data.actual_cost,
          data.billed_amount,
          data.received_amount,
          data.backlog,
          data.gross_profit_percent,
          data.pf_hours_jtd,
          data.sm_hours_jtd,
          data.mep_jtd,
          data.material_jtd,
          data.subcontracts_jtd,
          data.rentals_jtd,
          data.customer_name,
          data.city,
          data.state,
          data.zip,
          data.primary_market,
          data.raw_data,
          batchId,
          existing.rows[0].id
        ]
      );
      return { record: result.rows[0], isNew: false };
    } else {
      const result = await db.query(
        `INSERT INTO vp_work_orders (
          tenant_id, work_order_number, description, entered_date, requested_date,
          status, employee_number, project_manager_name, department_code, negotiated_work,
          contract_amount, actual_cost, billed_amount, received_amount, backlog,
          gross_profit_percent, pf_hours_jtd, sm_hours_jtd, mep_jtd, material_jtd,
          subcontracts_jtd, rentals_jtd, customer_name, city, state, zip,
          primary_market, raw_data, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        RETURNING *`,
        [
          tenantId,
          data.work_order_number,
          data.description,
          data.entered_date,
          data.requested_date,
          data.status,
          data.employee_number,
          data.project_manager_name,
          data.department_code,
          data.negotiated_work,
          data.contract_amount,
          data.actual_cost,
          data.billed_amount,
          data.received_amount,
          data.backlog,
          data.gross_profit_percent,
          data.pf_hours_jtd,
          data.sm_hours_jtd,
          data.mep_jtd,
          data.material_jtd,
          data.subcontracts_jtd,
          data.rentals_jtd,
          data.customer_name,
          data.city,
          data.state,
          data.zip,
          data.primary_market,
          data.raw_data,
          batchId
        ]
      );
      return { record: result.rows[0], isNew: true };
    }
  },

  async getAllWorkOrders(filters = {}, tenantId) {
    let query = `
      SELECT vw.*,
        e.first_name || ' ' || e.last_name as linked_employee_name,
        COALESCE(c.name, c.customer_owner) as linked_customer_name,
        c.customer_facility as linked_customer_facility,
        c.customer_owner as linked_customer_owner,
        d.name as linked_department_name
      FROM vp_work_orders vw
      LEFT JOIN employees e ON vw.linked_employee_id = e.id
      LEFT JOIN customers c ON vw.linked_customer_id = c.id
      LEFT JOIN departments d ON vw.linked_department_id = d.id
      WHERE vw.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 2;

    if (filters.link_status) {
      query += ` AND vw.link_status = $${paramCount}`;
      params.push(filters.link_status);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (vw.work_order_number ILIKE $${paramCount} OR vw.description ILIKE $${paramCount} OR vw.customer_name ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.status) {
      query += ` AND vw.status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    query += ' ORDER BY vw.work_order_number DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
      paramCount++;
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  async getWorkOrderById(id, tenantId) {
    const result = await db.query(
      `SELECT vw.*,
        e.first_name || ' ' || e.last_name as linked_employee_name,
        COALESCE(c.name, c.customer_owner) as linked_customer_name,
        c.customer_facility as linked_customer_facility,
        c.customer_owner as linked_customer_owner,
        d.name as linked_department_name
      FROM vp_work_orders vw
      LEFT JOIN employees e ON vw.linked_employee_id = e.id
      LEFT JOIN customers c ON vw.linked_customer_id = c.id
      LEFT JOIN departments d ON vw.linked_department_id = d.id
      WHERE vw.id = $1 AND vw.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async getUnmatchedWorkOrders(tenantId) {
    return this.getAllWorkOrders({ link_status: 'unmatched' }, tenantId);
  },

  async linkWorkOrder(id, linkData, userId, tenantId) {
    const result = await db.query(
      `UPDATE vp_work_orders SET
        linked_employee_id = $1,
        linked_customer_id = $2,
        linked_department_id = $3,
        link_status = $4,
        link_confidence = $5,
        linked_at = CURRENT_TIMESTAMP,
        linked_by = $6
      WHERE id = $7 AND tenant_id = $8
      RETURNING *`,
      [
        linkData.employee_id || null,
        linkData.customer_id || null,
        linkData.department_id || null,
        linkData.link_status || 'manual_matched',
        linkData.confidence || 1.0,
        userId,
        id,
        tenantId
      ]
    );
    return result.rows[0];
  },

  async unlinkWorkOrder(id, tenantId) {
    const result = await db.query(
      `UPDATE vp_work_orders SET
        linked_employee_id = NULL,
        linked_customer_id = NULL,
        linked_department_id = NULL,
        link_status = 'unmatched',
        link_confidence = NULL,
        linked_at = NULL,
        linked_by = NULL
      WHERE id = $1 AND tenant_id = $2
      RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async ignoreWorkOrder(id, tenantId) {
    const result = await db.query(
      `UPDATE vp_work_orders SET link_status = 'ignored'
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  // ==================== EMPLOYEES ====================

  async upsertEmployee(data, batchId = null) {
    const existing = await db.query(
      'SELECT id, link_status, linked_employee_id FROM vp_employees WHERE employee_number = $1',
      [data.employee_number]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE vp_employees SET
          first_name = $1,
          last_name = $2,
          hire_date = $3,
          active = $4,
          raw_data = $5,
          import_batch_id = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *`,
        [
          data.first_name,
          data.last_name,
          data.hire_date,
          data.active,
          data.raw_data,
          batchId,
          existing.rows[0].id
        ]
      );
      return { record: result.rows[0], isNew: false };
    } else {
      const result = await db.query(
        `INSERT INTO vp_employees (
          employee_number, first_name, last_name, hire_date, active,
          raw_data, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          data.employee_number,
          data.first_name,
          data.last_name,
          data.hire_date,
          data.active,
          data.raw_data,
          batchId
        ]
      );
      return { record: result.rows[0], isNew: true };
    }
  },

  async getAllVPEmployees(filters = {}) {
    let query = `
      SELECT vpe.id, vpe.employee_number, vpe.first_name, vpe.last_name, vpe.hire_date,
        vpe.active, vpe.linked_employee_id, vpe.link_status, vpe.import_batch_id,
        vpe.created_at, vpe.updated_at, vpe.linked_at, vpe.linked_by,
        te.first_name || ' ' || te.last_name as linked_employee_name,
        te.employee_number as linked_employee_number
      FROM vp_employees vpe
      LEFT JOIN employees te ON vpe.linked_employee_id = te.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.active !== undefined) {
      query += ` AND vpe.active = $${paramCount}`;
      params.push(filters.active);
      paramCount++;
    }

    if (filters.link_status) {
      query += ` AND vpe.link_status = $${paramCount}`;
      params.push(filters.link_status);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (vpe.first_name ILIKE $${paramCount} OR vpe.last_name ILIKE $${paramCount} OR vpe.employee_number::text ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY vpe.last_name, vpe.first_name';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  async linkVPEmployee(id, linkData, userId) {
    // Check if this Titan employee is already linked to a different VP employee
    if (linkData.employee_id) {
      const existingLink = await db.query(
        `SELECT id, employee_number, first_name, last_name
         FROM vp_employees
         WHERE linked_employee_id = $1 AND id != $2`,
        [linkData.employee_id, id]
      );
      if (existingLink.rows.length > 0) {
        const existing = existingLink.rows[0];
        throw new Error(`This Titan employee is already linked to VP Employee #${existing.employee_number} (${existing.first_name} ${existing.last_name})`);
      }
    }

    const result = await db.query(
      `UPDATE vp_employees SET
        linked_employee_id = $1,
        link_status = 'manual_matched',
        linked_at = CURRENT_TIMESTAMP,
        linked_by = $2
      WHERE id = $3
      RETURNING *`,
      [linkData.employee_id || null, userId, id]
    );
    return result.rows[0];
  },

  async unlinkVPEmployee(id) {
    const result = await db.query(
      `UPDATE vp_employees SET
        linked_employee_id = NULL,
        link_status = 'unmatched',
        linked_at = NULL,
        linked_by = NULL
      WHERE id = $1
      RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  // ==================== CUSTOMERS ====================

  async upsertCustomer(data, batchId = null) {
    const existing = await db.query(
      'SELECT id, link_status, linked_customer_id FROM vp_customers WHERE customer_number = $1',
      [data.customer_number]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE vp_customers SET
          name = $1,
          address = $2,
          address2 = $3,
          city = $4,
          state = $5,
          zip = $6,
          active = $7,
          raw_data = $8,
          import_batch_id = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *`,
        [
          data.name,
          data.address,
          data.address2,
          data.city,
          data.state,
          data.zip,
          data.active,
          data.raw_data,
          batchId,
          existing.rows[0].id
        ]
      );
      return { record: result.rows[0], isNew: false };
    } else {
      const result = await db.query(
        `INSERT INTO vp_customers (
          customer_number, name, address, address2, city, state, zip,
          active, raw_data, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.customer_number,
          data.name,
          data.address,
          data.address2,
          data.city,
          data.state,
          data.zip,
          data.active,
          data.raw_data,
          batchId
        ]
      );
      return { record: result.rows[0], isNew: true };
    }
  },

  async getAllVPCustomers(filters = {}) {
    let query = `
      SELECT vpc.id, vpc.customer_number, vpc.name, vpc.address, vpc.address2,
        vpc.city, vpc.state, vpc.zip, vpc.active, vpc.linked_customer_id,
        vpc.link_status, vpc.import_batch_id, vpc.created_at, vpc.updated_at,
        vpc.linked_at, vpc.linked_by,
        COALESCE(tc.name, tc.customer_owner) as linked_customer_name,
        tc.customer_owner as linked_customer_owner,
        tc.customer_facility as linked_customer_facility
      FROM vp_customers vpc
      LEFT JOIN customers tc ON vpc.linked_customer_id = tc.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.active !== undefined) {
      query += ` AND vpc.active = $${paramCount}`;
      params.push(filters.active);
      paramCount++;
    }

    if (filters.link_status) {
      query += ` AND vpc.link_status = $${paramCount}`;
      params.push(filters.link_status);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (vpc.name ILIKE $${paramCount} OR vpc.customer_number::text ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY vpc.name';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  async linkVPCustomer(id, linkData, userId) {
    // Check if this Titan customer is already linked to a different VP customer
    if (linkData.customer_id) {
      const existingLink = await db.query(
        `SELECT id, customer_number, name
         FROM vp_customers
         WHERE linked_customer_id = $1 AND id != $2`,
        [linkData.customer_id, id]
      );
      if (existingLink.rows.length > 0) {
        const existing = existingLink.rows[0];
        throw new Error(`This Titan customer is already linked to VP Customer #${existing.customer_number} (${existing.name})`);
      }
    }

    const result = await db.query(
      `UPDATE vp_customers SET
        linked_customer_id = $1,
        link_status = 'manual_matched',
        linked_at = CURRENT_TIMESTAMP,
        linked_by = $2
      WHERE id = $3
      RETURNING *`,
      [linkData.customer_id || null, userId, id]
    );
    return result.rows[0];
  },

  async unlinkVPCustomer(id) {
    const result = await db.query(
      `UPDATE vp_customers SET
        linked_customer_id = NULL,
        link_status = 'unmatched',
        linked_at = NULL,
        linked_by = NULL
      WHERE id = $1
      RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  // ==================== VENDORS ====================

  async upsertVendor(data, batchId = null) {
    const existing = await db.query(
      'SELECT id, link_status, linked_vendor_id FROM vp_vendors WHERE vendor_number = $1',
      [data.vendor_number]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE vp_vendors SET
          name = $1,
          address = $2,
          address2 = $3,
          city = $4,
          state = $5,
          zip = $6,
          active = $7,
          raw_data = $8,
          import_batch_id = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING *`,
        [
          data.name,
          data.address,
          data.address2,
          data.city,
          data.state,
          data.zip,
          data.active,
          data.raw_data,
          batchId,
          existing.rows[0].id
        ]
      );
      return { record: result.rows[0], isNew: false };
    } else {
      const result = await db.query(
        `INSERT INTO vp_vendors (
          vendor_number, name, address, address2, city, state, zip,
          active, raw_data, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.vendor_number,
          data.name,
          data.address,
          data.address2,
          data.city,
          data.state,
          data.zip,
          data.active,
          data.raw_data,
          batchId
        ]
      );
      return { record: result.rows[0], isNew: true };
    }
  },

  async getAllVPVendors(filters = {}) {
    let query = `SELECT id, vendor_number, name, address, address2, city, state, zip,
      active, linked_vendor_id, link_status, import_batch_id, created_at, updated_at,
      linked_at, linked_by FROM vp_vendors WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (filters.active !== undefined) {
      query += ` AND active = $${paramCount}`;
      params.push(filters.active);
      paramCount++;
    }

    if (filters.link_status) {
      query += ` AND link_status = $${paramCount}`;
      params.push(filters.link_status);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (name ILIKE $${paramCount} OR vendor_number::text ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY name';

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  async linkVPVendor(id, linkData, userId) {
    // Check if this Titan vendor is already linked to a different VP vendor
    if (linkData.vendor_id) {
      const existingLink = await db.query(
        `SELECT id, vendor_number, name
         FROM vp_vendors
         WHERE linked_vendor_id = $1 AND id != $2`,
        [linkData.vendor_id, id]
      );
      if (existingLink.rows.length > 0) {
        const existing = existingLink.rows[0];
        throw new Error(`This Titan vendor is already linked to VP Vendor #${existing.vendor_number} (${existing.name})`);
      }
    }

    const result = await db.query(
      `UPDATE vp_vendors SET
        linked_vendor_id = $1,
        link_status = 'manual_matched',
        linked_at = CURRENT_TIMESTAMP,
        linked_by = $2
      WHERE id = $3
      RETURNING *`,
      [linkData.vendor_id || null, userId, id]
    );
    return result.rows[0];
  },

  async unlinkVPVendor(id) {
    const result = await db.query(
      `UPDATE vp_vendors SET
        linked_vendor_id = NULL,
        link_status = 'unmatched',
        linked_at = NULL,
        linked_by = NULL
      WHERE id = $1
      RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  // ==================== AUTO-MATCHING ====================

  async autoMatchContracts(tenantId) {
    const client = await db.getClient();
    let matched = 0;

    try {
      await client.query('BEGIN');

      // Get unmatched contracts
      const unmatched = await client.query(
        'SELECT * FROM vp_contracts WHERE tenant_id = $1 AND link_status = $2',
        [tenantId, 'unmatched']
      );

      for (const contract of unmatched.rows) {
        const links = {};
        let totalConfidence = 0;
        let linkCount = 0;

        // Match by employee_number
        if (contract.employee_number) {
          const employee = await client.query(
            'SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2',
            [tenantId, contract.employee_number]
          );
          if (employee.rows.length > 0) {
            links.linked_employee_id = employee.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        // Match by department_code
        if (contract.department_code) {
          const dept = await client.query(
            'SELECT id FROM departments WHERE tenant_id = $1 AND department_number = $2',
            [tenantId, contract.department_code]
          );
          if (dept.rows.length > 0) {
            links.linked_department_id = dept.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        // Match by customer_name (exact match on name)
        if (contract.customer_name) {
          const customer = await client.query(
            'SELECT id FROM customers WHERE tenant_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(customer_owner) = LOWER($2))',
            [tenantId, contract.customer_name]
          );
          if (customer.rows.length > 0) {
            links.linked_customer_id = customer.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        // Match by contract_number to project.number
        if (contract.contract_number) {
          const project = await client.query(
            'SELECT id FROM projects WHERE tenant_id = $1 AND number = $2',
            [tenantId, contract.contract_number]
          );
          if (project.rows.length > 0) {
            links.linked_project_id = project.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        // If we found any matches, update the contract
        if (linkCount > 0) {
          const avgConfidence = totalConfidence / linkCount;
          await client.query(
            `UPDATE vp_contracts SET
              linked_project_id = COALESCE($1, linked_project_id),
              linked_employee_id = COALESCE($2, linked_employee_id),
              linked_customer_id = COALESCE($3, linked_customer_id),
              linked_department_id = COALESCE($4, linked_department_id),
              link_status = 'auto_matched',
              link_confidence = $5,
              linked_at = CURRENT_TIMESTAMP
            WHERE id = $6`,
            [
              links.linked_project_id || null,
              links.linked_employee_id || null,
              links.linked_customer_id || null,
              links.linked_department_id || null,
              avgConfidence,
              contract.id
            ]
          );
          matched++;
        }
      }

      await client.query('COMMIT');
      return { matched, total: unmatched.rows.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async autoMatchWorkOrders(tenantId) {
    const client = await db.getClient();
    let matched = 0;

    try {
      await client.query('BEGIN');

      const unmatched = await client.query(
        'SELECT * FROM vp_work_orders WHERE tenant_id = $1 AND link_status = $2',
        [tenantId, 'unmatched']
      );

      for (const wo of unmatched.rows) {
        const links = {};
        let totalConfidence = 0;
        let linkCount = 0;

        // Match by employee_number
        if (wo.employee_number) {
          const employee = await client.query(
            'SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2',
            [tenantId, wo.employee_number]
          );
          if (employee.rows.length > 0) {
            links.linked_employee_id = employee.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        // Match by department_code
        if (wo.department_code) {
          const dept = await client.query(
            'SELECT id FROM departments WHERE tenant_id = $1 AND department_number = $2',
            [tenantId, wo.department_code]
          );
          if (dept.rows.length > 0) {
            links.linked_department_id = dept.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        // Match by customer_name
        if (wo.customer_name) {
          const customer = await client.query(
            'SELECT id FROM customers WHERE tenant_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(customer_owner) = LOWER($2))',
            [tenantId, wo.customer_name]
          );
          if (customer.rows.length > 0) {
            links.linked_customer_id = customer.rows[0].id;
            totalConfidence += 1.0;
            linkCount++;
          }
        }

        if (linkCount > 0) {
          const avgConfidence = totalConfidence / linkCount;
          await client.query(
            `UPDATE vp_work_orders SET
              linked_employee_id = COALESCE($1, linked_employee_id),
              linked_customer_id = COALESCE($2, linked_customer_id),
              linked_department_id = COALESCE($3, linked_department_id),
              link_status = 'auto_matched',
              link_confidence = $4,
              linked_at = CURRENT_TIMESTAMP
            WHERE id = $5`,
            [
              links.linked_employee_id || null,
              links.linked_customer_id || null,
              links.linked_department_id || null,
              avgConfidence,
              wo.id
            ]
          );
          matched++;
        }
      }

      await client.query('COMMIT');
      return { matched, total: unmatched.rows.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // ==================== STATS & AGGREGATIONS ====================

  async getStats(tenantId) {
    const result = await db.query(`
      SELECT
        -- Vista Contracts
        (SELECT COUNT(*) FROM vp_contracts WHERE tenant_id = $1) as vista_contracts,
        (SELECT COUNT(*) FROM vp_contracts WHERE tenant_id = $1 AND link_status = 'unmatched') as unmatched_contracts,
        (SELECT COUNT(*) FROM vp_contracts WHERE tenant_id = $1 AND link_status IN ('auto_matched', 'manual_matched')) as matched_contracts,
        -- Titan Projects (contracts link to projects)
        (SELECT COUNT(*) FROM projects WHERE tenant_id = $1) as titan_projects,
        (SELECT COUNT(*) FROM projects p WHERE tenant_id = $1 AND EXISTS (SELECT 1 FROM vp_contracts vc WHERE vc.linked_project_id = p.id)) as titan_projects_linked,

        -- Vista Work Orders
        (SELECT COUNT(*) FROM vp_work_orders WHERE tenant_id = $1) as vista_work_orders,
        (SELECT COUNT(*) FROM vp_work_orders WHERE tenant_id = $1 AND link_status = 'unmatched') as unmatched_work_orders,
        (SELECT COUNT(*) FROM vp_work_orders WHERE tenant_id = $1 AND link_status IN ('auto_matched', 'manual_matched')) as matched_work_orders,

        -- Vista Employees
        (SELECT COUNT(*) FROM vp_employees) as vista_employees,
        (SELECT COUNT(*) FROM vp_employees WHERE active = true) as active_employees,
        (SELECT COUNT(*) FROM vp_employees WHERE linked_employee_id IS NOT NULL) as linked_employees,
        -- Titan Employees
        (SELECT COUNT(*) FROM employees WHERE tenant_id = $1) as titan_employees,
        (SELECT COUNT(*) FROM employees e WHERE tenant_id = $1 AND EXISTS (SELECT 1 FROM vp_employees ve WHERE ve.linked_employee_id = e.id)) as titan_employees_linked,

        -- Vista Customers
        (SELECT COUNT(*) FROM vp_customers) as vista_customers,
        (SELECT COUNT(*) FROM vp_customers WHERE active = true) as active_customers,
        (SELECT COUNT(*) FROM vp_customers WHERE linked_customer_id IS NOT NULL) as linked_customers,
        -- Titan Customers (count all records to match Vista)
        (SELECT COUNT(*) FROM customers WHERE tenant_id = $1) as titan_customers,
        (SELECT COUNT(*) FROM customers c WHERE c.tenant_id = $1 AND EXISTS (SELECT 1 FROM vp_customers vc WHERE vc.linked_customer_id = c.id)) as titan_customers_linked,

        -- Vista Vendors
        (SELECT COUNT(*) FROM vp_vendors) as vista_vendors,
        (SELECT COUNT(*) FROM vp_vendors WHERE active = true) as active_vendors,
        (SELECT COUNT(*) FROM vp_vendors WHERE linked_vendor_id IS NOT NULL) as linked_vendors,
        -- Titan Vendors
        (SELECT COUNT(*) FROM vendors WHERE tenant_id = $1) as titan_vendors,
        (SELECT COUNT(*) FROM vendors v WHERE tenant_id = $1 AND EXISTS (SELECT 1 FROM vp_vendors vv WHERE vv.linked_vendor_id = v.id)) as titan_vendors_linked,

        -- Vista Departments (unique department codes from contracts)
        (SELECT COUNT(DISTINCT department_code) FROM vp_contracts WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '') as vista_departments,
        -- Linked departments = unique department codes that have a linked_department_id
        (SELECT COUNT(DISTINCT department_code) FROM vp_contracts WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '' AND linked_department_id IS NOT NULL) as linked_departments,
        -- Titan Departments
        (SELECT COUNT(*) FROM departments WHERE tenant_id = $1) as titan_departments,

        -- Import timestamps
        (SELECT MAX(imported_at) FROM vp_import_batches WHERE tenant_id = $1 AND file_type = 'contracts') as last_contracts_import,
        (SELECT MAX(imported_at) FROM vp_import_batches WHERE tenant_id = $1 AND file_type = 'work_orders') as last_work_orders_import,
        (SELECT MAX(imported_at) FROM vp_import_batches WHERE file_type = 'employees') as last_employees_import,
        (SELECT MAX(imported_at) FROM vp_import_batches WHERE file_type = 'customers') as last_customers_import,
        (SELECT MAX(imported_at) FROM vp_import_batches WHERE file_type = 'vendors') as last_vendors_import,

        -- Legacy field names for backwards compatibility
        (SELECT COUNT(*) FROM vp_contracts WHERE tenant_id = $1) as total_contracts,
        (SELECT COUNT(*) FROM vp_work_orders WHERE tenant_id = $1) as total_work_orders,
        (SELECT COUNT(*) FROM vp_employees) as total_employees,
        (SELECT COUNT(*) FROM vp_customers) as total_customers,
        (SELECT COUNT(*) FROM vp_vendors) as total_vendors
    `, [tenantId]);
    return result.rows[0];
  },

  async getCustomerVistaData(customerId, tenantId) {
    const contracts = await db.query(
      `SELECT * FROM vp_contracts
       WHERE tenant_id = $1 AND linked_customer_id = $2
       ORDER BY contract_number DESC`,
      [tenantId, customerId]
    );

    const workOrders = await db.query(
      `SELECT * FROM vp_work_orders
       WHERE tenant_id = $1 AND linked_customer_id = $2
       ORDER BY work_order_number DESC`,
      [tenantId, customerId]
    );

    // Calculate totals
    const contractTotals = await db.query(
      `SELECT
        COALESCE(SUM(contract_amount), 0) as total_contract_amount,
        COALESCE(SUM(backlog), 0) as total_backlog,
        COUNT(*) as count
       FROM vp_contracts
       WHERE tenant_id = $1 AND linked_customer_id = $2`,
      [tenantId, customerId]
    );

    const workOrderTotals = await db.query(
      `SELECT
        COALESCE(SUM(contract_amount), 0) as total_contract_amount,
        COALESCE(SUM(backlog), 0) as total_backlog,
        COUNT(*) as count
       FROM vp_work_orders
       WHERE tenant_id = $1 AND linked_customer_id = $2`,
      [tenantId, customerId]
    );

    return {
      contracts: contracts.rows,
      workOrders: workOrders.rows,
      contractTotals: contractTotals.rows[0],
      workOrderTotals: workOrderTotals.rows[0]
    };
  },

  async getProjectVistaData(projectId, tenantId) {
    const contract = await db.query(
      `SELECT * FROM vp_contracts
       WHERE tenant_id = $1 AND linked_project_id = $2`,
      [tenantId, projectId]
    );
    return contract.rows[0] || null;
  },

  async getEmployeeVistaData(employeeId, tenantId) {
    const contracts = await db.query(
      `SELECT * FROM vp_contracts
       WHERE tenant_id = $1 AND linked_employee_id = $2
       ORDER BY contract_number DESC`,
      [tenantId, employeeId]
    );

    const workOrders = await db.query(
      `SELECT * FROM vp_work_orders
       WHERE tenant_id = $1 AND linked_employee_id = $2
       ORDER BY work_order_number DESC`,
      [tenantId, employeeId]
    );

    return {
      contracts: contracts.rows,
      workOrders: workOrders.rows
    };
  },

  // ==================== DUPLICATES / SIMILARITY DETECTION ====================

  // Simple string similarity using Dice coefficient
  _calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0;

    // Create bigrams
    const getBigrams = (str) => {
      const bigrams = new Set();
      for (let i = 0; i < str.length - 1; i++) {
        bigrams.add(str.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigrams1 = getBigrams(s1);
    const bigrams2 = getBigrams(s2);

    let intersection = 0;
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram)) intersection++;
    }

    return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
  },

  // Find potential employee duplicates between VP and Titan
  async findEmployeeDuplicates(tenantId, minSimilarity = 0.5) {
    // Get all unlinked VP employees
    const vpEmployees = await db.query(
      `SELECT id, employee_number, first_name, last_name, active
       FROM vp_employees
       WHERE link_status = 'unmatched'
       ORDER BY last_name, first_name`
    );

    // Get Titan employees that are NOT already linked to a VP employee
    const titanEmployees = await db.query(
      `SELECT e.id, e.employee_number, e.first_name, e.last_name
       FROM employees e
       LEFT JOIN vp_employees vpe ON vpe.linked_employee_id = e.id
       WHERE e.tenant_id = $1 AND vpe.id IS NULL
       ORDER BY e.last_name, e.first_name`,
      [tenantId]
    );

    const duplicates = [];

    for (const vpEmp of vpEmployees.rows) {
      const vpFullName = `${vpEmp.first_name || ''} ${vpEmp.last_name || ''}`.trim();
      const matches = [];

      for (const titanEmp of titanEmployees.rows) {
        const titanFullName = `${titanEmp.first_name || ''} ${titanEmp.last_name || ''}`.trim();

        // Calculate similarity
        const nameSimilarity = this._calculateSimilarity(vpFullName, titanFullName);

        // Also check if last names match exactly (common case)
        const lastNameMatch = vpEmp.last_name && titanEmp.last_name &&
          vpEmp.last_name.toLowerCase() === titanEmp.last_name.toLowerCase();

        // Boost score if last names match
        const finalSimilarity = lastNameMatch ? Math.max(nameSimilarity, 0.7) : nameSimilarity;

        if (finalSimilarity >= minSimilarity) {
          matches.push({
            titan_id: titanEmp.id,
            titan_employee_number: titanEmp.employee_number,
            titan_name: titanFullName,
            similarity: Math.round(finalSimilarity * 100) / 100,
            last_name_match: lastNameMatch
          });
        }
      }

      // Sort matches by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        duplicates.push({
          vp_id: vpEmp.id,
          vp_employee_number: vpEmp.employee_number,
          vp_name: vpFullName,
          vp_active: vpEmp.active,
          potential_matches: matches.slice(0, 5) // Top 5 matches
        });
      }
    }

    // Sort by highest match similarity
    duplicates.sort((a, b) => {
      const aMax = a.potential_matches[0]?.similarity || 0;
      const bMax = b.potential_matches[0]?.similarity || 0;
      return bMax - aMax;
    });

    return duplicates;
  },

  // Find potential customer duplicates between VP and Titan
  // findCustomerDuplicates removed — customers are now synced by customer_number, no fuzzy matching needed
  async findCustomerDuplicates(tenantId, minSimilarity = 0.5) {
    // Return empty array for backward compat — customer linking is now handled by syncCustomersToTitan
    return [];
  },

  // Import unmatched VP employees as new Titan employees
  async importUnmatchedEmployeesToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP employees
      const unlinked = await client.query(
        `SELECT id, employee_number, first_name, last_name, hire_date, active
         FROM vp_employees
         WHERE link_status = 'unmatched'
         ORDER BY last_name, first_name`
      );

      for (const vpEmp of unlinked.rows) {
        await client.query('SAVEPOINT import_emp_row');
        try {
          // Generate email as firstname.lastname@tweetgarot.com
          const firstName = (vpEmp.first_name || '').trim().toLowerCase().replace(/[^a-z]/g, '');
          const lastName = (vpEmp.last_name || '').trim().toLowerCase().replace(/[^a-z]/g, '');
          let email = `${firstName}.${lastName}@tweetgarot.com`;

          // Check for duplicate email and append employee number if needed
          const existing = await client.query(
            `SELECT id FROM employees WHERE email = $1 AND tenant_id = $2`,
            [email, tenantId]
          );
          if (existing.rows.length > 0) {
            email = `${firstName}.${lastName}${vpEmp.employee_number || vpEmp.id}@tweetgarot.com`;
          }

          // Create new Titan employee
          const newEmployee = await client.query(
            `INSERT INTO employees (
              tenant_id, employee_number, first_name, last_name, email, hire_date, employment_status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id`,
            [
              tenantId,
              vpEmp.employee_number ? String(vpEmp.employee_number) : null,
              vpEmp.first_name || '',
              vpEmp.last_name || '',
              email,
              vpEmp.hire_date,
              vpEmp.active ? 'active' : 'inactive'
            ]
          );

          // Link the VP employee to the new Titan employee
          await client.query(
            `UPDATE vp_employees SET
              linked_employee_id = $1,
              link_status = 'manual_matched',
              linked_at = CURRENT_TIMESTAMP,
              linked_by = $2
            WHERE id = $3`,
            [newEmployee.rows[0].id, userId, vpEmp.id]
          );

          await client.query('RELEASE SAVEPOINT import_emp_row');

          imported++;
          results.push({
            vp_id: vpEmp.id,
            titan_id: newEmployee.rows[0].id,
            name: `${vpEmp.first_name} ${vpEmp.last_name}`.trim()
          });
        } catch (rowError) {
          await client.query('ROLLBACK TO SAVEPOINT import_emp_row');
          console.error(`[Vista Import] Failed to import employee ${vpEmp.first_name} ${vpEmp.last_name}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');
      return { imported, total: unlinked.rows.length, results };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Sync ALL VP customers to Titan customers (Vista is source of truth)
  // Creates new customers or updates existing ones by customer_number
  async syncCustomersToTitan(tenantId, userId) {
    const client = await db.getClient();
    let created = 0;
    let updated = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get ALL VP customers (not just unmatched)
      const vpCustomers = await client.query(
        `SELECT id, customer_number, name, address, address2, city, state, zip, active
         FROM vp_customers
         ORDER BY name`
      );

      for (const vpCust of vpCustomers.rows) {
        await client.query('SAVEPOINT sync_cust_row');
        try {
          // Try to find existing Titan customer by customer_number
          const existing = await client.query(
            `SELECT id FROM customers
             WHERE tenant_id = $1 AND customer_number = $2`,
            [tenantId, String(vpCust.customer_number)]
          );

          let titanId;

          if (existing.rows.length > 0) {
            // Update existing customer with Vista data (only Vista-owned fields)
            titanId = existing.rows[0].id;
            await client.query(
              `UPDATE customers SET
                name = $2,
                address = COALESCE(NULLIF($3, ''), address),
                city = COALESCE(NULLIF($4, ''), city),
                state = COALESCE(NULLIF($5, ''), state),
                zip_code = COALESCE(NULLIF($6, ''), zip_code),
                active_customer = $7,
                source = 'vista',
                vp_customer_id = $8,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1`,
              [
                titanId,
                vpCust.name || 'Unknown',
                vpCust.address || '',
                vpCust.city || '',
                vpCust.state || '',
                vpCust.zip || '',
                vpCust.active,
                vpCust.id
              ]
            );
            updated++;
          } else {
            // Create new Titan customer from Vista data
            const newCustomer = await client.query(
              `INSERT INTO customers (
                tenant_id, name, customer_owner, customer_number, address, city, state, zip_code,
                active_customer, source, vp_customer_id, created_at, updated_at
              ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, 'vista', $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              RETURNING id`,
              [
                tenantId,
                vpCust.name || 'Unknown',
                String(vpCust.customer_number),
                vpCust.address || '',
                vpCust.city || '',
                vpCust.state || '',
                vpCust.zip || '',
                vpCust.active,
                vpCust.id
              ]
            );
            titanId = newCustomer.rows[0].id;
            created++;
          }

          // Link the VP customer to the Titan customer
          await client.query(
            `UPDATE vp_customers SET
              linked_customer_id = $1,
              link_status = 'auto_matched',
              linked_at = CURRENT_TIMESTAMP,
              linked_by = $2
            WHERE id = $3`,
            [titanId, userId, vpCust.id]
          );

          await client.query('RELEASE SAVEPOINT sync_cust_row');
          results.push({ vp_id: vpCust.id, titan_id: titanId, name: vpCust.name });
        } catch (rowError) {
          await client.query('ROLLBACK TO SAVEPOINT sync_cust_row');
          console.error(`[Vista Sync] Failed to sync customer ${vpCust.name}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');
      return { created, updated, total: vpCustomers.rows.length, results };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // updateCustomerFacility removed — facility concept no longer used; Vista sync handles customer updates

  // Get duplicates summary stats
  async getDuplicatesStats(tenantId) {
    const employeeDuplicates = await this.findEmployeeDuplicates(tenantId);

    // Count unlinked VP customers (customers are now synced by customer_number, no fuzzy matching needed)
    const unlinkedCustomers = await db.query(
      `SELECT COUNT(*) as count FROM vp_customers WHERE link_status = 'unmatched'`
    );

    return {
      employees: {
        total_unlinked: employeeDuplicates.length,
        with_high_confidence: employeeDuplicates.filter(d => d.potential_matches[0]?.similarity >= 0.8).length,
        with_medium_confidence: employeeDuplicates.filter(d => {
          const sim = d.potential_matches[0]?.similarity;
          return sim >= 0.6 && sim < 0.8;
        }).length,
        with_low_confidence: employeeDuplicates.filter(d => {
          const sim = d.potential_matches[0]?.similarity;
          return sim >= 0.5 && sim < 0.6;
        }).length
      },
      customers: {
        total_unlinked: parseInt(unlinkedCustomers.rows[0].count) || 0
      }
    };
  },

  // Find potential contract matches between VP contracts and Titan projects
  async findContractDuplicates(tenantId, minSimilarity = 0.5) {
    // Get all unlinked VP contracts
    const vpContracts = await db.query(
      `SELECT id, contract_number, description, customer_name, department_code, contract_amount, status
       FROM vp_contracts
       WHERE tenant_id = $1 AND link_status = 'unmatched' AND linked_project_id IS NULL
       ORDER BY contract_number`,
      [tenantId]
    );

    // Get Titan projects that are NOT already linked to a VP contract
    const titanProjects = await db.query(
      `SELECT p.id, p.number, p.name, p.status, COALESCE(c.name, c.customer_owner) as customer_owner
       FROM projects p
       LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
       LEFT JOIN customers c ON p.customer_id = c.id
       WHERE p.tenant_id = $1 AND vc.id IS NULL
       ORDER BY p.number`,
      [tenantId]
    );

    const duplicates = [];

    for (const vpContract of vpContracts.rows) {
      const matches = [];

      for (const titanProject of titanProjects.rows) {
        // Match by contract_number to project.number (exact match)
        const exactNumberMatch = vpContract.contract_number && titanProject.number &&
          vpContract.contract_number.trim() === titanProject.number.trim();

        // Calculate similarity on description/name
        const nameSimilarity = this._calculateSimilarity(
          vpContract.description || '',
          titanProject.name || ''
        );

        // Calculate similarity on customer name
        const customerSimilarity = this._calculateSimilarity(
          vpContract.customer_name || '',
          titanProject.customer_owner || ''
        );

        // Final score calculation
        let finalSimilarity = Math.max(nameSimilarity, customerSimilarity);

        // Boost score significantly if contract numbers match exactly
        if (exactNumberMatch) {
          finalSimilarity = 1.0;
        }

        if (finalSimilarity >= minSimilarity) {
          matches.push({
            titan_id: titanProject.id,
            titan_number: titanProject.number,
            titan_name: titanProject.name,
            titan_customer: titanProject.customer_owner,
            similarity: Math.round(finalSimilarity * 100) / 100,
            exact_number_match: exactNumberMatch
          });
        }
      }

      // Sort matches by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        duplicates.push({
          vp_id: vpContract.id,
          vp_contract_number: vpContract.contract_number,
          vp_description: vpContract.description,
          vp_customer: vpContract.customer_name,
          vp_amount: vpContract.contract_amount,
          vp_status: vpContract.status,
          potential_matches: matches.slice(0, 5) // Top 5 matches
        });
      }
    }

    // Sort by highest match similarity
    duplicates.sort((a, b) => {
      const aMax = a.potential_matches[0]?.similarity || 0;
      const bMax = b.potential_matches[0]?.similarity || 0;
      return bMax - aMax;
    });

    return duplicates;
  },

  // Find potential department matches between VP department codes and Titan departments
  async findDepartmentDuplicates(tenantId, minSimilarity = 0.5) {
    // Get unique department codes from VP contracts and work orders that have NO linked department yet
    const vpDepartments = await db.query(
      `SELECT DISTINCT department_code
       FROM (
         SELECT department_code FROM vp_contracts
         WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '' AND linked_department_id IS NULL
         UNION
         SELECT department_code FROM vp_work_orders
         WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '' AND linked_department_id IS NULL
       ) depts
       ORDER BY department_code`,
      [tenantId]
    );

    // Get Titan departments
    const titanDepartments = await db.query(
      `SELECT id, department_number, name
       FROM departments
       WHERE tenant_id = $1
       ORDER BY department_number`,
      [tenantId]
    );

    const duplicates = [];

    for (const vpDept of vpDepartments.rows) {
      const matches = [];

      for (const titanDept of titanDepartments.rows) {
        // Exact match on department_code to department_number
        const exactMatch = vpDept.department_code && titanDept.department_number &&
          vpDept.department_code.trim() === titanDept.department_number.trim();

        // Similarity on code/number
        const codeSimilarity = this._calculateSimilarity(
          vpDept.department_code || '',
          titanDept.department_number || ''
        );

        let finalSimilarity = codeSimilarity;
        if (exactMatch) {
          finalSimilarity = 1.0;
        }

        if (finalSimilarity >= minSimilarity) {
          matches.push({
            titan_id: titanDept.id,
            titan_number: titanDept.department_number,
            titan_name: titanDept.name,
            similarity: Math.round(finalSimilarity * 100) / 100,
            exact_match: exactMatch
          });
        }
      }

      // Sort matches by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      // Count how many UNLINKED contracts/work orders use this department code
      const usageCount = await db.query(
        `SELECT
          (SELECT COUNT(*) FROM vp_contracts WHERE tenant_id = $1 AND department_code = $2 AND linked_department_id IS NULL) as contracts,
          (SELECT COUNT(*) FROM vp_work_orders WHERE tenant_id = $1 AND department_code = $2 AND linked_department_id IS NULL) as work_orders`,
        [tenantId, vpDept.department_code]
      );

      // Always add the department code, even if no matches - so user can see all unlinked codes
      duplicates.push({
        vp_department_code: vpDept.department_code,
        usage_count: {
          contracts: parseInt(usageCount.rows[0].contracts),
          work_orders: parseInt(usageCount.rows[0].work_orders)
        },
        potential_matches: matches.slice(0, 5) // Top 5 matches (may be empty)
      });
    }

    // Sort by highest match similarity
    duplicates.sort((a, b) => {
      const aMax = a.potential_matches[0]?.similarity || 0;
      const bMax = b.potential_matches[0]?.similarity || 0;
      return bMax - aMax;
    });

    return duplicates;
  },

  // Find potential vendor matches between VP vendors and Titan vendors
  async findVendorDuplicates(tenantId, minSimilarity = 0.5) {
    // Get all unlinked VP vendors
    const vpVendors = await db.query(
      `SELECT id, vendor_number, name, city, state, active
       FROM vp_vendors
       WHERE link_status = 'unmatched'
       ORDER BY name`
    );

    // Get Titan vendors that are NOT already linked to a VP vendor
    const titanVendors = await db.query(
      `SELECT v.id, v.vendor_name, v.company_name, v.city, v.state
       FROM vendors v
       LEFT JOIN vp_vendors vpv ON vpv.linked_vendor_id = v.id
       WHERE vpv.id IS NULL
       ORDER BY v.vendor_name`
    );

    const duplicates = [];

    for (const vpVendor of vpVendors.rows) {
      const vpName = vpVendor.name || '';
      const matches = [];

      for (const titanVendor of titanVendors.rows) {
        // Compare VP name against both vendor_name and company_name
        const vendorNameSimilarity = this._calculateSimilarity(vpName, titanVendor.vendor_name || '');
        const companyNameSimilarity = this._calculateSimilarity(vpName, titanVendor.company_name || '');

        // Use the best match
        const nameSimilarity = Math.max(vendorNameSimilarity, companyNameSimilarity);

        // Boost score if city/state match
        const locationMatch = vpVendor.city && titanVendor.city &&
          vpVendor.city.toLowerCase() === titanVendor.city.toLowerCase();

        const finalSimilarity = locationMatch ? Math.min(nameSimilarity + 0.1, 1.0) : nameSimilarity;

        if (finalSimilarity >= minSimilarity) {
          matches.push({
            titan_id: titanVendor.id,
            titan_vendor_name: titanVendor.vendor_name,
            titan_company_name: titanVendor.company_name,
            titan_location: titanVendor.city && titanVendor.state ? `${titanVendor.city}, ${titanVendor.state}` : '',
            similarity: Math.round(finalSimilarity * 100) / 100,
            matched_on: vendorNameSimilarity >= companyNameSimilarity ? 'vendor_name' : 'company_name',
            location_match: locationMatch
          });
        }
      }

      // Sort matches by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        duplicates.push({
          vp_id: vpVendor.id,
          vp_vendor_number: vpVendor.vendor_number,
          vp_name: vpName,
          vp_location: vpVendor.city && vpVendor.state ? `${vpVendor.city}, ${vpVendor.state}` : '',
          vp_active: vpVendor.active,
          potential_matches: matches.slice(0, 5) // Top 5 matches
        });
      }
    }

    // Sort by highest match similarity
    duplicates.sort((a, b) => {
      const aMax = a.potential_matches[0]?.similarity || 0;
      const bMax = b.potential_matches[0]?.similarity || 0;
      return bMax - aMax;
    });

    return duplicates;
  },

  // Import unmatched VP vendors as new Titan vendors
  async importUnmatchedVendorsToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP vendors
      const unlinked = await client.query(
        `SELECT id, vendor_number, name, address, address2, city, state, zip, active
         FROM vp_vendors
         WHERE link_status = 'unmatched'
         ORDER BY name`
      );

      for (const vpVendor of unlinked.rows) {
        await client.query('SAVEPOINT import_vendor_row');
        try {
          // Create new Titan vendor
          const newVendor = await client.query(
            `INSERT INTO vendors (
              vendor_name, company_name, address_line1, address_line2, city, state, zip_code, status, created_at, updated_at, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9)
            RETURNING id`,
            [
              vpVendor.name || 'Unknown',
              vpVendor.name || 'Unknown',
              vpVendor.address || '',
              vpVendor.address2 || '',
              vpVendor.city || '',
              vpVendor.state || '',
              vpVendor.zip || '',
              vpVendor.active ? 'active' : 'inactive',
              userId
            ]
          );

          // Link the VP vendor to the new Titan vendor
          await client.query(
            `UPDATE vp_vendors SET
              linked_vendor_id = $1,
              link_status = 'manual_matched',
              linked_at = CURRENT_TIMESTAMP,
              linked_by = $2
            WHERE id = $3`,
            [newVendor.rows[0].id, userId, vpVendor.id]
          );

          await client.query('RELEASE SAVEPOINT import_vendor_row');

          imported++;
          results.push({
            vp_id: vpVendor.id,
            titan_id: newVendor.rows[0].id,
            name: vpVendor.name
          });
        } catch (rowError) {
          await client.query('ROLLBACK TO SAVEPOINT import_vendor_row');
          console.error(`[Vista Import] Failed to import vendor ${vpVendor.name}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');
      return { imported, total: unlinked.rows.length, results };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Map Vista contract status to valid Titan project status
  // Valid: 'active', 'on_hold', 'completed', 'cancelled', 'Open', 'Soft-Closed', 'Hard-Closed'
  _mapVistaStatusToProjectStatus(vistaStatus) {
    if (!vistaStatus || vistaStatus.trim() === '') return 'Open';
    const s = vistaStatus.trim().toLowerCase();
    // Exact matches (case-insensitive)
    if (s === 'open' || s === '1' || s === '1-open') return 'Open';
    if (s === 'soft-closed' || s === 'soft closed' || s === '2' || s === '2-soft closed' || s === 'softclosed') return 'Soft-Closed';
    if (s === 'hard-closed' || s === 'hard closed' || s === '3' || s === '3-hard closed' || s === 'hardclosed' || s === 'closed') return 'Hard-Closed';
    if (s === 'active') return 'Open';
    if (s === 'on_hold' || s === 'on hold') return 'on_hold';
    if (s === 'completed' || s === 'complete') return 'completed';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    // Fallback — anything unrecognized defaults to Open
    return 'Open';
  },

  // Import unmatched VP contracts as new Titan projects
  async importUnmatchedContractsToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    let updated = 0;
    const results = [];
    const errors = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP contracts (including orphaned auto_matched ones without actual project links)
      const unlinked = await client.query(
        `SELECT id, contract_number, description, customer_name, department_code,
                contract_amount, gross_profit_percent, backlog,
                status, employee_number, project_manager_name, linked_department_id, link_status,
                start_month
         FROM vp_contracts
         WHERE tenant_id = $1 AND linked_project_id IS NULL
           AND (link_status = 'unmatched' OR link_status = 'auto_matched')
         ORDER BY contract_number`,
        [tenantId]
      );

      console.log(`[Vista Import] Found ${unlinked.rows.length} unlinked contracts to auto-import`);
      if (unlinked.rows.length > 0) {
        console.log(`[Vista Import] Contract numbers: ${unlinked.rows.map(r => r.contract_number).join(', ')}`);
      }

      for (const vpContract of unlinked.rows) {
        // Use SAVEPOINT so a single row failure doesn't abort the entire transaction
        await client.query('SAVEPOINT import_contract_row');
        try {
          // Look up the employee by employee_number to set as project manager
          let managerId = null;
          if (vpContract.employee_number) {
            const employeeResult = await client.query(
              `SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2 LIMIT 1`,
              [tenantId, String(vpContract.employee_number)]
            );
            if (employeeResult.rows.length > 0) {
              managerId = employeeResult.rows[0].id;
            } else {
              // Fall back to vp_employees linked_employee_id
              const vpEmpResult = await client.query(
                `SELECT linked_employee_id FROM vp_employees
                 WHERE employee_number = $1 AND linked_employee_id IS NOT NULL LIMIT 1`,
                [Number(vpContract.employee_number)]
              );
              if (vpEmpResult.rows.length > 0) {
                managerId = vpEmpResult.rows[0].linked_employee_id;
              }
            }
          }

          // Map VP status to valid Titan project status
          const projectStatus = this._mapVistaStatusToProjectStatus(vpContract.status);

          // Truncate strings to fit VARCHAR constraints
          const projectNumber = (vpContract.contract_number || '').substring(0, 50);
          const projectName = (vpContract.description || vpContract.contract_number || 'Imported Contract').substring(0, 255);
          const projectClient = (vpContract.customer_name || 'Unknown Client').substring(0, 255);

          // Create or update Titan project — ON CONFLICT updates if number already exists
          const newProject = await client.query(
            `INSERT INTO projects (
              tenant_id, number, name, client, status, manager_id, department_id,
              contract_value, gross_margin_percent, backlog, start_date,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id, number) DO UPDATE SET
              name = EXCLUDED.name,
              client = EXCLUDED.client,
              status = EXCLUDED.status,
              manager_id = COALESCE(EXCLUDED.manager_id, projects.manager_id),
              department_id = COALESCE(EXCLUDED.department_id, projects.department_id),
              contract_value = COALESCE(EXCLUDED.contract_value, projects.contract_value),
              gross_margin_percent = COALESCE(EXCLUDED.gross_margin_percent, projects.gross_margin_percent),
              backlog = COALESCE(EXCLUDED.backlog, projects.backlog),
              start_date = COALESCE(EXCLUDED.start_date, projects.start_date),
              updated_at = CURRENT_TIMESTAMP
            RETURNING id, (xmax = 0) as is_new`,
            [
              tenantId,
              projectNumber,
              projectName,
              projectClient,
              projectStatus,
              managerId,
              vpContract.linked_department_id || null,
              vpContract.contract_amount || null,
              vpContract.gross_profit_percent || null,
              vpContract.backlog || null,
              vpContract.start_month || null
            ]
          );

          const projectId = newProject.rows[0].id;
          const isNew = newProject.rows[0].is_new;

          // Link the VP contract to the Titan project
          await client.query(
            `UPDATE vp_contracts SET
              linked_project_id = $1,
              link_status = 'auto_matched',
              link_confidence = 1.0,
              linked_at = CURRENT_TIMESTAMP,
              linked_by = $2
            WHERE id = $3`,
            [projectId, userId, vpContract.id]
          );

          await client.query('RELEASE SAVEPOINT import_contract_row');

          if (isNew) {
            imported++;
          } else {
            updated++;
          }
          results.push({
            vp_id: vpContract.id,
            titan_id: projectId,
            name: vpContract.description || vpContract.contract_number,
            action: isNew ? 'created' : 'updated'
          });
        } catch (rowError) {
          // Rollback to savepoint so the transaction stays valid for remaining rows
          await client.query('ROLLBACK TO SAVEPOINT import_contract_row');
          console.error(`[Vista Import] Failed to import contract ${vpContract.contract_number}: ${rowError.message}`);
          errors.push({ contract_number: vpContract.contract_number, error: rowError.message });
        }
      }

      await client.query('COMMIT');
      return { imported, updated, total: unlinked.rows.length, results, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Sync status and key fields from Vista to Titan for already-linked contracts
  async syncLinkedContractData(tenantId) {
    const client = await db.getClient();
    let synced = 0;
    const changes = [];

    try {
      await client.query('BEGIN');

      // Get all linked contracts and compare key fields with Titan projects
      const linked = await client.query(
        `SELECT vc.id AS vp_id, vc.contract_number, vc.status AS vista_status,
                vc.description, vc.customer_name, vc.contract_amount,
                vc.gross_profit_percent, vc.backlog, vc.employee_number,
                vc.linked_department_id, vc.start_month,
                p.id AS project_id, p.status AS titan_status, p.name AS titan_name,
                p.department_id AS titan_dept, p.start_date AS titan_start,
                p.client AS titan_client, p.contract_value AS titan_contract_value,
                p.gross_margin_percent AS titan_margin, p.backlog AS titan_backlog
         FROM vp_contracts vc
         JOIN projects p ON p.id = vc.linked_project_id AND p.tenant_id = vc.tenant_id
         WHERE vc.tenant_id = $1
           AND vc.linked_project_id IS NOT NULL`,
        [tenantId]
      );

      for (const row of linked.rows) {
        const mappedStatus = this._mapVistaStatusToProjectStatus(row.vista_status);

        // Check if ANY field actually changed
        const statusChanged = mappedStatus !== row.titan_status;
        const deptChanged = row.linked_department_id && row.linked_department_id !== row.titan_dept;
        const startChanged = row.start_month && new Date(row.start_month).toISOString() !== (row.titan_start ? new Date(row.titan_start).toISOString() : null);
        const nameChanged = row.description && row.description.substring(0, 255) !== row.titan_name;
        const clientChanged = row.customer_name && row.customer_name.substring(0, 255) !== row.titan_client;

        if (!statusChanged && !deptChanged && !startChanged && !nameChanged && !clientChanged) continue;

        await client.query('SAVEPOINT sync_contract_row');
        try {
          // Look up manager
          let managerId = null;
          if (row.employee_number) {
            const empResult = await client.query(
              `SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2 LIMIT 1`,
              [tenantId, String(row.employee_number)]
            );
            if (empResult.rows.length > 0) {
              managerId = empResult.rows[0].id;
            }
          }

          await client.query(
            `UPDATE projects SET
              status = $1,
              name = COALESCE($2, name),
              client = COALESCE($3, client),
              contract_value = COALESCE($4, contract_value),
              gross_margin_percent = COALESCE($5, gross_margin_percent),
              backlog = COALESCE($6, backlog),
              manager_id = COALESCE($7, manager_id),
              department_id = COALESCE($8, department_id),
              start_date = COALESCE($9, start_date),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $10 AND tenant_id = $11`,
            [
              mappedStatus,
              row.description ? row.description.substring(0, 255) : null,
              row.customer_name ? row.customer_name.substring(0, 255) : null,
              row.contract_amount || null,
              row.gross_profit_percent || null,
              row.backlog || null,
              managerId,
              row.linked_department_id || null,
              row.start_month || null,
              row.project_id,
              tenantId
            ]
          );

          await client.query('RELEASE SAVEPOINT sync_contract_row');
          synced++;
          const changedFields = [];
          if (statusChanged) changedFields.push(`status: ${row.titan_status} → ${mappedStatus}`);
          if (deptChanged) changedFields.push(`dept: ${row.titan_dept} → ${row.linked_department_id}`);
          if (startChanged) changedFields.push(`start_date updated`);
          if (nameChanged) changedFields.push(`name updated`);
          if (clientChanged) changedFields.push(`client updated`);
          changes.push({
            contract_number: row.contract_number,
            project_id: row.project_id,
            fields: changedFields
          });
          console.log(`[Vista Sync] Contract ${row.contract_number}: ${changedFields.join(', ')}`);
        } catch (rowError) {
          await client.query('ROLLBACK TO SAVEPOINT sync_contract_row');
          console.error(`[Vista Sync] Failed to sync contract ${row.contract_number}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');
      return { synced, total_linked: linked.rows.length, changes };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Sync status and key fields from Vista to Titan for already-linked work orders
  async syncLinkedWorkOrderData(tenantId) {
    const client = await db.getClient();
    let synced = 0;
    const changes = [];

    try {
      await client.query('BEGIN');

      const linked = await client.query(
        `SELECT vw.id AS vp_id, vw.work_order_number, vw.status AS vista_status,
                vw.description, vw.customer_name, vw.contract_amount,
                vw.gross_profit_percent, vw.backlog, vw.employee_number,
                vw.linked_department_id,
                p.id AS project_id, p.status AS titan_status, p.name AS titan_name,
                p.department_id AS titan_dept, p.client AS titan_client
         FROM vp_work_orders vw
         JOIN projects p ON p.number = 'WO-' || vw.work_order_number AND p.tenant_id = vw.tenant_id
         WHERE vw.tenant_id = $1
           AND vw.link_status IN ('auto_matched', 'manual_matched')`,
        [tenantId]
      );

      for (const row of linked.rows) {
        const mappedStatus = this._mapVistaStatusToProjectStatus(row.vista_status);

        // Check if ANY field actually changed
        const statusChanged = mappedStatus !== row.titan_status;
        const deptChanged = row.linked_department_id && row.linked_department_id !== row.titan_dept;
        const nameChanged = row.description && row.description.substring(0, 255) !== row.titan_name;
        const clientChanged = row.customer_name && row.customer_name.substring(0, 255) !== row.titan_client;

        if (!statusChanged && !deptChanged && !nameChanged && !clientChanged) continue;

        await client.query('SAVEPOINT sync_wo_row');
        try {
          let managerId = null;
          if (row.employee_number) {
            const empResult = await client.query(
              `SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2 LIMIT 1`,
              [tenantId, String(row.employee_number)]
            );
            if (empResult.rows.length > 0) {
              managerId = empResult.rows[0].id;
            }
          }

          await client.query(
            `UPDATE projects SET
              status = $1,
              name = COALESCE($2, name),
              client = COALESCE($3, client),
              contract_value = COALESCE($4, contract_value),
              gross_margin_percent = COALESCE($5, gross_margin_percent),
              backlog = COALESCE($6, backlog),
              manager_id = COALESCE($7, manager_id),
              department_id = COALESCE($8, department_id),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $9 AND tenant_id = $10`,
            [
              mappedStatus,
              row.description ? row.description.substring(0, 255) : null,
              row.customer_name ? row.customer_name.substring(0, 255) : null,
              row.contract_amount || null,
              row.gross_profit_percent || null,
              row.backlog || null,
              managerId,
              row.linked_department_id || null,
              row.project_id,
              tenantId
            ]
          );

          await client.query('RELEASE SAVEPOINT sync_wo_row');
          synced++;
          const changedFields = [];
          if (statusChanged) changedFields.push(`status: ${row.titan_status} → ${mappedStatus}`);
          if (deptChanged) changedFields.push(`dept: ${row.titan_dept} → ${row.linked_department_id}`);
          if (nameChanged) changedFields.push(`name updated`);
          if (clientChanged) changedFields.push(`client updated`);
          changes.push({
            work_order_number: row.work_order_number,
            project_id: row.project_id,
            fields: changedFields
          });
          console.log(`[Vista Sync] WO ${row.work_order_number}: ${changedFields.join(', ')}`);
        } catch (rowError) {
          await client.query('ROLLBACK TO SAVEPOINT sync_wo_row');
          console.error(`[Vista Sync] Failed to sync WO ${row.work_order_number}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');
      return { synced, total_linked: linked.rows.length, changes };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Import unmatched VP work orders as new Titan projects
  async importUnmatchedWorkOrdersToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    let updated = 0;
    const results = [];
    const errors = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP work orders
      const unlinked = await client.query(
        `SELECT id, work_order_number, description, customer_name, department_code,
                contract_amount, gross_profit_percent, backlog,
                status, employee_number, project_manager_name, linked_department_id
         FROM vp_work_orders
         WHERE tenant_id = $1 AND link_status = 'unmatched'
         ORDER BY work_order_number`,
        [tenantId]
      );

      for (const vpWorkOrder of unlinked.rows) {
        // Use SAVEPOINT so a single row failure doesn't abort the entire transaction
        await client.query('SAVEPOINT import_wo_row');
        try {
          // Look up the employee by employee_number to set as project manager
          let managerId = null;
          if (vpWorkOrder.employee_number) {
            const employeeResult = await client.query(
              `SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2 LIMIT 1`,
              [tenantId, String(vpWorkOrder.employee_number)]
            );
            if (employeeResult.rows.length > 0) {
              managerId = employeeResult.rows[0].id;
            } else {
              const vpEmpResult = await client.query(
                `SELECT linked_employee_id FROM vp_employees
                 WHERE employee_number = $1 AND linked_employee_id IS NOT NULL LIMIT 1`,
                [Number(vpWorkOrder.employee_number)]
              );
              if (vpEmpResult.rows.length > 0) {
                managerId = vpEmpResult.rows[0].linked_employee_id;
              }
            }
          }

          // Map VP status to valid Titan project status
          const projectStatus = this._mapVistaStatusToProjectStatus(vpWorkOrder.status);

          // Truncate strings to fit VARCHAR constraints
          const projectNumber = ('WO-' + (vpWorkOrder.work_order_number || '')).substring(0, 50);
          const projectName = (vpWorkOrder.description || 'Work Order ' + (vpWorkOrder.work_order_number || 'Imported')).substring(0, 255);
          const projectClient = (vpWorkOrder.customer_name || 'Unknown Client').substring(0, 255);

          // Create or update Titan project with WO- prefix, ON CONFLICT handles duplicates
          const newProject = await client.query(
            `INSERT INTO projects (
              tenant_id, number, name, client, status, manager_id, department_id,
              contract_value, gross_margin_percent, backlog,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id, number) DO UPDATE SET
              name = EXCLUDED.name,
              client = EXCLUDED.client,
              status = EXCLUDED.status,
              manager_id = COALESCE(EXCLUDED.manager_id, projects.manager_id),
              department_id = COALESCE(EXCLUDED.department_id, projects.department_id),
              contract_value = COALESCE(EXCLUDED.contract_value, projects.contract_value),
              gross_margin_percent = COALESCE(EXCLUDED.gross_margin_percent, projects.gross_margin_percent),
              backlog = COALESCE(EXCLUDED.backlog, projects.backlog),
              updated_at = CURRENT_TIMESTAMP
            RETURNING id, (xmax = 0) as is_new`,
            [
              tenantId,
              projectNumber,
              projectName,
              projectClient,
              projectStatus,
              managerId,
              vpWorkOrder.linked_department_id || null,
              vpWorkOrder.contract_amount || null,
              vpWorkOrder.gross_profit_percent || null,
              vpWorkOrder.backlog || null
            ]
          );

          const projectId = newProject.rows[0].id;
          const isNew = newProject.rows[0].is_new;

          // Link the VP work order to the Titan project
          await client.query(
            `UPDATE vp_work_orders SET
              link_status = 'auto_matched',
              link_confidence = 1.0,
              linked_at = CURRENT_TIMESTAMP,
              linked_by = $1
            WHERE id = $2`,
            [userId, vpWorkOrder.id]
          );

          await client.query('RELEASE SAVEPOINT import_wo_row');

          if (isNew) {
            imported++;
          } else {
            updated++;
          }
          results.push({
            vp_id: vpWorkOrder.id,
            titan_id: projectId,
            name: vpWorkOrder.description || vpWorkOrder.work_order_number,
            action: isNew ? 'created' : 'updated'
          });
        } catch (rowError) {
          // Rollback to savepoint so the transaction stays valid for remaining rows
          await client.query('ROLLBACK TO SAVEPOINT import_wo_row');
          console.error(`[Vista Import] Failed to import work order ${vpWorkOrder.work_order_number}: ${rowError.message}`);
          errors.push({ work_order_number: vpWorkOrder.work_order_number, error: rowError.message });
        }
      }

      await client.query('COMMIT');
      return { imported, updated, total: unlinked.rows.length, results, errors };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Import unmatched VP department codes as new Titan departments
  async importUnmatchedDepartmentsToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get unique department codes from VP that don't exist in Titan
      const unlinked = await client.query(
        `SELECT DISTINCT vp_dept.department_code
         FROM (
           SELECT department_code FROM vp_contracts WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != ''
           UNION
           SELECT department_code FROM vp_work_orders WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != ''
         ) vp_dept
         WHERE NOT EXISTS (
           SELECT 1 FROM departments d WHERE d.tenant_id = $1 AND d.department_number = vp_dept.department_code
         )
         ORDER BY department_code`,
        [tenantId]
      );

      for (const vpDept of unlinked.rows) {
        await client.query('SAVEPOINT import_dept_row');
        try {
          // Create new Titan department (skip if already exists due to unique constraint)
          const newDepartment = await client.query(
            `INSERT INTO departments (
              tenant_id, department_number, name, created_at, updated_at
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (department_number) DO UPDATE SET
              updated_at = CURRENT_TIMESTAMP
            RETURNING id, (xmax = 0) as is_new`,
            [
              tenantId,
              vpDept.department_code,
              `Department ${vpDept.department_code}` // Can be renamed later
            ]
          );

          await client.query('RELEASE SAVEPOINT import_dept_row');

          // Only count as imported if it was actually a new record
          if (newDepartment.rows[0]?.is_new) {
            imported++;
          }
          results.push({
            titan_id: newDepartment.rows[0].id,
            department_code: vpDept.department_code
          });
        } catch (rowError) {
          await client.query('ROLLBACK TO SAVEPOINT import_dept_row');
          console.error(`[Vista Import] Failed to import department ${vpDept.department_code}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');
      return { imported, total: unlinked.rows.length, results };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Auto-link all VP department codes that have exact matches to Titan departments
  async autoLinkExactDepartmentMatches(tenantId, userId) {
    const client = await db.getClient();
    let totalContractsUpdated = 0;
    let totalWorkOrdersUpdated = 0;
    const linkedCodes = [];

    try {
      await client.query('BEGIN');

      // Find all VP department codes that exactly match Titan department numbers
      // and have unlinked contracts/work orders
      const exactMatches = await client.query(
        `SELECT DISTINCT vp_dept.department_code, d.id as titan_department_id, d.name as titan_department_name
         FROM (
           SELECT department_code FROM vp_contracts
           WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '' AND linked_department_id IS NULL
           UNION
           SELECT department_code FROM vp_work_orders
           WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '' AND linked_department_id IS NULL
         ) vp_dept
         INNER JOIN departments d ON d.tenant_id = $1 AND TRIM(d.department_number) = TRIM(vp_dept.department_code)
         ORDER BY department_code`,
        [tenantId]
      );

      for (const match of exactMatches.rows) {
        // Update contracts
        const contractsResult = await client.query(
          `UPDATE vp_contracts SET
            linked_department_id = $1,
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE tenant_id = $3 AND department_code = $4 AND linked_department_id IS NULL
          RETURNING id`,
          [match.titan_department_id, userId, tenantId, match.department_code]
        );

        // Update work orders
        const workOrdersResult = await client.query(
          `UPDATE vp_work_orders SET
            linked_department_id = $1,
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE tenant_id = $3 AND department_code = $4 AND linked_department_id IS NULL
          RETURNING id`,
          [match.titan_department_id, userId, tenantId, match.department_code]
        );

        totalContractsUpdated += contractsResult.rowCount;
        totalWorkOrdersUpdated += workOrdersResult.rowCount;
        linkedCodes.push({
          department_code: match.department_code,
          titan_department_id: match.titan_department_id,
          titan_department_name: match.titan_department_name,
          contracts_updated: contractsResult.rowCount,
          work_orders_updated: workOrdersResult.rowCount
        });
      }

      await client.query('COMMIT');

      return {
        codes_linked: linkedCodes.length,
        contracts_updated: totalContractsUpdated,
        work_orders_updated: totalWorkOrdersUpdated,
        total_updated: totalContractsUpdated + totalWorkOrdersUpdated,
        details: linkedCodes
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Auto-link VP customers to Titan customers by customer_number
  // Replaces the old fuzzy-matching approach
  async autoLinkExactCustomerMatches(tenantId, userId) {
    // Just delegate to syncCustomersToTitan which handles all linking
    const result = await this.syncCustomersToTitan(tenantId, userId);
    return {
      customers_linked: result.created + result.updated,
      details: result.results
    };
  },

  // Auto-link ALL VP customers (same as exact for the new customer_number approach)
  async autoLinkAllCustomerMatches(tenantId, userId) {
    return this.autoLinkExactCustomerMatches(tenantId, userId);
  },

  // Auto-link VP vendors to Titan vendors where similarity >= 100% (rounded)
  async autoLinkExactVendorMatches(tenantId, userId) {
    // Use the existing similarity-based duplicate finder to get 100% matches
    const duplicates = await this.findVendorDuplicates(tenantId, 0.995);

    const client = await db.getClient();
    let totalLinked = 0;
    const linkedVendors = [];

    try {
      await client.query('BEGIN');

      for (const dup of duplicates) {
        // Get the top match if it's >= 100% (after rounding)
        const topMatch = dup.potential_matches[0];
        if (!topMatch || topMatch.similarity < 1.0) continue;

        // Check if this Titan vendor is already linked to another VP vendor
        const existingLink = await client.query(
          `SELECT id FROM vp_vendors WHERE linked_vendor_id = $1 AND id != $2`,
          [topMatch.titan_id, dup.vp_id]
        );
        if (existingLink.rows.length > 0) continue;

        // Link the VP vendor to Titan vendor
        await client.query(
          `UPDATE vp_vendors SET
            linked_vendor_id = $1,
            link_status = 'auto_matched',
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE id = $3`,
          [topMatch.titan_id, userId, dup.vp_id]
        );

        totalLinked++;
        linkedVendors.push({
          vp_id: dup.vp_id,
          vp_vendor_number: dup.vp_vendor_number,
          vp_name: dup.vp_name,
          titan_id: topMatch.titan_id,
          titan_vendor_name: topMatch.titan_vendor_name,
          titan_company_name: topMatch.titan_company_name
        });
      }

      await client.query('COMMIT');

      return {
        vendors_linked: totalLinked,
        details: linkedVendors
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // ==================== TITAN-ONLY RECORDS ====================
  // Get Titan records that don't have a Vista link

  async getTitanOnlyProjects(tenantId) {
    const result = await db.query(
      `SELECT p.id, p.number, p.name, p.status, p.created_at
       FROM projects p
       LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id AND vc.tenant_id = $1
       WHERE p.tenant_id = $1 AND vc.id IS NULL
       ORDER BY p.name`,
      [tenantId]
    );
    return result.rows;
  },

  async getTitanOnlyEmployees(tenantId) {
    const result = await db.query(
      `SELECT e.id, e.employee_number, e.first_name, e.last_name, e.email,
              e.employment_status, e.job_title
       FROM employees e
       LEFT JOIN vp_employees vpe ON vpe.linked_employee_id = e.id
       WHERE e.tenant_id = $1 AND vpe.id IS NULL
       ORDER BY e.last_name, e.first_name`,
      [tenantId]
    );
    return result.rows;
  },

  async getTitanOnlyCustomers(tenantId) {
    // Get customers that are NOT linked to Vista (manual-only customers)
    const result = await db.query(
      `SELECT c.id, COALESCE(c.name, c.customer_owner) as name, c.city, c.state
       FROM customers c
       WHERE c.tenant_id = $1
         AND (c.source IS NULL OR c.source = 'manual')
         AND c.vp_customer_id IS NULL
       ORDER BY COALESCE(c.name, c.customer_owner)`,
      [tenantId]
    );
    return result.rows;
  },

  async getTitanOnlyVendors(tenantId) {
    const result = await db.query(
      `SELECT v.id, v.vendor_name, v.city, v.state, v.status
       FROM vendors v
       LEFT JOIN vp_vendors vpv ON vpv.linked_vendor_id = v.id
       WHERE v.tenant_id = $1 AND vpv.id IS NULL
       ORDER BY v.vendor_name`,
      [tenantId]
    );
    return result.rows;
  },

  // Link a VP department code to a Titan department (updates all contracts/work orders with that code)
  async linkDepartmentCode(departmentCode, departmentId, tenantId, userId) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Update all contracts with this department code
      const contractsResult = await client.query(
        `UPDATE vp_contracts SET
          linked_department_id = $1,
          linked_at = CURRENT_TIMESTAMP,
          linked_by = $2
        WHERE tenant_id = $3 AND department_code = $4
        RETURNING id`,
        [departmentId, userId, tenantId, departmentCode]
      );

      // Update all work orders with this department code
      const workOrdersResult = await client.query(
        `UPDATE vp_work_orders SET
          linked_department_id = $1,
          linked_at = CURRENT_TIMESTAMP,
          linked_by = $2
        WHERE tenant_id = $3 AND department_code = $4
        RETURNING id`,
        [departmentId, userId, tenantId, departmentCode]
      );

      await client.query('COMMIT');

      return {
        department_code: departmentCode,
        department_id: departmentId,
        contracts_updated: contractsResult.rowCount,
        work_orders_updated: workOrdersResult.rowCount,
        total_updated: contractsResult.rowCount + workOrdersResult.rowCount
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Auto-link VP contracts to Titan projects by exact contract number = project number match
  async autoLinkExactContractMatches(tenantId, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Find Vista contracts that match Titan projects by contract_number = project.number
      // Only link contracts that aren't already linked
      // Use TRIM on both sides to handle whitespace differences
      const result = await client.query(
        `UPDATE vp_contracts vc SET
          linked_project_id = p.id,
          link_status = 'auto_matched',
          link_confidence = 1.0,
          linked_at = CURRENT_TIMESTAMP,
          linked_by = $2
         FROM projects p
         WHERE TRIM(vc.contract_number) = TRIM(p.number)
           AND vc.tenant_id = $1
           AND p.tenant_id = $1
           AND vc.linked_project_id IS NULL
         RETURNING vc.id, vc.contract_number, p.id as titan_id, p.name as titan_name`,
        [tenantId, userId]
      );

      console.log(`[Auto-link] Matched ${result.rowCount} contracts by exact number`);

      await client.query('COMMIT');
      return {
        contracts_linked: result.rowCount,
        linked: result.rows
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // ==================== DELETE TITAN-ONLY RECORDS ====================
  // Delete Titan records that are not linked to Vista (for cleanup before Vista import)

  async deleteTitanOnlyCustomers(tenantId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Find Titan customers not linked to any Vista customer
      const toDelete = await client.query(
        `SELECT c.id, COALESCE(c.name, c.customer_owner) as name
         FROM customers c
         LEFT JOIN vp_customers vpc ON vpc.linked_customer_id = c.id
         WHERE c.tenant_id = $1 AND vpc.id IS NULL`,
        [tenantId]
      );

      if (toDelete.rows.length === 0) {
        await client.query('COMMIT');
        return { deleted: 0, records: [] };
      }

      const idsToDelete = toDelete.rows.map(r => r.id);

      // Delete customer contacts first (foreign key constraint)
      await client.query(
        `DELETE FROM customer_contacts WHERE customer_id = ANY($1)`,
        [idsToDelete]
      );

      // Delete the customers
      const result = await client.query(
        `DELETE FROM customers WHERE id = ANY($1) RETURNING id, name`,
        [idsToDelete]
      );

      await client.query('COMMIT');
      return { deleted: result.rowCount, records: result.rows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteTitanOnlyEmployees(tenantId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Find Titan employees not linked to any Vista employee
      const toDelete = await client.query(
        `SELECT e.id, e.first_name, e.last_name, e.employee_number
         FROM employees e
         LEFT JOIN vp_employees vpe ON vpe.linked_employee_id = e.id
         WHERE e.tenant_id = $1 AND vpe.id IS NULL`,
        [tenantId]
      );

      if (toDelete.rows.length === 0) {
        await client.query('COMMIT');
        return { deleted: 0, records: [] };
      }

      const idsToDelete = toDelete.rows.map(r => r.id);

      // Update projects to remove PM reference (set to null instead of deleting projects)
      await client.query(
        `UPDATE projects SET project_manager_id = NULL WHERE project_manager_id = ANY($1)`,
        [idsToDelete]
      );

      // Delete the employees
      const result = await client.query(
        `DELETE FROM employees WHERE id = ANY($1) RETURNING id, first_name, last_name, employee_number`,
        [idsToDelete]
      );

      await client.query('COMMIT');
      return { deleted: result.rowCount, records: result.rows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteTitanOnlyProjects(tenantId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Find Titan projects not linked to any Vista contract
      const toDelete = await client.query(
        `SELECT p.id, p.number, p.name
         FROM projects p
         LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id AND vc.tenant_id = $1
         WHERE p.tenant_id = $1 AND vc.id IS NULL`,
        [tenantId]
      );

      if (toDelete.rows.length === 0) {
        await client.query('COMMIT');
        return { deleted: 0, records: [] };
      }

      const idsToDelete = toDelete.rows.map(r => r.id);

      // Delete related records first (cascades won't help here due to foreign keys)
      // Note: This is a destructive operation and will remove all project data
      await client.query(`DELETE FROM daily_report_entries WHERE daily_report_id IN (SELECT id FROM daily_reports WHERE project_id = ANY($1))`, [idsToDelete]);
      await client.query(`DELETE FROM daily_reports WHERE project_id = ANY($1)`, [idsToDelete]);
      await client.query(`DELETE FROM submittals WHERE project_id = ANY($1)`, [idsToDelete]);
      await client.query(`DELETE FROM rfis WHERE project_id = ANY($1)`, [idsToDelete]);
      await client.query(`DELETE FROM change_orders WHERE project_id = ANY($1)`, [idsToDelete]);
      await client.query(`DELETE FROM schedule_items WHERE project_id = ANY($1)`, [idsToDelete]);

      // Delete the projects
      const result = await client.query(
        `DELETE FROM projects WHERE id = ANY($1) RETURNING id, number, name`,
        [idsToDelete]
      );

      await client.query('COMMIT');
      return { deleted: result.rowCount, records: result.rows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async deleteTitanOnlyVendors(tenantId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Find Titan vendors not linked to any Vista vendor
      const toDelete = await client.query(
        `SELECT v.id, v.vendor_name
         FROM vendors v
         LEFT JOIN vp_vendors vpv ON vpv.linked_vendor_id = v.id
         WHERE v.tenant_id = $1 AND vpv.id IS NULL`,
        [tenantId]
      );

      if (toDelete.rows.length === 0) {
        await client.query('COMMIT');
        return { deleted: 0, records: [] };
      }

      const idsToDelete = toDelete.rows.map(r => r.id);

      // Delete the vendors
      const result = await client.query(
        `DELETE FROM vendors WHERE id = ANY($1) RETURNING id, vendor_name`,
        [idsToDelete]
      );

      await client.query('COMMIT');
      return { deleted: result.rowCount, records: result.rows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // ==================== AUTO-LINK EMPLOYEES ====================
  // Auto-link Vista employees to Titan employees by exact employee number match

  async autoLinkExactEmployeeMatches(tenantId, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Find exact matches by employee number (100% match)
      // Cast INTEGER employee_number to TEXT to match VARCHAR in employees table
      const result = await client.query(
        `UPDATE vp_employees vpe SET
          linked_employee_id = e.id,
          link_status = 'auto_matched',
          linked_at = CURRENT_TIMESTAMP,
          linked_by = $2
         FROM employees e
         WHERE vpe.employee_number::TEXT = e.employee_number
           AND e.tenant_id = $1
           AND vpe.linked_employee_id IS NULL
         RETURNING vpe.id, vpe.employee_number, e.id as titan_id`,
        [tenantId, userId]
      );

      await client.query('COMMIT');
      return {
        employees_linked: result.rowCount,
        linked: result.rows
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // ==================== FIND TITAN DUPLICATES ====================
  // Find duplicate records within Titan (not Vista linking)

  async findTitanDuplicateCustomers(tenantId) {
    // Find customers with similar names (potential duplicates)
    const result = await db.query(
      `SELECT c1.id as id1, COALESCE(c1.name, c1.customer_owner) as name1,
              c2.id as id2, COALESCE(c2.name, c2.customer_owner) as name2,
              SIMILARITY(LOWER(COALESCE(c1.name, c1.customer_owner)), LOWER(COALESCE(c2.name, c2.customer_owner))) as similarity
       FROM customers c1
       JOIN customers c2 ON c1.id < c2.id AND c1.tenant_id = c2.tenant_id
       WHERE c1.tenant_id = $1
         AND COALESCE(c1.name, c1.customer_owner) IS NOT NULL
         AND COALESCE(c2.name, c2.customer_owner) IS NOT NULL
         AND SIMILARITY(LOWER(COALESCE(c1.name, c1.customer_owner)), LOWER(COALESCE(c2.name, c2.customer_owner))) > 0.7
       ORDER BY similarity DESC
       LIMIT 100`,
      [tenantId]
    );
    return result.rows;
  },

  async findTitanDuplicateEmployees(tenantId) {
    // Find employees with same employee number or similar names
    const result = await db.query(
      `SELECT e1.id as id1, e1.first_name || ' ' || e1.last_name as name1, e1.employee_number as number1,
              e2.id as id2, e2.first_name || ' ' || e2.last_name as name2, e2.employee_number as number2,
              CASE
                WHEN e1.employee_number IS NOT NULL AND e1.employee_number = e2.employee_number THEN 1.0
                ELSE SIMILARITY(LOWER(e1.first_name || ' ' || e1.last_name), LOWER(e2.first_name || ' ' || e2.last_name))
              END as similarity
       FROM employees e1
       JOIN employees e2 ON e1.id < e2.id AND e1.tenant_id = e2.tenant_id
       WHERE e1.tenant_id = $1
         AND (
           (e1.employee_number IS NOT NULL AND e1.employee_number = e2.employee_number)
           OR SIMILARITY(LOWER(e1.first_name || ' ' || e1.last_name), LOWER(e2.first_name || ' ' || e2.last_name)) > 0.7
         )
       ORDER BY similarity DESC
       LIMIT 100`,
      [tenantId]
    );
    return result.rows;
  },

  async findTitanDuplicateProjects(tenantId) {
    // Find projects with similar names or numbers
    const result = await db.query(
      `SELECT p1.id as id1, p1.name as name1, p1.number as number1,
              p2.id as id2, p2.name as name2, p2.number as number2,
              CASE
                WHEN p1.number IS NOT NULL AND p1.number = p2.number THEN 1.0
                ELSE SIMILARITY(LOWER(p1.name), LOWER(p2.name))
              END as similarity
       FROM projects p1
       JOIN projects p2 ON p1.id < p2.id AND p1.tenant_id = p2.tenant_id
       WHERE p1.tenant_id = $1
         AND (
           (p1.number IS NOT NULL AND p1.number = p2.number)
           OR SIMILARITY(LOWER(p1.name), LOWER(p2.name)) > 0.7
         )
       ORDER BY similarity DESC
       LIMIT 100`,
      [tenantId]
    );
    return result.rows;
  },

  // ==================== PHASE CODES ====================

  async upsertPhaseCode(data, tenantId, batchId = null) {
    const existing = await db.query(
      'SELECT id FROM vp_phase_codes WHERE tenant_id = $1 AND job = $2 AND cost_type = $3 AND phase = $4',
      [tenantId, data.job, data.cost_type, data.phase]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE vp_phase_codes SET
          contract = $1, job_description = $2, phase_description = $3,
          est_hours = $4, est_cost = $5, jtd_hours = $6, jtd_cost = $7,
          committed_cost = $8, projected_cost = $9, percent_complete = $10,
          import_batch_id = $11, updated_at = CURRENT_TIMESTAMP
        WHERE id = $12
        RETURNING *`,
        [
          data.contract, data.job_description, data.phase_description,
          data.est_hours, data.est_cost, data.jtd_hours, data.jtd_cost,
          data.committed_cost, data.projected_cost, data.percent_complete,
          batchId, existing.rows[0].id
        ]
      );
      return { row: result.rows[0], isNew: false };
    } else {
      const result = await db.query(
        `INSERT INTO vp_phase_codes (
          tenant_id, contract, job, job_description, cost_type, phase, phase_description,
          est_hours, est_cost, jtd_hours, jtd_cost, committed_cost, projected_cost,
          percent_complete, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          tenantId, data.contract, data.job, data.job_description, data.cost_type,
          data.phase, data.phase_description, data.est_hours, data.est_cost,
          data.jtd_hours, data.jtd_cost, data.committed_cost, data.projected_cost,
          data.percent_complete, batchId
        ]
      );
      return { row: result.rows[0], isNew: true };
    }
  },

  async linkPhaseCodesByContract(tenantId) {
    // Auto-link phase codes to projects via vp_contracts
    const result = await db.query(
      `UPDATE vp_phase_codes pc
       SET linked_project_id = vc.linked_project_id
       FROM vp_contracts vc
       WHERE pc.tenant_id = $1
         AND pc.tenant_id = vc.tenant_id
         AND pc.contract = vc.contract_number
         AND vc.linked_project_id IS NOT NULL
         AND pc.linked_project_id IS NULL`,
      [tenantId]
    );
    return result.rowCount;
  },

  async getShopFieldHoursByContract(tenantId) {
    const result = await db.query(
      `SELECT
        vc.contract_number,
        CASE
          WHEN pc.phase LIKE '30-%' OR pc.phase LIKE '35-%' THEN 'sm'
          WHEN pc.phase LIKE '40-%' OR pc.phase LIKE '45-%' THEN 'pf'
          WHEN pc.phase LIKE '50-%' OR pc.phase LIKE '55-%' THEN 'pl'
        END AS trade,
        CASE
          WHEN pc.phase LIKE '30-%' OR pc.phase LIKE '40-%' OR pc.phase LIKE '50-%' THEN 'field'
          WHEN pc.phase LIKE '35-%' OR pc.phase LIKE '45-%' OR pc.phase LIKE '55-%' THEN 'shop'
        END AS location,
        COALESCE(SUM(pc.est_hours), 0) AS est_hours,
        COALESCE(SUM(pc.jtd_hours), 0) AS jtd_hours
      FROM vp_phase_codes pc
      JOIN vp_contracts vc ON pc.contract = vc.contract_number AND pc.tenant_id = vc.tenant_id
      WHERE pc.tenant_id = $1
        AND pc.cost_type = 1
        AND (pc.phase LIKE '30-%' OR pc.phase LIKE '35-%'
          OR pc.phase LIKE '40-%' OR pc.phase LIKE '45-%'
          OR pc.phase LIKE '50-%' OR pc.phase LIKE '55-%')
      GROUP BY vc.contract_number, trade, location
      ORDER BY vc.contract_number`,
      [tenantId]
    );
    return result.rows;
  },

  async getPhaseCodesByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT * FROM vp_phase_codes
       WHERE tenant_id = $1 AND linked_project_id = $2
       ORDER BY job, cost_type, phase`,
      [tenantId, projectId]
    );
    return result.rows;
  }
};

module.exports = VistaData;
