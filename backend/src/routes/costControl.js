const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ------------------------------------------------------------------
// Mapping: AI budget section names → CCM area name + cost types
// ------------------------------------------------------------------
const SECTION_MAP = {
  'Project Management':               { area: 'General Conditions', types: ['gen_conditions'],   desc: ['Project Management'] },
  'Sheet Metal - Supply Ductwork':    { area: 'Ductwork - Supply Air',   types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Sheet Metal - Return Ductwork':    { area: 'Ductwork - Return Air',   types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Sheet Metal - Exhaust Ductwork':   { area: 'Ductwork - Exhaust',      types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Sheet Metal - Outside Air Ductwork': { area: 'Ductwork - Outside Air', types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Sheet Metal Equipment':            { area: 'Sheet Metal Equipment',   types: ['equipment'],   desc: ['Equipment'] },
  'Piping - Hot Water':               { area: 'Piping - Hot Water',      types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Piping - Chilled Water':           { area: 'Piping - Chilled Water',  types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Piping - Domestic':                { area: 'Piping - Domestic',       types: ['labor_field', 'material'], desc: ['Field Labor', 'Material'] },
  'Piping Equipment':                 { area: 'Piping Equipment',        types: ['equipment'],   desc: ['Equipment'] },
  'Controls':                         { area: 'Controls',                types: ['subcontract'], desc: ['Controls Subcontract'] },
  'Insulation':                       { area: 'Insulation',              types: ['subcontract'], desc: ['Insulation Subcontract'] },
  'Balancing':                        { area: 'Balancing',               types: ['subcontract'], desc: ['Balancing Subcontract'] },
  'Electrical':                       { area: 'Electrical',              types: ['subcontract'], desc: ['Electrical Subcontract'] },
  'General Conditions':               { area: 'General Conditions',      types: ['gen_conditions'], desc: ['General Conditions'] },
};

// Mapping: estimate item_type → CCM cost_type
const ESTIMATE_TYPE_MAP = {
  labor: 'labor_field',
  material: 'material',
  equipment: 'equipment',
  subcontractor: 'subcontract',
  rental: 'equipment',
  other: 'gen_conditions',
};

function extractValuesFromSection(section, types) {
  const items = section.items || [];

  if (types.length === 1) {
    const type = types[0];
    if (type === 'labor_field') {
      const qty = items.reduce((s, i) => s + (i.hours || 0), 0) || null;
      const value = items.reduce((s, i) => s + (i.laborCost || i.totalCost || 0), 0) || section.subtotal;
      return [{ qty: qty || null, value: value || null, notes: null }];
    }
    if (type === 'equipment') {
      const qty = items.reduce((s, i) => s + (i.quantity || 0), 0) || null;
      const value = section.subtotal || null;
      const notes = items.map(i => i.description).filter(Boolean).join('; ') || null;
      return [{ qty, value, notes }];
    }
    // subcontract or gen_conditions — lump sum
    const value = section.subtotal || null;
    const notes = items.map(i => i.notes).filter(Boolean).join('; ') || null;
    return [{ qty: null, value, notes }];
  }

  // labor_field + material split
  const laborQty = items.reduce((s, i) => s + (i.hours || 0), 0) || null;
  const laborValue = items.reduce((s, i) => s + (i.laborCost || 0), 0) || null;
  const matValue = items.reduce((s, i) => s + (i.materialCost || 0), 0) || null;
  return [
    { qty: laborQty || null, value: laborValue || null, notes: null },
    { qty: null,             value: matValue || null,   notes: null },
  ];
}

// ------------------------------------------------------------------
// GET /api/cost-control  — list all matrices for the tenant
// ------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*,
              b.project_name AS budget_name,
              p.name AS project_name,
              (SELECT COUNT(*) FROM cost_control_versions WHERE matrix_id = m.id) AS version_count
       FROM cost_control_matrices m
       LEFT JOIN budgets b ON b.id = m.budget_id
       LEFT JOIN projects p ON p.id = m.project_id
       WHERE m.tenant_id = $1
       ORDER BY m.updated_at DESC`,
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error listing matrices:', err);
    res.status(500).json({ error: 'Failed to list matrices' });
  }
});

// ------------------------------------------------------------------
// POST /api/cost-control  — create a blank matrix (no budget required)
// ------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { name, target_cost, fee_pct, overhead_pct } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows } = await pool.query(
      `INSERT INTO cost_control_matrices (tenant_id, name, target_cost, fee_pct, overhead_pct, created_by)
       VALUES ($1, $2, $3, COALESCE($4, 0.05), COALESCE($5, 0.10), $6) RETURNING id`,
      [req.user.tenantId, name, target_cost || null, fee_pct, overhead_pct, req.user.id]
    );
    res.status(201).json({ matrixId: rows[0].id });
  } catch (err) {
    console.error('Error creating blank matrix:', err);
    res.status(500).json({ error: 'Failed to create matrix' });
  }
});

// ------------------------------------------------------------------
// GET /api/cost-control/budget/:budgetId  — check if matrix exists
// ------------------------------------------------------------------
router.get('/budget/:budgetId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM cost_control_matrices WHERE budget_id = $1 AND tenant_id = $2 LIMIT 1',
      [req.params.budgetId, req.user.tenantId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Error checking matrix for budget:', err);
    res.status(500).json({ error: 'Failed to check matrix' });
  }
});

// ------------------------------------------------------------------
// POST /api/cost-control/from-budget/:budgetId  — seed from AI budget
// ------------------------------------------------------------------
router.post('/from-budget/:budgetId', async (req, res) => {
  const client = await pool.getClient();
  try {
    await client.query('BEGIN');

    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { budgetId } = req.params;

    const budgetRes = await client.query(
      'SELECT * FROM budgets WHERE id = $1 AND tenant_id = $2',
      [budgetId, tenantId]
    );
    if (!budgetRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Budget not found' });
    }
    const budget = budgetRes.rows[0];

    // Prevent duplicate matrices for the same budget
    const existing = await client.query(
      'SELECT id FROM cost_control_matrices WHERE budget_id = $1 AND tenant_id = $2 LIMIT 1',
      [budgetId, tenantId]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A Cost Control Matrix already exists for this budget', matrixId: existing.rows[0].id });
    }

    // Create matrix
    const matrixRes = await client.query(
      `INSERT INTO cost_control_matrices (tenant_id, budget_id, name, target_cost, fee_pct, overhead_pct, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        tenantId,
        budgetId,
        `${budget.project_name} — Cost Control Matrix`,
        budget.grand_total,
        (budget.overhead_percent || 10) / 100,
        (budget.profit_percent || 10) / 100,
        userId,
      ]
    );
    const matrixId = matrixRes.rows[0].id;

    // Create first version
    const versionRes = await client.query(
      `INSERT INTO cost_control_versions (matrix_id, version_name, version_date, sort_order, notes)
       VALUES ($1, $2, $3, 0, $4) RETURNING id`,
      [
        matrixId,
        'AI Conceptual Estimate',
        new Date().toISOString().split('T')[0],
        `AI-generated from budget "${budget.project_name}". Confidence: ${budget.confidence_level || 'N/A'}.`,
      ]
    );
    const versionId = versionRes.rows[0].id;

    const sections = budget.sections || [];

    // Track areas by name so sections mapping to the same area share one row
    const areaIdByName = {};
    let areaOrder = 0;

    const getOrCreateArea = async (areaName) => {
      if (areaIdByName[areaName]) return areaIdByName[areaName];
      const r = await client.query(
        'INSERT INTO cost_control_areas (matrix_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id',
        [matrixId, areaName, areaOrder++]
      );
      areaIdByName[areaName] = r.rows[0].id;
      return r.rows[0].id;
    };

    let itemOrder = 0;

    for (const section of sections) {
      const mapping = SECTION_MAP[section.name];
      const areaName = mapping ? mapping.area : 'Other';
      const types = mapping ? mapping.types : ['gen_conditions'];
      const descs = mapping ? mapping.desc : [section.name];

      const areaId = await getOrCreateArea(areaName);
      const valData = extractValuesFromSection(section, types);

      for (let i = 0; i < types.length; i++) {
        const itemRes = await client.query(
          `INSERT INTO cost_control_line_items (matrix_id, area_id, cost_type, description, sort_order)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [matrixId, areaId, types[i], descs[i] || types[i], itemOrder++]
        );
        const itemId = itemRes.rows[0].id;
        const v = valData[i] || {};
        if (v.value !== null && v.value !== undefined) {
          await client.query(
            `INSERT INTO cost_control_version_values (line_item_id, version_id, qty, value, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [itemId, versionId, v.qty || null, v.value || null, v.notes || null]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ matrixId, versionId, message: 'Cost Control Matrix created from budget' });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error creating matrix from budget:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create Cost Control Matrix' });
    }
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------
// GET /api/cost-control/estimate/:estimateId  — check if matrix exists
// ------------------------------------------------------------------
router.get('/estimate/:estimateId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name FROM cost_control_matrices WHERE estimate_id = $1 AND tenant_id = $2 LIMIT 1',
      [req.params.estimateId, req.user.tenantId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Error checking matrix for estimate:', err);
    res.status(500).json({ error: 'Failed to check matrix' });
  }
});

// ------------------------------------------------------------------
// POST /api/cost-control/from-estimate/:estimateId  — seed from estimate
// ------------------------------------------------------------------
router.post('/from-estimate/:estimateId', async (req, res) => {
  const client = await pool.getClient();
  try {
    await client.query('BEGIN');

    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    const { estimateId } = req.params;

    // Fetch estimate
    const estRes = await client.query(
      'SELECT * FROM estimates WHERE id = $1 AND tenant_id = $2',
      [estimateId, tenantId]
    );
    if (!estRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Estimate not found' });
    }
    const estimate = estRes.rows[0];

    // Prevent duplicate
    const existing = await client.query(
      'SELECT id FROM cost_control_matrices WHERE estimate_id = $1 AND tenant_id = $2 LIMIT 1',
      [estimateId, tenantId]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A Cost Control Matrix already exists for this estimate', matrixId: existing.rows[0].id });
    }

    // Create matrix
    const matrixRes = await client.query(
      `INSERT INTO cost_control_matrices (tenant_id, estimate_id, name, target_cost, fee_pct, overhead_pct, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        tenantId,
        estimateId,
        `${estimate.project_name} — Cost Control Matrix`,
        estimate.grand_total || null,
        (estimate.overhead_percentage || 10) / 100,
        (estimate.profit_percentage || 10) / 100,
        userId,
      ]
    );
    const matrixId = matrixRes.rows[0].id;

    // Version 1 = Original Estimate
    const versionRes = await client.query(
      `INSERT INTO cost_control_versions (matrix_id, version_name, version_date, sort_order, notes)
       VALUES ($1, $2, $3, 0, $4) RETURNING id`,
      [
        matrixId,
        'Original Estimate',
        new Date().toISOString().split('T')[0],
        `Imported from estimate ${estimate.estimate_number}.`,
      ]
    );
    const versionId = versionRes.rows[0].id;

    // Fetch sections
    const sectionsRes = await client.query(
      'SELECT * FROM estimate_sections WHERE estimate_id = $1 ORDER BY section_order',
      [estimateId]
    );

    let areaOrder = 0;
    let itemOrder = 0;

    for (const section of sectionsRes.rows) {
      // Create area
      const areaRes = await client.query(
        'INSERT INTO cost_control_areas (matrix_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id',
        [matrixId, section.section_name, areaOrder++]
      );
      const areaId = areaRes.rows[0].id;

      // Fetch line items
      const itemsRes = await client.query(
        'SELECT * FROM estimate_line_items WHERE section_id = $1 ORDER BY item_order',
        [section.id]
      );

      for (const item of itemsRes.rows) {
        const costType = ESTIMATE_TYPE_MAP[item.item_type] || 'gen_conditions';
        const itemRes = await client.query(
          `INSERT INTO cost_control_line_items (matrix_id, area_id, cost_type, description, sort_order)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [matrixId, areaId, costType, item.description || item.item_type, itemOrder++]
        );
        const ccmItemId = itemRes.rows[0].id;
        const totalCost = Number(item.total_cost || 0);
        if (totalCost) {
          await client.query(
            `INSERT INTO cost_control_version_values (line_item_id, version_id, value)
             VALUES ($1, $2, $3)`,
            [ccmItemId, versionId, totalCost]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ matrixId, versionId, message: 'Cost Control Matrix created from estimate' });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error creating matrix from estimate:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to create Cost Control Matrix' });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------
// GET /api/cost-control/:matrixId  — full matrix with all data
// ------------------------------------------------------------------
router.get('/:matrixId', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { matrixId } = req.params;

    const matrixRes = await pool.query(
      'SELECT * FROM cost_control_matrices WHERE id = $1 AND tenant_id = $2',
      [matrixId, tenantId]
    );
    if (!matrixRes.rows.length) return res.status(404).json({ error: 'Matrix not found' });
    const matrix = matrixRes.rows[0];

    const [versionsRes, areasRes, itemsRes, valuesRes, risksRes] = await Promise.all([
      pool.query('SELECT * FROM cost_control_versions WHERE matrix_id = $1 ORDER BY sort_order, id', [matrixId]),
      pool.query('SELECT * FROM cost_control_areas WHERE matrix_id = $1 ORDER BY sort_order, id', [matrixId]),
      pool.query('SELECT * FROM cost_control_line_items WHERE matrix_id = $1 ORDER BY sort_order, id', [matrixId]),
      pool.query(
        `SELECT ccvv.* FROM cost_control_version_values ccvv
         JOIN cost_control_line_items ccli ON ccli.id = ccvv.line_item_id
         WHERE ccli.matrix_id = $1`,
        [matrixId]
      ),
      pool.query('SELECT * FROM cost_control_risk_items WHERE matrix_id = $1 ORDER BY type, sort_order, id', [matrixId]),
    ]);

    // Index values by [item_id][version_id]
    const valuesByItemVersion = {};
    for (const v of valuesRes.rows) {
      if (!valuesByItemVersion[v.line_item_id]) valuesByItemVersion[v.line_item_id] = {};
      valuesByItemVersion[v.line_item_id][v.version_id] = v;
    }

    // Attach items to areas
    const itemsByArea = {};
    for (const item of itemsRes.rows) {
      const areaKey = item.area_id || '__no_area__';
      if (!itemsByArea[areaKey]) itemsByArea[areaKey] = [];
      itemsByArea[areaKey].push({
        ...item,
        values: valuesByItemVersion[item.id] || {},
      });
    }

    const areas = areasRes.rows.map(area => ({
      ...area,
      items: itemsByArea[area.id] || [],
    }));

    res.json({
      ...matrix,
      versions: versionsRes.rows,
      areas,
      risks: risksRes.rows,
    });
  } catch (err) {
    console.error('Error fetching matrix:', err);
    res.status(500).json({ error: 'Failed to fetch matrix' });
  }
});

// ------------------------------------------------------------------
// PUT /api/cost-control/:matrixId  — update matrix header
// ------------------------------------------------------------------
router.put('/:matrixId', async (req, res) => {
  try {
    const { name, target_cost, fee_pct, overhead_pct } = req.body;
    const { rows } = await pool.query(
      `UPDATE cost_control_matrices
       SET name = COALESCE($1, name),
           target_cost = COALESCE($2, target_cost),
           fee_pct = COALESCE($3, fee_pct),
           overhead_pct = COALESCE($4, overhead_pct)
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [name, target_cost, fee_pct, overhead_pct, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Matrix not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating matrix:', err);
    res.status(500).json({ error: 'Failed to update matrix' });
  }
});

// ------------------------------------------------------------------
// POST /api/cost-control/:matrixId/promote  — link to a project
// ------------------------------------------------------------------
router.post('/:matrixId/promote', async (req, res) => {
  try {
    const { project_id } = req.body;
    const { rows } = await pool.query(
      'UPDATE cost_control_matrices SET project_id = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [project_id, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Matrix not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error promoting matrix:', err);
    res.status(500).json({ error: 'Failed to promote matrix' });
  }
});

// ------------------------------------------------------------------
// Versions CRUD
// ------------------------------------------------------------------
router.post('/:matrixId/versions', async (req, res) => {
  try {
    const { version_name, version_date, sort_order, is_execution_phase, notes } = req.body;
    const matrixId = req.params.matrixId;

    // Verify ownership
    const check = await pool.query(
      'SELECT id FROM cost_control_matrices WHERE id = $1 AND tenant_id = $2',
      [matrixId, req.user.tenantId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Matrix not found' });

    const { rows } = await pool.query(
      `INSERT INTO cost_control_versions (matrix_id, version_name, version_date, sort_order, is_execution_phase, notes)
       VALUES ($1, $2, $3, COALESCE($4, 0), COALESCE($5, false), $6) RETURNING *`,
      [matrixId, version_name, version_date || null, sort_order, is_execution_phase, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding version:', err);
    res.status(500).json({ error: 'Failed to add version' });
  }
});

router.put('/:matrixId/versions/:versionId', async (req, res) => {
  try {
    const { version_name, version_date, sort_order, is_execution_phase, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE cost_control_versions ccv
       SET version_name = COALESCE($1, ccv.version_name),
           version_date = COALESCE($2, ccv.version_date),
           sort_order = COALESCE($3, ccv.sort_order),
           is_execution_phase = COALESCE($4, ccv.is_execution_phase),
           notes = COALESCE($5, ccv.notes)
       FROM cost_control_matrices ccm
       WHERE ccv.id = $6 AND ccv.matrix_id = $7 AND ccm.id = ccv.matrix_id AND ccm.tenant_id = $8
       RETURNING ccv.*`,
      [version_name, version_date, sort_order, is_execution_phase, notes, req.params.versionId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Version not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating version:', err);
    res.status(500).json({ error: 'Failed to update version' });
  }
});

router.delete('/:matrixId/versions/:versionId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM cost_control_versions ccv
       USING cost_control_matrices ccm
       WHERE ccv.id = $1 AND ccv.matrix_id = $2 AND ccm.id = ccv.matrix_id AND ccm.tenant_id = $3
       RETURNING ccv.id`,
      [req.params.versionId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Version not found' });
    res.json({ message: 'Version deleted' });
  } catch (err) {
    console.error('Error deleting version:', err);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// ------------------------------------------------------------------
// Areas CRUD
// ------------------------------------------------------------------
router.post('/:matrixId/areas', async (req, res) => {
  try {
    const { name, sort_order } = req.body;
    const check = await pool.query(
      'SELECT id FROM cost_control_matrices WHERE id = $1 AND tenant_id = $2',
      [req.params.matrixId, req.user.tenantId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Matrix not found' });

    const { rows } = await pool.query(
      'INSERT INTO cost_control_areas (matrix_id, name, sort_order) VALUES ($1, $2, COALESCE($3, 0)) RETURNING *',
      [req.params.matrixId, name, sort_order]
    );
    res.status(201).json({ ...rows[0], items: [] });
  } catch (err) {
    console.error('Error adding area:', err);
    res.status(500).json({ error: 'Failed to add area' });
  }
});

router.put('/:matrixId/areas/:areaId', async (req, res) => {
  try {
    const { name, sort_order } = req.body;
    const { rows } = await pool.query(
      `UPDATE cost_control_areas cca SET name = COALESCE($1, cca.name), sort_order = COALESCE($2, cca.sort_order)
       FROM cost_control_matrices ccm
       WHERE cca.id = $3 AND cca.matrix_id = $4 AND ccm.id = cca.matrix_id AND ccm.tenant_id = $5
       RETURNING cca.*`,
      [name, sort_order, req.params.areaId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Area not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating area:', err);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

router.delete('/:matrixId/areas/:areaId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM cost_control_areas cca
       USING cost_control_matrices ccm
       WHERE cca.id = $1 AND cca.matrix_id = $2 AND ccm.id = cca.matrix_id AND ccm.tenant_id = $3
       RETURNING cca.id`,
      [req.params.areaId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Area not found' });
    res.json({ message: 'Area deleted' });
  } catch (err) {
    console.error('Error deleting area:', err);
    res.status(500).json({ error: 'Failed to delete area' });
  }
});

// ------------------------------------------------------------------
// Line items CRUD
// ------------------------------------------------------------------
router.post('/:matrixId/items', async (req, res) => {
  try {
    const { area_id, cost_type, description, sort_order } = req.body;
    const check = await pool.query(
      'SELECT id FROM cost_control_matrices WHERE id = $1 AND tenant_id = $2',
      [req.params.matrixId, req.user.tenantId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Matrix not found' });

    const { rows } = await pool.query(
      `INSERT INTO cost_control_line_items (matrix_id, area_id, cost_type, description, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0)) RETURNING *`,
      [req.params.matrixId, area_id || null, cost_type, description, sort_order]
    );
    res.status(201).json({ ...rows[0], values: {} });
  } catch (err) {
    console.error('Error adding line item:', err);
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

router.put('/:matrixId/items/:itemId', async (req, res) => {
  try {
    const { area_id, cost_type, description, sort_order } = req.body;
    const { rows } = await pool.query(
      `UPDATE cost_control_line_items ccli
       SET area_id = COALESCE($1, ccli.area_id),
           cost_type = COALESCE($2, ccli.cost_type),
           description = COALESCE($3, ccli.description),
           sort_order = COALESCE($4, ccli.sort_order)
       FROM cost_control_matrices ccm
       WHERE ccli.id = $5 AND ccli.matrix_id = $6 AND ccm.id = ccli.matrix_id AND ccm.tenant_id = $7
       RETURNING ccli.*`,
      [area_id, cost_type, description, sort_order, req.params.itemId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating line item:', err);
    res.status(500).json({ error: 'Failed to update line item' });
  }
});

router.delete('/:matrixId/items/:itemId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM cost_control_line_items ccli
       USING cost_control_matrices ccm
       WHERE ccli.id = $1 AND ccli.matrix_id = $2 AND ccm.id = ccli.matrix_id AND ccm.tenant_id = $3
       RETURNING ccli.id`,
      [req.params.itemId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Error deleting line item:', err);
    res.status(500).json({ error: 'Failed to delete line item' });
  }
});

// ------------------------------------------------------------------
// Values — bulk upsert for a version
// PUT /api/cost-control/:matrixId/versions/:versionId/values
// Body: { values: [{ line_item_id, qty, value, notes, actual_cost, pct_complete }] }
// ------------------------------------------------------------------
router.put('/:matrixId/versions/:versionId/values', async (req, res) => {
  const client = await pool.getClient();
  try {
    await client.query('BEGIN');

    const { matrixId, versionId } = req.params;
    const tenantId = req.user.tenantId;

    // Verify ownership
    const check = await client.query(
      'SELECT id FROM cost_control_matrices WHERE id = $1 AND tenant_id = $2',
      [matrixId, tenantId]
    );
    if (!check.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Matrix not found' });
    }

    const { values } = req.body;
    if (!Array.isArray(values)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'values must be an array' });
    }

    for (const v of values) {
      await client.query(
        `INSERT INTO cost_control_version_values (line_item_id, version_id, qty, value, notes, actual_cost, pct_complete)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (line_item_id, version_id) DO UPDATE SET
           qty = EXCLUDED.qty,
           value = EXCLUDED.value,
           notes = EXCLUDED.notes,
           actual_cost = EXCLUDED.actual_cost,
           pct_complete = EXCLUDED.pct_complete`,
        [v.line_item_id, versionId, v.qty ?? null, v.value ?? null, v.notes ?? null, v.actual_cost ?? null, v.pct_complete ?? null]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Values saved' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving values:', err);
    res.status(500).json({ error: 'Failed to save values' });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------------
// Risk & Opportunity Items CRUD
// ------------------------------------------------------------------
router.post('/:matrixId/risks', async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT id FROM cost_control_matrices WHERE id = $1 AND tenant_id = $2',
      [req.params.matrixId, req.user.tenantId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Matrix not found' });

    const { type, description, version_id, probability, impact, status, notes, sort_order } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO cost_control_risk_items
         (matrix_id, type, description, version_id, probability, impact, status, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'open'), $8, COALESCE($9, 0))
       RETURNING *`,
      [req.params.matrixId, type || 'risk', description || '', version_id || null,
       probability ?? null, impact ?? null, status, notes || null, sort_order]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding risk item:', err);
    res.status(500).json({ error: 'Failed to add risk item' });
  }
});

router.put('/:matrixId/risks/:riskId', async (req, res) => {
  try {
    const { type, description, version_id, probability, impact, status, notes, sort_order } = req.body;
    const { rows } = await pool.query(
      `UPDATE cost_control_risk_items ri
       SET type        = COALESCE($1, ri.type),
           description = COALESCE($2, ri.description),
           version_id  = $3,
           probability = $4,
           impact      = $5,
           status      = COALESCE($6, ri.status),
           notes       = $7,
           sort_order  = COALESCE($8, ri.sort_order),
           updated_at  = NOW()
       FROM cost_control_matrices ccm
       WHERE ri.id = $9 AND ri.matrix_id = $10 AND ccm.id = ri.matrix_id AND ccm.tenant_id = $11
       RETURNING ri.*`,
      [type, description, version_id ?? null, probability ?? null, impact ?? null,
       status, notes ?? null, sort_order, req.params.riskId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Risk item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating risk item:', err);
    res.status(500).json({ error: 'Failed to update risk item' });
  }
});

router.delete('/:matrixId/risks/:riskId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM cost_control_risk_items ri
       USING cost_control_matrices ccm
       WHERE ri.id = $1 AND ri.matrix_id = $2 AND ccm.id = ri.matrix_id AND ccm.tenant_id = $3
       RETURNING ri.id`,
      [req.params.riskId, req.params.matrixId, req.user.tenantId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Risk item not found' });
    res.json({ message: 'Risk item deleted' });
  } catch (err) {
    console.error('Error deleting risk item:', err);
    res.status(500).json({ error: 'Failed to delete risk item' });
  }
});

module.exports = router;
