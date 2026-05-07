const db = require('../config/database');

const PhaseSchedule = {
  async getPhaseCodesByProject(projectId, tenantId) {
    // Deduplicate across jobs: same (cost_type, phase) in multiple jobs
    // linked to the same project gets merged into a single row with summed values
    const result = await db.query(
      `SELECT
         MIN(pc.id) as id,
         pc.tenant_id,
         MIN(pc.contract) as contract,
         MIN(pc.job) as job,
         MIN(pc.job_description) as job_description,
         pc.cost_type,
         pc.phase,
         MIN(pc.phase_description) as phase_description,
         SUM(pc.est_hours) as est_hours,
         SUM(pc.est_cost) as est_cost,
         SUM(pc.jtd_hours) as jtd_hours,
         SUM(pc.jtd_cost) as jtd_cost,
         SUM(pc.committed_cost) as committed_cost,
         SUM(pc.projected_cost) as projected_cost,
         CASE WHEN SUM(pc.est_cost) > 0
           THEN SUM(pc.est_cost * pc.percent_complete) / SUM(pc.est_cost)
           ELSE 0 END as percent_complete,
         $2::integer as linked_project_id,
         array_agg(pc.id ORDER BY pc.id) as all_ids
       FROM vp_phase_codes pc
       WHERE pc.tenant_id = $1 AND pc.linked_project_id = $2
       GROUP BY pc.tenant_id, pc.cost_type, pc.phase
       ORDER BY MIN(pc.job), pc.cost_type, pc.phase`,
      [tenantId, projectId]
    );
    return result.rows;
  },

  async getScheduleItems(projectId, tenantId) {
    const result = await db.query(
      `SELECT psi.id, psi.project_id, psi.tenant_id, psi.name, psi.phase_code_ids, psi.cost_types,
         COALESCE(psi.row_number, ROW_NUMBER() OVER (PARTITION BY psi.project_id ORDER BY psi.sort_order, psi.id))::integer as row_number,
         psi.predecessor_id,
         psi.start_date, psi.end_date, psi.contour_type,
         psi.use_manual_values, psi.manual_monthly_values,
         COALESCE(pc_agg.sum_est_cost, 0) as total_est_cost,
         COALESCE(pc_agg.sum_est_hours, 0) as total_est_hours,
         COALESCE(pc_agg.sum_jtd_cost, 0) as total_jtd_cost,
         COALESCE(pc_agg.sum_jtd_hours, 0) as total_jtd_hours,
         COALESCE(pc_agg.sum_projected_cost, 0) as total_projected_cost,
         CASE WHEN psi.percent_complete > 0 THEN psi.percent_complete ELSE COALESCE(pc_agg.weighted_pct, 0) END as percent_complete,
         psi.quantity, psi.quantity_uom, psi.quantity_installed,
         psi.use_manual_qty_values, psi.manual_monthly_qty,
         psi.sort_order, psi.created_by, psi.created_at, psi.updated_at,
         u.first_name || ' ' || u.last_name as created_by_name,
         (SELECT string_agg(DISTINCT rtrim(trim(pc.phase), '- '), ', ' ORDER BY rtrim(trim(pc.phase), '- '))
          FROM vp_phase_codes pc WHERE pc.id = ANY(psi.phase_code_ids)) as phase_code_display
       FROM phase_schedule_items psi
       LEFT JOIN users u ON psi.created_by = u.id
       LEFT JOIN LATERAL (
         SELECT
           SUM(pc.est_cost) as sum_est_cost,
           SUM(pc.est_hours) as sum_est_hours,
           SUM(pc.jtd_cost) as sum_jtd_cost,
           SUM(pc.jtd_hours) as sum_jtd_hours,
           SUM(pc.projected_cost) as sum_projected_cost,
           CASE WHEN SUM(pc.est_cost) > 0
             THEN SUM(pc.est_cost * pc.percent_complete) / SUM(pc.est_cost)
             ELSE 0 END as weighted_pct
         FROM vp_phase_codes pc
         WHERE pc.id = ANY(psi.phase_code_ids)
       ) pc_agg ON true
       WHERE psi.project_id = $1 AND psi.tenant_id = $2
       ORDER BY psi.sort_order, psi.id`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  async getScheduleItemById(id, tenantId) {
    const result = await db.query(
      `SELECT psi.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM phase_schedule_items psi
       LEFT JOIN users u ON psi.created_by = u.id
       WHERE psi.id = $1 AND psi.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async createScheduleItem(data) {
    // Auto-assign row_number if not provided
    let rowNumber = data.row_number;
    if (!rowNumber) {
      const maxRow = await db.query(
        'SELECT COALESCE(MAX(row_number), 0) as max_row FROM phase_schedule_items WHERE project_id = $1',
        [data.project_id]
      );
      rowNumber = maxRow.rows[0].max_row + 1;
    }

    const result = await db.query(
      `INSERT INTO phase_schedule_items (
        project_id, tenant_id, name, phase_code_ids, cost_types,
        start_date, end_date, contour_type, use_manual_values, manual_monthly_values,
        total_est_cost, total_est_hours, total_jtd_cost, total_jtd_hours, total_projected_cost,
        quantity, quantity_uom, quantity_installed,
        use_manual_qty_values, manual_monthly_qty,
        sort_order, created_by, row_number, predecessor_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        data.project_id, data.tenant_id, data.name, data.phase_code_ids, data.cost_types,
        data.start_date || null, data.end_date || null,
        data.contour_type || 'flat', data.use_manual_values || false,
        data.manual_monthly_values ? JSON.stringify(data.manual_monthly_values) : null,
        data.total_est_cost || 0, data.total_est_hours || 0, data.total_jtd_cost || 0, data.total_jtd_hours || 0, data.total_projected_cost || 0,
        data.quantity || null, data.quantity_uom || null, data.quantity_installed || 0,
        data.use_manual_qty_values || false,
        data.manual_monthly_qty ? JSON.stringify(data.manual_monthly_qty) : null,
        data.sort_order || 0, data.created_by, rowNumber, data.predecessor_id || null
      ]
    );
    return result.rows[0];
  },

  async updateScheduleItem(id, data, tenantId) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = {
      name: 'name',
      start_date: 'start_date',
      end_date: 'end_date',
      contour_type: 'contour_type',
      use_manual_values: 'use_manual_values',
      manual_monthly_values: 'manual_monthly_values',
      total_est_cost: 'total_est_cost',
      total_est_hours: 'total_est_hours',
      total_jtd_cost: 'total_jtd_cost',
      total_jtd_hours: 'total_jtd_hours',
      total_projected_cost: 'total_projected_cost',
      percent_complete: 'percent_complete',
      quantity: 'quantity',
      quantity_uom: 'quantity_uom',
      quantity_installed: 'quantity_installed',
      use_manual_qty_values: 'use_manual_qty_values',
      manual_monthly_qty: 'manual_monthly_qty',
      sort_order: 'sort_order',
      phase_code_ids: 'phase_code_ids',
      cost_types: 'cost_types',
      row_number: 'row_number',
      predecessor_id: 'predecessor_id'
    };

    for (const [key, column] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = $${paramIndex}`);
        const val = (key === 'manual_monthly_values' || key === 'manual_monthly_qty') && data[key]
          ? JSON.stringify(data[key])
          : data[key];
        values.push(val);
        paramIndex++;
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, tenantId);

    const result = await db.query(
      `UPDATE phase_schedule_items SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteScheduleItem(id, tenantId) {
    const result = await db.query(
      'DELETE FROM phase_schedule_items WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows[0];
  },

  async bulkCreateFromPhaseCodes(projectId, phaseCodeIds, groupBy, tenantId, userId) {
    // Get the phase codes
    const phaseCodesResult = await db.query(
      `SELECT * FROM vp_phase_codes WHERE id = ANY($1) AND tenant_id = $2`,
      [phaseCodeIds, tenantId]
    );
    const phaseCodes = phaseCodesResult.rows;

    if (phaseCodes.length === 0) return [];

    // Get current max sort_order
    const maxOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM phase_schedule_items WHERE project_id = $1',
      [projectId]
    );
    let sortOrder = maxOrder.rows[0].max_order + 1;

    const groups = new Map();

    if (groupBy === 'phase') {
      // Group by phase code - combine all cost types for same phase
      for (const pc of phaseCodes) {
        const key = `${pc.job}|${pc.phase}`;
        if (!groups.has(key)) {
          groups.set(key, { ids: [], costTypes: new Set(), name: pc.phase_description, estCost: 0, estHours: 0, jtdCost: 0, jtdHours: 0, projCost: 0 });
        }
        const group = groups.get(key);
        group.ids.push(pc.id);
        group.costTypes.add(pc.cost_type);
        group.estCost += parseFloat(pc.est_cost) || 0;
        group.estHours += parseFloat(pc.est_hours) || 0;
        group.jtdCost += parseFloat(pc.jtd_cost) || 0;
        group.jtdHours += parseFloat(pc.jtd_hours) || 0;
        group.projCost += parseFloat(pc.projected_cost) || 0;
      }
    } else if (groupBy === 'cost_type') {
      // Group by cost type - combine all phases for same cost type
      const costTypeNames = { 1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions' };
      for (const pc of phaseCodes) {
        const key = `ct_${pc.cost_type}`;
        if (!groups.has(key)) {
          groups.set(key, { ids: [], costTypes: new Set([pc.cost_type]), name: costTypeNames[pc.cost_type] || `Cost Type ${pc.cost_type}`, estCost: 0, estHours: 0, jtdCost: 0, jtdHours: 0, projCost: 0 });
        }
        const group = groups.get(key);
        group.ids.push(pc.id);
        group.estCost += parseFloat(pc.est_cost) || 0;
        group.estHours += parseFloat(pc.est_hours) || 0;
        group.jtdCost += parseFloat(pc.jtd_cost) || 0;
        group.jtdHours += parseFloat(pc.jtd_hours) || 0;
        group.projCost += parseFloat(pc.projected_cost) || 0;
      }
    } else {
      // Individual - each phase code is its own item
      const costTypeNames = { 1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions' };
      for (const pc of phaseCodes) {
        const key = `${pc.id}`;
        const ctLabel = costTypeNames[pc.cost_type] || `CT${pc.cost_type}`;
        groups.set(key, {
          ids: [pc.id],
          costTypes: new Set([pc.cost_type]),
          name: `${pc.phase_description} (${ctLabel})`,
          estCost: parseFloat(pc.est_cost) || 0,
          estHours: parseFloat(pc.est_hours) || 0,
          jtdCost: parseFloat(pc.jtd_cost) || 0,
          jtdHours: parseFloat(pc.jtd_hours) || 0,
          projCost: parseFloat(pc.projected_cost) || 0
        });
      }
    }

    const created = [];
    for (const [, group] of groups) {
      const item = await this.createScheduleItem({
        project_id: projectId,
        tenant_id: tenantId,
        name: group.name,
        phase_code_ids: group.ids,
        cost_types: [...group.costTypes],
        total_est_cost: group.estCost,
        total_est_hours: group.estHours,
        total_jtd_cost: group.jtdCost,
        total_jtd_hours: group.jtdHours,
        total_projected_cost: group.projCost,
        sort_order: sortOrder++,
        created_by: userId
      });
      created.push(item);
    }

    return created;
  },

  async reorder(projectId, itemIds, tenantId) {
    for (let i = 0; i < itemIds.length; i++) {
      await db.query(
        'UPDATE phase_schedule_items SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND project_id = $3 AND tenant_id = $4',
        [i, itemIds[i], projectId, tenantId]
      );
    }
    return true;
  },

  // Sync `quantity` and `quantity_installed` on phase_schedule_items by aggregating
  // matching rows from the latest stratus_imports for the project. Hours and costs
  // are explicitly NOT touched. Items with quantity_uom not in ('LF','EA') are skipped.
  // - LF: quantity = SUM(length); quantity_installed = SUM(length where status=Field Installed)
  // - EA: quantity = COUNT(*);    quantity_installed = COUNT(*) where status=Field Installed
  // Phase strings are normalized via RTRIM(TRIM(phase),'- ') on both sides so that
  // trailing dashes/spaces in vp_phase_codes don't prevent a match.
  async syncStratusQuantities(projectId, tenantId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Latest import for this project
      const importRow = await client.query(
        `SELECT id FROM stratus_imports
         WHERE tenant_id = $1 AND project_id = $2
         ORDER BY imported_at DESC LIMIT 1`,
        [tenantId, projectId]
      );
      if (importRow.rowCount === 0) {
        await client.query('ROLLBACK');
        return { import_id: null, updated: [], skipped: [], message: 'No Stratus import found for this project.' };
      }
      const importId = importRow.rows[0].id;

      // Pull schedule items + their normalized phase keys
      const itemsResult = await client.query(
        `SELECT psi.id,
                psi.name,
                psi.quantity_uom,
                psi.quantity AS old_quantity,
                psi.quantity_installed AS old_installed,
                ARRAY(
                  SELECT DISTINCT RTRIM(TRIM(pc.phase), '- ')
                  FROM vp_phase_codes pc
                  WHERE pc.id = ANY(psi.phase_code_ids) AND pc.tenant_id = $2
                ) AS phase_keys
         FROM phase_schedule_items psi
         WHERE psi.project_id = $1 AND psi.tenant_id = $2`,
        [projectId, tenantId]
      );

      const updated = [];
      const skipped = [];

      for (const item of itemsResult.rows) {
        const uom = (item.quantity_uom || '').toUpperCase();
        if (uom !== 'LF' && uom !== 'EA') {
          skipped.push({ id: item.id, name: item.name, reason: `UOM '${item.quantity_uom || '(none)'}' is not LF or EA` });
          continue;
        }
        if (!item.phase_keys || item.phase_keys.length === 0) {
          skipped.push({ id: item.id, name: item.name, reason: 'No phase codes linked' });
          continue;
        }

        const agg = await client.query(
          `SELECT
             COALESCE(SUM(length), 0)::numeric AS total_length,
             COALESCE(SUM(CASE WHEN part_tracking_status = 'Field Installed' THEN length ELSE 0 END), 0)::numeric AS installed_length,
             COUNT(*)::int AS total_count,
             COUNT(*) FILTER (WHERE part_tracking_status = 'Field Installed')::int AS installed_count
           FROM stratus_parts
           WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3
             AND RTRIM(TRIM(part_field_phase_code), '- ') = ANY($4::text[])`,
          [tenantId, projectId, importId, item.phase_keys]
        );

        const a = agg.rows[0];
        let newQty;
        let newInstalled;
        if (uom === 'LF') {
          newQty = Number(a.total_length);
          newInstalled = Number(a.installed_length);
        } else {
          newQty = a.total_count;
          newInstalled = a.installed_count;
        }

        // Skip a row if nothing matched in Stratus (don't zero out manual data silently)
        if (newQty === 0 && a.total_count === 0) {
          skipped.push({ id: item.id, name: item.name, reason: 'No matching Stratus parts for these phase codes' });
          continue;
        }

        await client.query(
          `UPDATE phase_schedule_items
           SET quantity = $1, quantity_installed = $2, updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [newQty, newInstalled, item.id, tenantId]
        );

        updated.push({
          id: item.id,
          name: item.name,
          quantity_uom: item.quantity_uom,
          old_quantity: Number(item.old_quantity),
          new_quantity: newQty,
          old_installed: Number(item.old_installed),
          new_installed: newInstalled,
        });
      }

      await client.query('COMMIT');
      return { import_id: importId, updated, skipped };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = PhaseSchedule;
