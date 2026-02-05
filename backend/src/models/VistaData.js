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
          description = $1,
          status = $2,
          employee_number = $3,
          project_manager_name = $4,
          department_code = $5,
          orig_contract_amount = $6,
          contract_amount = $7,
          billed_amount = $8,
          received_amount = $9,
          backlog = $10,
          projected_revenue = $11,
          gross_profit_percent = $12,
          earned_revenue = $13,
          actual_cost = $14,
          projected_cost = $15,
          pf_hours_estimate = $16,
          pf_hours_jtd = $17,
          sm_hours_estimate = $18,
          sm_hours_jtd = $19,
          total_hours_estimate = $20,
          total_hours_jtd = $21,
          customer_number = $22,
          customer_name = $23,
          ship_city = $24,
          ship_state = $25,
          ship_zip = $26,
          primary_market = $27,
          negotiated_work = $28,
          delivery_method = $29,
          raw_data = $30,
          import_batch_id = $31,
          imported_at = CURRENT_TIMESTAMP
        WHERE id = $32
        RETURNING *`,
        [
          data.description,
          data.status,
          data.employee_number,
          data.project_manager_name,
          data.department_code,
          data.orig_contract_amount,
          data.contract_amount,
          data.billed_amount,
          data.received_amount,
          data.backlog,
          data.projected_revenue,
          data.gross_profit_percent,
          data.earned_revenue,
          data.actual_cost,
          data.projected_cost,
          data.pf_hours_estimate,
          data.pf_hours_jtd,
          data.sm_hours_estimate,
          data.sm_hours_jtd,
          data.total_hours_estimate,
          data.total_hours_jtd,
          data.customer_number,
          data.customer_name,
          data.ship_city,
          data.ship_state,
          data.ship_zip,
          data.primary_market,
          data.negotiated_work,
          data.delivery_method,
          data.raw_data,
          batchId,
          existing.rows[0].id
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
          customer_number, customer_name, ship_city, ship_state, ship_zip,
          primary_market, negotiated_work, delivery_method, raw_data, import_batch_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
        RETURNING *`,
        [
          tenantId,
          data.contract_number,
          data.description,
          data.status,
          data.employee_number,
          data.project_manager_name,
          data.department_code,
          data.orig_contract_amount,
          data.contract_amount,
          data.billed_amount,
          data.received_amount,
          data.backlog,
          data.projected_revenue,
          data.gross_profit_percent,
          data.earned_revenue,
          data.actual_cost,
          data.projected_cost,
          data.pf_hours_estimate,
          data.pf_hours_jtd,
          data.sm_hours_estimate,
          data.sm_hours_jtd,
          data.total_hours_estimate,
          data.total_hours_jtd,
          data.customer_number,
          data.customer_name,
          data.ship_city,
          data.ship_state,
          data.ship_zip,
          data.primary_market,
          data.negotiated_work,
          data.delivery_method,
          data.raw_data,
          batchId
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
        c.customer_facility as linked_customer_facility,
        c.customer_owner as linked_customer_owner,
        d.name as linked_department_name
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

        // Match by customer_name (exact match on customer_owner)
        if (contract.customer_name) {
          const customer = await client.query(
            'SELECT id FROM customers WHERE tenant_id = $1 AND LOWER(customer_owner) = LOWER($2)',
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
            'SELECT id FROM customers WHERE tenant_id = $1 AND LOWER(customer_owner) = LOWER($2)',
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
        -- Titan Customers (count unique companies/owners, not facilities)
        (SELECT COUNT(DISTINCT customer_owner) FROM customers WHERE tenant_id = $1 AND customer_owner IS NOT NULL AND customer_owner != '') as titan_customers,
        (SELECT COUNT(DISTINCT c.customer_owner) FROM customers c WHERE c.tenant_id = $1 AND EXISTS (SELECT 1 FROM vp_customers vc WHERE vc.linked_customer_id = c.id)) as titan_customers_linked,

        -- Vista Vendors
        (SELECT COUNT(*) FROM vp_vendors) as vista_vendors,
        (SELECT COUNT(*) FROM vp_vendors WHERE active = true) as active_vendors,
        (SELECT COUNT(*) FROM vp_vendors WHERE linked_vendor_id IS NOT NULL) as linked_vendors,
        -- Titan Vendors
        (SELECT COUNT(*) FROM vendors WHERE tenant_id = $1) as titan_vendors,
        (SELECT COUNT(*) FROM vendors v WHERE tenant_id = $1 AND EXISTS (SELECT 1 FROM vp_vendors vv WHERE vv.linked_vendor_id = v.id)) as titan_vendors_linked,

        -- Vista Departments (unique department codes from contracts)
        (SELECT COUNT(DISTINCT department_code) FROM vp_contracts WHERE tenant_id = $1 AND department_code IS NOT NULL AND department_code != '') as vista_departments,
        -- Linked departments = contracts that have a linked_department_id
        (SELECT COUNT(DISTINCT linked_department_id) FROM vp_contracts WHERE tenant_id = $1 AND linked_department_id IS NOT NULL) as linked_departments,
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
  async findCustomerDuplicates(tenantId, minSimilarity = 0.5) {
    // Get all unlinked VP customers
    const vpCustomers = await db.query(
      `SELECT id, customer_number, name, city, state, active
       FROM vp_customers
       WHERE link_status = 'unmatched'
       ORDER BY name`
    );

    // Get Titan customers that are NOT already linked to a VP customer
    const titanCustomers = await db.query(
      `SELECT c.id, c.customer_owner, c.customer_facility, c.city, c.state
       FROM customers c
       LEFT JOIN vp_customers vpc ON vpc.linked_customer_id = c.id
       WHERE c.tenant_id = $1 AND vpc.id IS NULL
       ORDER BY c.customer_owner`,
      [tenantId]
    );

    const duplicates = [];

    for (const vpCust of vpCustomers.rows) {
      const vpName = vpCust.name || '';
      const matches = [];

      for (const titanCust of titanCustomers.rows) {
        // Compare VP name against both customer_owner and customer_facility
        const ownerSimilarity = this._calculateSimilarity(vpName, titanCust.customer_owner || '');
        const facilitySimilarity = this._calculateSimilarity(vpName, titanCust.customer_facility || '');

        // Use the best match
        const nameSimilarity = Math.max(ownerSimilarity, facilitySimilarity);

        // Boost score if city/state match
        const locationMatch = vpCust.city && titanCust.city &&
          vpCust.city.toLowerCase() === titanCust.city.toLowerCase();

        const finalSimilarity = locationMatch ? Math.min(nameSimilarity + 0.1, 1.0) : nameSimilarity;

        if (finalSimilarity >= minSimilarity) {
          matches.push({
            titan_id: titanCust.id,
            titan_owner: titanCust.customer_owner,
            titan_facility: titanCust.customer_facility,
            titan_location: titanCust.city && titanCust.state ? `${titanCust.city}, ${titanCust.state}` : '',
            similarity: Math.round(finalSimilarity * 100) / 100,
            matched_on: ownerSimilarity >= facilitySimilarity ? 'owner' : 'facility',
            location_match: locationMatch
          });
        }
      }

      // Sort matches by similarity descending
      matches.sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        duplicates.push({
          vp_id: vpCust.id,
          vp_customer_number: vpCust.customer_number,
          vp_name: vpName,
          vp_location: vpCust.city && vpCust.state ? `${vpCust.city}, ${vpCust.state}` : '',
          vp_active: vpCust.active,
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
        // Generate a unique placeholder email since it's required
        // Use both employee_number and vp_id to ensure uniqueness
        const email = `vp${vpEmp.employee_number || ''}_${vpEmp.id}@tweetgarot.imported`;

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

        imported++;
        results.push({
          vp_id: vpEmp.id,
          titan_id: newEmployee.rows[0].id,
          name: `${vpEmp.first_name} ${vpEmp.last_name}`.trim()
        });
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

  // Import unmatched VP customers as new Titan customers
  async importUnmatchedCustomersToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP customers
      const unlinked = await client.query(
        `SELECT id, customer_number, name, address, address2, city, state, zip, active
         FROM vp_customers
         WHERE link_status = 'unmatched'
         ORDER BY name`
      );

      for (const vpCust of unlinked.rows) {
        // Create new Titan customer (using VP name as customer_owner)
        const newCustomer = await client.query(
          `INSERT INTO customers (
            tenant_id, customer_owner, customer_facility, address, city, state, zip_code, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id`,
          [
            tenantId,
            vpCust.name || 'Unknown',
            vpCust.name || 'Unknown', // Use same as owner initially
            vpCust.address || '',
            vpCust.city || '',
            vpCust.state || '',
            vpCust.zip || ''
          ]
        );

        // Link the VP customer to the new Titan customer
        await client.query(
          `UPDATE vp_customers SET
            linked_customer_id = $1,
            link_status = 'manual_matched',
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE id = $3`,
          [newCustomer.rows[0].id, userId, vpCust.id]
        );

        imported++;
        results.push({
          vp_id: vpCust.id,
          titan_id: newCustomer.rows[0].id,
          name: vpCust.name
        });
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

  // Get duplicates summary stats
  async getDuplicatesStats(tenantId) {
    const employeeDuplicates = await this.findEmployeeDuplicates(tenantId);
    const customerDuplicates = await this.findCustomerDuplicates(tenantId);

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
        total_unlinked: customerDuplicates.length,
        with_high_confidence: customerDuplicates.filter(d => d.potential_matches[0]?.similarity >= 0.8).length,
        with_medium_confidence: customerDuplicates.filter(d => {
          const sim = d.potential_matches[0]?.similarity;
          return sim >= 0.6 && sim < 0.8;
        }).length,
        with_low_confidence: customerDuplicates.filter(d => {
          const sim = d.potential_matches[0]?.similarity;
          return sim >= 0.5 && sim < 0.6;
        }).length
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
      `SELECT p.id, p.number, p.name, p.status, c.customer_owner
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

      if (matches.length > 0) {
        // Count how many UNLINKED contracts/work orders use this department code
        const usageCount = await db.query(
          `SELECT
            (SELECT COUNT(*) FROM vp_contracts WHERE tenant_id = $1 AND department_code = $2 AND linked_department_id IS NULL) as contracts,
            (SELECT COUNT(*) FROM vp_work_orders WHERE tenant_id = $1 AND department_code = $2 AND linked_department_id IS NULL) as work_orders`,
          [tenantId, vpDept.department_code]
        );

        duplicates.push({
          vp_department_code: vpDept.department_code,
          usage_count: {
            contracts: parseInt(usageCount.rows[0].contracts),
            work_orders: parseInt(usageCount.rows[0].work_orders)
          },
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

        imported++;
        results.push({
          vp_id: vpVendor.id,
          titan_id: newVendor.rows[0].id,
          name: vpVendor.name
        });
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

  // Import unmatched VP contracts as new Titan projects
  async importUnmatchedContractsToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP contracts (including orphaned auto_matched ones without actual project links)
      const unlinked = await client.query(
        `SELECT id, contract_number, description, customer_name, department_code,
                contract_amount, status, employee_number, project_manager_name, linked_department_id
         FROM vp_contracts
         WHERE tenant_id = $1 AND linked_project_id IS NULL
           AND (link_status = 'unmatched' OR link_status = 'auto_matched')
         ORDER BY contract_number`,
        [tenantId]
      );

      for (const vpContract of unlinked.rows) {
        // Look up the employee by employee_number to set as project manager
        let managerId = null;
        if (vpContract.employee_number) {
          const employeeResult = await client.query(
            `SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2 LIMIT 1`,
            [tenantId, String(vpContract.employee_number)]
          );
          if (employeeResult.rows.length > 0) {
            managerId = employeeResult.rows[0].id;
          }
        }

        // Map VP status to Titan status (default to 'Open' if empty)
        const projectStatus = vpContract.status && vpContract.status.trim() !== ''
          ? vpContract.status
          : 'Open';

        // Create new Titan project with manager_id, department_id, and VP status
        const newProject = await client.query(
          `INSERT INTO projects (
            tenant_id, number, name, client, status, manager_id, department_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id`,
          [
            tenantId,
            vpContract.contract_number || '',
            vpContract.description || vpContract.contract_number || 'Imported Contract',
            vpContract.customer_name || 'Unknown Client',
            projectStatus,
            managerId,
            vpContract.linked_department_id || null
          ]
        );

        // Link the VP contract to the new Titan project
        await client.query(
          `UPDATE vp_contracts SET
            linked_project_id = $1,
            link_status = 'manual_matched',
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE id = $3`,
          [newProject.rows[0].id, userId, vpContract.id]
        );

        imported++;
        results.push({
          vp_id: vpContract.id,
          titan_id: newProject.rows[0].id,
          name: vpContract.description || vpContract.contract_number
        });
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

  // Import unmatched VP work orders as new Titan projects
  async importUnmatchedWorkOrdersToTitan(tenantId, userId) {
    const client = await db.getClient();
    let imported = 0;
    const results = [];

    try {
      await client.query('BEGIN');

      // Get all unlinked VP work orders
      const unlinked = await client.query(
        `SELECT id, work_order_number, description, customer_name, department_code,
                contract_amount, status, employee_number, project_manager_name, linked_department_id
         FROM vp_work_orders
         WHERE tenant_id = $1 AND link_status = 'unmatched'
         ORDER BY work_order_number`,
        [tenantId]
      );

      for (const vpWorkOrder of unlinked.rows) {
        // Look up the employee by employee_number to set as project manager
        let managerId = null;
        if (vpWorkOrder.employee_number) {
          const employeeResult = await client.query(
            `SELECT id FROM employees WHERE tenant_id = $1 AND employee_number = $2 LIMIT 1`,
            [tenantId, String(vpWorkOrder.employee_number)]
          );
          if (employeeResult.rows.length > 0) {
            managerId = employeeResult.rows[0].id;
          }
        }

        // Map VP status to Titan status (default to 'Open' if empty)
        const projectStatus = vpWorkOrder.status && vpWorkOrder.status.trim() !== ''
          ? vpWorkOrder.status
          : 'Open';

        // Create new Titan project with WO- prefix
        const newProject = await client.query(
          `INSERT INTO projects (
            tenant_id, number, name, client, status, manager_id, department_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id`,
          [
            tenantId,
            'WO-' + (vpWorkOrder.work_order_number || ''),
            vpWorkOrder.description || 'Work Order ' + vpWorkOrder.work_order_number || 'Imported Work Order',
            vpWorkOrder.customer_name || 'Unknown Client',
            projectStatus,
            managerId,
            vpWorkOrder.linked_department_id || null
          ]
        );

        // Link the VP work order to the new Titan project (we'll use a new column or just mark as manual_matched)
        await client.query(
          `UPDATE vp_work_orders SET
            link_status = 'manual_matched',
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $1
          WHERE id = $2`,
          [userId, vpWorkOrder.id]
        );

        imported++;
        results.push({
          vp_id: vpWorkOrder.id,
          titan_id: newProject.rows[0].id,
          name: vpWorkOrder.description || vpWorkOrder.work_order_number
        });
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

        // Only count as imported if it was actually a new record
        if (newDepartment.rows[0]?.is_new) {
          imported++;
        }
        results.push({
          titan_id: newDepartment.rows[0].id,
          department_code: vpDept.department_code
        });
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

  // Auto-link VP customers to Titan customers where similarity >= 100% (rounded)
  async autoLinkExactCustomerMatches(tenantId, userId) {
    // Use the existing similarity-based duplicate finder to get 100% matches
    const duplicates = await this.findCustomerDuplicates(tenantId, 0.995);

    const client = await db.getClient();
    let totalLinked = 0;
    const linkedCustomers = [];

    try {
      await client.query('BEGIN');

      for (const dup of duplicates) {
        // Get the top match if it's >= 100% (after rounding)
        const topMatch = dup.potential_matches[0];
        if (!topMatch || topMatch.similarity < 1.0) continue;

        // Check if this Titan customer is already linked to another VP customer
        const existingLink = await client.query(
          `SELECT id FROM vp_customers WHERE linked_customer_id = $1 AND id != $2`,
          [topMatch.titan_id, dup.vp_id]
        );
        if (existingLink.rows.length > 0) continue;

        // Link the VP customer to Titan customer
        await client.query(
          `UPDATE vp_customers SET
            linked_customer_id = $1,
            link_status = 'auto_matched',
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE id = $3`,
          [topMatch.titan_id, userId, dup.vp_id]
        );

        totalLinked++;
        linkedCustomers.push({
          vp_id: dup.vp_id,
          vp_customer_number: dup.vp_customer_number,
          vp_name: dup.vp_name,
          titan_id: topMatch.titan_id,
          titan_owner: topMatch.titan_owner,
          titan_facility: topMatch.titan_facility
        });
      }

      await client.query('COMMIT');

      return {
        customers_linked: totalLinked,
        details: linkedCustomers
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Auto-link ALL VP customers that have any match (links top match for each)
  async autoLinkAllCustomerMatches(tenantId, userId) {
    // Use the existing similarity-based duplicate finder to get ALL matches
    const duplicates = await this.findCustomerDuplicates(tenantId, 0.5);

    const client = await db.getClient();
    let totalLinked = 0;
    const linkedCustomers = [];

    try {
      await client.query('BEGIN');

      for (const dup of duplicates) {
        // Get the top match (highest similarity)
        const topMatch = dup.potential_matches[0];
        if (!topMatch) continue;

        // Check if this Titan customer is already linked to another VP customer
        const existingLink = await client.query(
          `SELECT id FROM vp_customers WHERE linked_customer_id = $1 AND id != $2`,
          [topMatch.titan_id, dup.vp_id]
        );
        if (existingLink.rows.length > 0) continue;

        // Link the VP customer to Titan customer
        await client.query(
          `UPDATE vp_customers SET
            linked_customer_id = $1,
            link_status = 'auto_matched',
            linked_at = CURRENT_TIMESTAMP,
            linked_by = $2
          WHERE id = $3`,
          [topMatch.titan_id, userId, dup.vp_id]
        );

        totalLinked++;
        linkedCustomers.push({
          vp_id: dup.vp_id,
          vp_customer_number: dup.vp_customer_number,
          vp_name: dup.vp_name,
          titan_id: topMatch.titan_id,
          titan_owner: topMatch.titan_owner,
          titan_facility: topMatch.titan_facility,
          similarity: topMatch.similarity
        });
      }

      await client.query('COMMIT');

      return {
        customers_linked: totalLinked,
        details: linkedCustomers
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
      `SELECT p.id, p.project_number, p.name, p.status, p.created_at
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
      `SELECT e.id, e.employee_number, e.first_name, e.last_name, e.email, e.active
       FROM employees e
       LEFT JOIN vp_employees vpe ON vpe.linked_employee_id = e.id
       WHERE e.tenant_id = $1 AND vpe.id IS NULL
       ORDER BY e.last_name, e.first_name`,
      [tenantId]
    );
    return result.rows;
  },

  async getTitanOnlyCustomers(tenantId) {
    // Get unique owners that don't have any facility linked to Vista
    const result = await db.query(
      `SELECT DISTINCT c.customer_owner as name, MIN(c.id) as id, COUNT(*) as facility_count
       FROM customers c
       LEFT JOIN vp_customers vpc ON vpc.linked_customer_id = c.id
       WHERE c.tenant_id = $1
         AND c.customer_owner IS NOT NULL
         AND c.customer_owner != ''
         AND vpc.id IS NULL
       GROUP BY c.customer_owner
       ORDER BY c.customer_owner`,
      [tenantId]
    );
    return result.rows;
  },

  async getTitanOnlyVendors(tenantId) {
    const result = await db.query(
      `SELECT v.id, v.name, v.city, v.state, v.active
       FROM vendors v
       LEFT JOIN vp_vendors vpv ON vpv.linked_vendor_id = v.id
       WHERE v.tenant_id = $1 AND vpv.id IS NULL
       ORDER BY v.name`,
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
  }
};

module.exports = VistaData;
