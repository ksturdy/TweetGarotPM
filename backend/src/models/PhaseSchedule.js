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
         array_agg(pc.id ORDER BY pc.id) as all_ids,
         BOOL_OR(pc.is_provisional) as is_provisional
       FROM vp_phase_codes pc
       WHERE pc.tenant_id = $1 AND pc.linked_project_id = $2
         AND pc.reconciled_at IS NULL
       GROUP BY pc.tenant_id, pc.cost_type, pc.phase
       ORDER BY MIN(pc.job), pc.cost_type, pc.phase`,
      [tenantId, projectId]
    );
    return result.rows;
  },

  async getScheduleItems(projectId, tenantId) {
    const result = await db.query(
      `WITH active_version AS (
         SELECT id FROM gc_schedule_versions
         WHERE tenant_id = $2 AND project_id = $1 AND parse_status = 'completed'
         ORDER BY uploaded_at DESC LIMIT 1
       ),
       link_agg AS (
         SELECT
           l.schedule_item_id,
           json_agg(
             json_build_object(
               'activity_id',   l.gc_activity_id,
               'activity_name', a.activity_name,
               'wbs_code',      a.wbs_code,
               'start_date',    a.start_date,
               'finish_date',   a.finish_date,
               'missing',       (a.id IS NULL)
             ) ORDER BY l.gc_activity_id
           ) AS linked_gc_activities,
           MIN(a.start_date)  FILTER (WHERE a.start_date  IS NOT NULL) AS derived_start,
           MAX(a.finish_date) FILTER (WHERE a.finish_date IS NOT NULL) AS derived_end,
           COUNT(a.id)::int AS resolved_count
         FROM phase_code_activity_links l
         LEFT JOIN gc_schedule_activities a
           ON a.activity_id = l.gc_activity_id
          AND a.version_id  = (SELECT id FROM active_version)
         WHERE l.tenant_id = $2 AND l.project_id = $1
         GROUP BY l.schedule_item_id
       )
       SELECT psi.id, psi.project_id, psi.tenant_id, psi.name, psi.phase_code_ids, psi.cost_types,
         COALESCE(psi.row_number, ROW_NUMBER() OVER (PARTITION BY psi.project_id ORDER BY psi.sort_order, psi.id))::integer as row_number,
         psi.predecessor_id,
         COALESCE(la.derived_start, psi.start_date) as start_date,
         COALESCE(la.derived_end,   psi.end_date)   as end_date,
         psi.start_date as manual_start_date,
         psi.end_date   as manual_end_date,
         psi.contour_type,
         psi.use_manual_values, psi.manual_monthly_values,
         COALESCE(pc_agg.sum_est_cost, 0) as total_est_cost,
         COALESCE(pc_agg.sum_est_hours, 0) as total_est_hours,
         COALESCE(pc_agg.sum_jtd_cost, 0) as total_jtd_cost,
         COALESCE(pc_agg.sum_jtd_hours, 0) as total_jtd_hours,
         COALESCE(pc_agg.sum_projected_cost, 0) as total_projected_cost,
         COALESCE(pc_agg.has_provisional, FALSE) as has_provisional,
         CASE WHEN psi.percent_complete > 0 THEN psi.percent_complete ELSE COALESCE(pc_agg.weighted_pct, 0) END as percent_complete,
         psi.quantity, psi.quantity_uom, psi.quantity_installed,
         psi.use_manual_qty_values, psi.manual_monthly_qty,
         psi.billable_rate_id,
         psi.sort_order, psi.created_by, psi.created_at, psi.updated_at,
         u.first_name || ' ' || u.last_name as created_by_name,
         (SELECT string_agg(DISTINCT rtrim(trim(pc.phase), '- '), ', ' ORDER BY rtrim(trim(pc.phase), '- '))
          FROM vp_phase_codes pc WHERE pc.id = ANY(psi.phase_code_ids)) as phase_code_display,
         COALESCE(la.linked_gc_activities, '[]'::json) as linked_gc_activities,
         COALESCE(la.resolved_count, 0) as linked_resolved_count,
         (SELECT id FROM active_version) as active_gc_version_id
       FROM phase_schedule_items psi
       LEFT JOIN users u ON psi.created_by = u.id
       LEFT JOIN link_agg la ON la.schedule_item_id = psi.id
       LEFT JOIN LATERAL (
         SELECT
           SUM(pc.est_cost) as sum_est_cost,
           SUM(pc.est_hours) as sum_est_hours,
           SUM(pc.jtd_cost) as sum_jtd_cost,
           SUM(pc.jtd_hours) as sum_jtd_hours,
           SUM(pc.projected_cost) as sum_projected_cost,
           CASE WHEN SUM(pc.est_cost) > 0
             THEN SUM(pc.est_cost * pc.percent_complete) / SUM(pc.est_cost)
             ELSE 0 END as weighted_pct,
           COALESCE(BOOL_OR(pc.is_provisional), FALSE) as has_provisional
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
      predecessor_id: 'predecessor_id',
      billable_rate_id: 'billable_rate_id'
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
  // are explicitly NOT touched.
  //
  // UOM behavior:
  //   - LF (or auto-inferred LF): quantity = SUM(length) of pipe-classified parts only
  //                               (fitting tail-lengths would dilute the pipe LF figure)
  //   - EA (or auto-inferred EA): quantity = COUNT(*) of all matching parts
  //   - LS / other non-LF-EA: skipped (lump-sum items aren't quantity-driven)
  //
  // Auto-inference: when an item's quantity_uom is NULL we look at its matching
  // Stratus parts and pick LF if any pipe-classified parts exist for that phase
  // (so length is meaningful), otherwise EA. We then set quantity_uom on the row
  // so subsequent syncs are deterministic.
  //
  // Phase strings are normalized via RTRIM(TRIM(phase),'- ') on both sides so
  // trailing dashes/spaces in vp_phase_codes don't prevent a match.
  async syncStratusQuantities(projectId, tenantId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

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
        const explicitUom = (item.quantity_uom || '').toUpperCase();
        // Items the user explicitly tagged as LS (or anything that isn't LF/EA/blank) opt out.
        if (explicitUom && explicitUom !== 'LF' && explicitUom !== 'EA') {
          skipped.push({ id: item.id, name: item.name, reason: `UOM '${item.quantity_uom}' is not LF or EA` });
          continue;
        }
        if (!item.phase_keys || item.phase_keys.length === 0) {
          skipped.push({ id: item.id, name: item.name, reason: 'No phase codes linked' });
          continue;
        }

        const agg = await client.query(
          `SELECT
             COUNT(*)::int AS total_count,
             COUNT(*) FILTER (WHERE part_tracking_status = 'Field Installed')::int AS installed_count,
             COUNT(*) FILTER (WHERE COALESCE(material_type_override, material_type) = 'pipe')::int AS pipe_count,
             COALESCE(SUM(CASE WHEN COALESCE(material_type_override, material_type) = 'pipe' THEN length ELSE 0 END), 0)::numeric AS pipe_length,
             COALESCE(SUM(CASE WHEN COALESCE(material_type_override, material_type) = 'pipe' AND part_tracking_status = 'Field Installed' THEN length ELSE 0 END), 0)::numeric AS pipe_length_installed
           FROM stratus_parts
           WHERE tenant_id = $1 AND project_id = $2 AND import_id = $3
             AND RTRIM(TRIM(part_field_phase_code), '- ') = ANY($4::text[])`,
          [tenantId, projectId, importId, item.phase_keys]
        );

        const a = agg.rows[0];
        if (a.total_count === 0) {
          skipped.push({ id: item.id, name: item.name, reason: 'No matching Stratus parts for these phase codes' });
          continue;
        }

        // If user set UOM, honor it; otherwise infer from the data.
        const useUom = explicitUom || (a.pipe_count > 0 ? 'LF' : 'EA');
        const inferred = !explicitUom;
        let newQty;
        let newInstalled;
        if (useUom === 'LF') {
          newQty = Number(a.pipe_length);
          newInstalled = Number(a.pipe_length_installed);
          // Possible: phase has parts but none classified pipe. Fall back to count.
          if (newQty === 0 && a.total_count > 0) {
            newQty = a.total_count;
            newInstalled = a.installed_count;
            // override the UOM since LF would have written 0
          }
        } else {
          newQty = a.total_count;
          newInstalled = a.installed_count;
        }

        await client.query(
          `UPDATE phase_schedule_items
           SET quantity = $1, quantity_installed = $2,
               quantity_uom = COALESCE(quantity_uom, $3),
               updated_at = NOW()
           WHERE id = $4 AND tenant_id = $5`,
          [newQty, newInstalled, useUom, item.id, tenantId]
        );

        updated.push({
          id: item.id,
          name: item.name,
          quantity_uom: useUom,
          uom_inferred: inferred,
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

  async listProvisionalByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT pc.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM vp_phase_codes pc
       LEFT JOIN users u ON u.id = pc.created_by_user_id
       WHERE pc.tenant_id = $1
         AND pc.linked_project_id = $2
         AND pc.is_provisional = TRUE
         AND pc.reconciled_at IS NULL
       ORDER BY pc.job, pc.cost_type, pc.phase`,
      [tenantId, projectId]
    );
    return result.rows;
  },

  async createProvisional(data, tenantId, userId) {
    // For provisional rows, mirror est_cost into projected_cost so the
    // cost-mode auto-distribution (which uses projected − jtd) has something
    // to spread. When the row is reconciled to a real Vista code later,
    // Vista's projected_cost takes over.
    const estCost = data.est_cost || 0;
    const result = await db.query(
      `INSERT INTO vp_phase_codes (
         tenant_id, contract, job, job_description, cost_type, phase, phase_description,
         est_hours, est_cost, projected_cost, linked_project_id,
         is_provisional, provisional_notes, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13)
       RETURNING *`,
      [
        tenantId,
        data.contract || null,
        data.job,
        data.job_description || null,
        data.cost_type,
        data.phase,
        data.phase_description || null,
        data.est_hours || 0,
        estCost,
        estCost,
        data.linked_project_id,
        data.provisional_notes || null,
        userId,
      ]
    );
    return result.rows[0];
  },

  async bulkCreateProvisional(rows, projectId, tenantId, userId) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const r of rows) {
        if (!r.job || !r.phase || r.cost_type == null) continue;
        const estCost = r.est_cost || 0;
        const ins = await client.query(
          `INSERT INTO vp_phase_codes (
             tenant_id, contract, job, job_description, cost_type, phase, phase_description,
             est_hours, est_cost, projected_cost, linked_project_id,
             is_provisional, provisional_notes, created_by_user_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13)
           ON CONFLICT (tenant_id, job, cost_type, phase) DO NOTHING
           RETURNING *`,
          [
            tenantId,
            r.contract || null,
            r.job,
            r.job_description || null,
            r.cost_type,
            r.phase,
            r.phase_description || null,
            r.est_hours || 0,
            estCost,
            estCost,
            projectId,
            r.provisional_notes || null,
            userId,
          ]
        );
        if (ins.rows[0]) inserted.push(ins.rows[0]);
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateProvisional(id, data, tenantId) {
    const allowed = {
      contract: 'contract',
      job: 'job',
      job_description: 'job_description',
      cost_type: 'cost_type',
      phase: 'phase',
      phase_description: 'phase_description',
      est_hours: 'est_hours',
      est_cost: 'est_cost',
      provisional_notes: 'provisional_notes',
    };
    const fields = [];
    const values = [];
    let i = 1;
    for (const [k, col] of Object.entries(allowed)) {
      if (data[k] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push(data[k]);
      }
    }
    // Mirror est_cost into projected_cost so cost-mode auto-distribution stays in sync.
    if (data.est_cost !== undefined) {
      fields.push(`projected_cost = $${i++}`);
      values.push(data.est_cost);
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE vp_phase_codes SET ${fields.join(', ')}
       WHERE id = $${i} AND tenant_id = $${i + 1}
         AND is_provisional = TRUE
         AND reconciled_at IS NULL
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteProvisional(id, tenantId) {
    const refs = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM phase_schedule_items
       WHERE tenant_id = $1 AND $2 = ANY(phase_code_ids)`,
      [tenantId, id]
    );
    if (refs.rows[0].n > 0) {
      const err = new Error('Provisional code is referenced by schedule items; remove it from those rows first.');
      err.code = 'PROVISIONAL_IN_USE';
      throw err;
    }
    const result = await db.query(
      `DELETE FROM vp_phase_codes
       WHERE id = $1 AND tenant_id = $2
         AND is_provisional = TRUE
         AND reconciled_at IS NULL
       RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  // ==================== STAGED RECONCILIATIONS ====================
  // Surfaces the side-by-side diff to the PM after Vista lands data on a
  // provisional row. Each pending row holds a snapshot of the provisional's
  // pre-Vista values so a reject can roll the vp_phase_codes row back.

  async listPendingReconciliations(projectId, tenantId) {
    const result = await db.query(
      `SELECT r.id, r.provisional_phase_code_id, r.snapshot, r.vista_import_batch_id,
              r.status, r.created_at,
              pc.id AS phase_code_id, pc.contract, pc.job, pc.job_description,
              pc.cost_type, pc.phase, pc.phase_description,
              pc.est_hours, pc.est_cost, pc.jtd_hours, pc.jtd_cost,
              pc.committed_cost, pc.projected_cost, pc.percent_complete,
              pc.is_provisional, pc.linked_project_id
       FROM pending_phase_code_reconciliations r
       JOIN vp_phase_codes pc ON pc.id = r.provisional_phase_code_id
       WHERE r.tenant_id = $1
         AND r.status = 'pending'
         AND pc.linked_project_id = $2
       ORDER BY pc.cost_type, pc.phase`,
      [tenantId, projectId]
    );
    return result.rows;
  },

  async countPendingReconciliations(projectId, tenantId) {
    const result = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM pending_phase_code_reconciliations r
       JOIN vp_phase_codes pc ON pc.id = r.provisional_phase_code_id
       WHERE r.tenant_id = $1 AND r.status = 'pending' AND pc.linked_project_id = $2`,
      [tenantId, projectId]
    );
    return result.rows[0].n;
  },

  // Accept: keep Vista's values (already on vp_phase_codes), flip the
  // provisional flag off so the PROV pill disappears and the row becomes
  // a normal Vista phase code.
  async acceptReconciliation(id, tenantId, userId) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `SELECT provisional_phase_code_id
         FROM pending_phase_code_reconciliations
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
         FOR UPDATE`,
        [id, tenantId]
      );
      if (r.rowCount === 0) {
        throw new Error('Pending reconciliation not found');
      }
      const pcId = r.rows[0].provisional_phase_code_id;
      // Clearing the CHECK constraint: cannot set reconciled_* unless still
      // provisional. We're flipping is_provisional to FALSE, so reconciled_*
      // must remain NULL — that's fine since this is auto-promote, not
      // tombstone.
      await client.query(
        `UPDATE vp_phase_codes
         SET is_provisional = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [pcId, tenantId]
      );
      await client.query(
        `UPDATE pending_phase_code_reconciliations
         SET status = 'accepted', decided_at = NOW(), decided_by_user_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [userId, id]
      );
      await client.query('COMMIT');
      return { id, action: 'accepted', phase_code_id: pcId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Reject: roll vp_phase_codes back to the snapshot (the values the PM had
  // typed). is_provisional stays TRUE. The row remains a candidate for
  // future Vista imports — next sync will create another pending row.
  async rejectReconciliation(id, tenantId, userId, notes) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `SELECT provisional_phase_code_id, snapshot
         FROM pending_phase_code_reconciliations
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
         FOR UPDATE`,
        [id, tenantId]
      );
      if (r.rowCount === 0) {
        throw new Error('Pending reconciliation not found');
      }
      const pcId = r.rows[0].provisional_phase_code_id;
      const snap = r.rows[0].snapshot || {};
      await client.query(
        `UPDATE vp_phase_codes
         SET contract = $1,
             job_description = $2,
             phase_description = $3,
             est_hours = $4,
             est_cost = $5,
             jtd_hours = $6,
             jtd_cost = $7,
             committed_cost = $8,
             projected_cost = $9,
             percent_complete = $10,
             prior_week_cost = $11,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 AND tenant_id = $13`,
        [
          snap.contract ?? null,
          snap.job_description ?? null,
          snap.phase_description ?? null,
          snap.est_hours ?? 0,
          snap.est_cost ?? 0,
          snap.jtd_hours ?? 0,
          snap.jtd_cost ?? 0,
          snap.committed_cost ?? 0,
          snap.projected_cost ?? 0,
          snap.percent_complete ?? 0,
          snap.prior_week_cost ?? 0,
          pcId,
          tenantId,
        ]
      );
      await client.query(
        `UPDATE pending_phase_code_reconciliations
         SET status = 'rejected', decided_at = NOW(), decided_by_user_id = $1,
             decision_notes = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [userId, notes || null, id]
      );
      await client.query('COMMIT');
      return { id, action: 'rejected', phase_code_id: pcId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Tombstone a provisional row by pointing it at a real vp_phase_codes row,
  // and rewrite every phase_schedule_items.phase_code_ids array that referenced
  // the provisional id so it now references the real id instead. If the real id
  // is already in the array, just remove the provisional id to avoid duplicates.
  async reconcileProvisional(provisionalId, realId, tenantId) {
    if (provisionalId === realId) {
      throw new Error('provisional and real phase code ids must differ');
    }
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const provRow = await client.query(
        `SELECT id, is_provisional, reconciled_at
         FROM vp_phase_codes
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [provisionalId, tenantId]
      );
      if (provRow.rowCount === 0 || !provRow.rows[0].is_provisional) {
        throw new Error('Source row is not a provisional phase code');
      }
      if (provRow.rows[0].reconciled_at) {
        throw new Error('Provisional row is already reconciled');
      }

      const realRow = await client.query(
        `SELECT id, is_provisional
         FROM vp_phase_codes
         WHERE id = $1 AND tenant_id = $2`,
        [realId, tenantId]
      );
      if (realRow.rowCount === 0) {
        throw new Error('Target Vista phase code not found');
      }
      if (realRow.rows[0].is_provisional) {
        throw new Error('Target row must be a real (non-provisional) Vista phase code');
      }

      const swap = await client.query(
        `UPDATE phase_schedule_items
         SET phase_code_ids = CASE
               WHEN $2 = ANY(phase_code_ids)
                 THEN array_remove(phase_code_ids, $1)
               ELSE array_replace(phase_code_ids, $1, $2)
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $3 AND $1 = ANY(phase_code_ids)
         RETURNING id`,
        [provisionalId, realId, tenantId]
      );

      await client.query(
        `UPDATE vp_phase_codes
         SET reconciled_to_id = $1,
             reconciled_at = NOW(),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3`,
        [realId, provisionalId, tenantId]
      );

      await client.query('COMMIT');
      return {
        provisional_id: provisionalId,
        real_id: realId,
        schedule_items_updated: swap.rowCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = PhaseSchedule;
