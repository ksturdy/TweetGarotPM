const express = require('express');
const { body, validationResult } = require('express-validator');
const PhaseSchedule = require('../models/PhaseSchedule');
const PhaseGCLink = require('../models/PhaseGCLink');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generatePhaseSchedulePdfBuffer } = require('../utils/phaseSchedulePdfBuffer');
const { generatePhaseScheduleExcelBuffer } = require('../utils/phaseScheduleExcelGenerator');
const { fetchLogoBase64 } = require('../utils/logoFetcher');
const ProjectLaborRate = require('../models/ProjectLaborRate');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// Get available phase codes for a project (from Vista import)
router.get('/project/:projectId/phase-codes', verifyProjectOwnership, async (req, res, next) => {
  try {
    const phaseCodes = await PhaseSchedule.getPhaseCodesByProject(req.params.projectId, req.tenantId);
    res.json(phaseCodes);
  } catch (error) {
    next(error);
  }
});

// Shared helper — parse item filter and billing data from query params
async function resolveExportData(req, mode) {
  const allItems = await PhaseSchedule.getScheduleItems(req.params.projectId, req.tenantId);
  if (!allItems || allItems.length === 0) return { error: 'No schedule items to export' };

  let items = allItems;
  if (req.query.itemIds) {
    const allowed = new Set(
      String(req.query.itemIds).split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n))
    );
    if (allowed.size > 0) items = allItems.filter(i => allowed.has(i.id));
    if (items.length === 0) return { error: 'No schedule items match the selected filters' };
  }

  // Groups filter — e.g. "est,jtd,proj,rem,sched,bill,monthly"
  const groups = req.query.groups
    ? new Set(String(req.query.groups).split(',').map(s => s.trim()).filter(Boolean))
    : null; // null = all shown

  const shift = req.query.shift || '5/8';

  const laborRates = await ProjectLaborRate.list(req.params.projectId, req.tenantId);
  const laborRateById = new Map(laborRates.map(r => [r.id, parseFloat(r.billable_rate)]));
  let markupByCt = {};
  if (mode === 'billable') {
    const p = req.project;
    markupByCt = {
      1: parseFloat(p.billing_markup_labor   || 0),
      2: parseFloat(p.billing_markup_material || 0),
      3: parseFloat(p.billing_markup_subs     || 0),
      4: parseFloat(p.billing_markup_rentals  || 0),
      5: parseFloat(p.billing_markup_equipment || 0),
      6: parseFloat(p.billing_markup_genconds  || 0),
    };
  }

  return { items, groups, shift, laborRateById, laborRates, markupByCt };
}

// Download Phase Schedule as PDF (Grid or Gantt view)
router.get('/project/:projectId/pdf-download', verifyProjectOwnership, async (req, res, next) => {
  try {
    const view = req.query.view || 'grid';
    const mode = req.query.mode || 'cost';
    const result = await resolveExportData(req, mode);
    if (result.error) return res.status(400).json({ error: result.error });

    const { items, groups, shift, laborRateById, laborRates, markupByCt } = result;
    const project = req.project;
    const logoBase64 = await fetchLogoBase64(req.tenantId);

    const pdfBuffer = await generatePhaseSchedulePdfBuffer({
      items,
      project: { name: project.name, number: project.number, id: project.id },
      view, mode, logoBase64, groups, shift, laborRateById, laborRates, markupByCt,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const viewLabel = view === 'gantt' ? 'Gantt' : 'Grid';
    const safeName = (project.number || project.name || 'Project').replace(/[^a-zA-Z0-9\-_]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Phase-Schedule-${viewLabel}-${safeName}-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating phase schedule PDF:', error);
    res.status(500).json({ error: 'Failed to generate phase schedule PDF' });
  }
});

// Download Phase Schedule as Excel
router.get('/project/:projectId/excel-download', verifyProjectOwnership, async (req, res, next) => {
  try {
    const mode = req.query.mode || 'cost';
    const result = await resolveExportData(req, mode);
    if (result.error) return res.status(400).json({ error: result.error });

    const { items, groups, shift, laborRateById, laborRates, markupByCt } = result;
    const project = req.project;

    const xlBuffer = await generatePhaseScheduleExcelBuffer({
      items,
      project: { name: project.name, number: project.number, id: project.id },
      mode, groups, shift, laborRateById, laborRates, markupByCt,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = (project.number || project.name || 'Project').replace(/[^a-zA-Z0-9\-_]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Phase-Schedule-${safeName}-${dateStr}.xlsx"`);
    res.send(xlBuffer);
  } catch (error) {
    console.error('Error generating phase schedule Excel:', error);
    res.status(500).json({ error: 'Failed to generate phase schedule Excel' });
  }
});

// Get all schedule items for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const items = await PhaseSchedule.getScheduleItems(req.params.projectId, req.tenantId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Create schedule item(s) from phase codes
router.post('/',
  [
    body('projectId').isInt(),
    body('phaseCodeIds').isArray({ min: 1 }),
    body('groupBy').optional().isIn(['phase', 'cost_type', 'individual'])
  ],
  validate,
  async (req, res, next) => {
    try {
      const { projectId, phaseCodeIds, groupBy } = req.body;

      // Verify project ownership
      const project = await Project.findByIdAndTenant(projectId, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const items = await PhaseSchedule.bulkCreateFromPhaseCodes(
        projectId, phaseCodeIds, groupBy || 'individual', req.tenantId, req.user.id
      );
      res.status(201).json(items);
    } catch (error) {
      next(error);
    }
  }
);

// Update a schedule item
router.put('/:id', async (req, res, next) => {
  try {
    const item = await PhaseSchedule.getScheduleItemById(req.params.id, req.tenantId);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    // When a phase is linked to GC activities, its dates flow from GC.
    // Silently drop start_date/end_date so manual edits don't quietly diverge.
    const body = { ...req.body };
    if (('start_date' in body || 'end_date' in body) &&
        await PhaseGCLink.hasAnyLinks(req.params.id, req.tenantId)) {
      delete body.start_date;
      delete body.end_date;
    }

    const updated = await PhaseSchedule.updateScheduleItem(req.params.id, body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete a schedule item
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await PhaseSchedule.getScheduleItemById(req.params.id, req.tenantId);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    await PhaseSchedule.deleteScheduleItem(req.params.id, req.tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Reorder schedule items
router.put('/project/:projectId/reorder', verifyProjectOwnership, async (req, res, next) => {
  try {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }
    await PhaseSchedule.reorder(req.params.projectId, itemIds, req.tenantId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ==================== PROVISIONAL PHASE CODES ====================
// Used when Vista isn't set up yet but a billing forecast is needed.
// Rows live in vp_phase_codes with is_provisional = TRUE. Reconciled later.

router.get('/project/:projectId/provisional', verifyProjectOwnership, async (req, res, next) => {
  try {
    const rows = await PhaseSchedule.listProvisionalByProject(req.params.projectId, req.tenantId);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/project/:projectId/provisional',
  [
    body('job').isString().trim().notEmpty(),
    body('phase').isString().trim().notEmpty(),
    body('cost_type').isInt({ min: 1, max: 6 }),
    body('phase_description').optional().isString(),
    body('job_description').optional().isString(),
    body('contract').optional().isString(),
    body('est_hours').optional().isFloat({ min: 0 }),
    body('est_cost').optional().isFloat({ min: 0 }),
    body('provisional_notes').optional().isString(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const row = await PhaseSchedule.createProvisional(
        { ...req.body, linked_project_id: Number(req.params.projectId) },
        req.tenantId,
        req.user.id
      );
      res.status(201).json(row);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A phase code with that job/cost_type/phase already exists for this tenant.' });
      }
      next(error);
    }
  }
);

router.post('/project/:projectId/provisional/bulk',
  [body('rows').isArray({ min: 1 })],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const inserted = await PhaseSchedule.bulkCreateProvisional(
        req.body.rows, Number(req.params.projectId), req.tenantId, req.user.id
      );
      res.status(201).json({ inserted, skipped: req.body.rows.length - inserted.length });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/provisional/:id', async (req, res, next) => {
  try {
    const row = await PhaseSchedule.updateProvisional(req.params.id, req.body, req.tenantId);
    if (!row) {
      return res.status(404).json({ error: 'Provisional phase code not found, already reconciled, or no updatable fields supplied.' });
    }
    res.json(row);
  } catch (error) {
    next(error);
  }
});

router.delete('/provisional/:id', async (req, res, next) => {
  try {
    const row = await PhaseSchedule.deleteProvisional(req.params.id, req.tenantId);
    if (!row) {
      return res.status(404).json({ error: 'Provisional phase code not found.' });
    }
    res.status(204).send();
  } catch (error) {
    if (error.code === 'PROVISIONAL_IN_USE') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/provisional/:id/reconcile',
  [body('realPhaseCodeId').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const result = await PhaseSchedule.reconcileProvisional(
        Number(req.params.id), Number(req.body.realPhaseCodeId), req.tenantId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/project/:projectId/reconciliations', verifyProjectOwnership, async (req, res, next) => {
  try {
    const rows = await PhaseSchedule.listPendingReconciliations(req.params.projectId, req.tenantId);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get('/project/:projectId/reconciliations/count', verifyProjectOwnership, async (req, res, next) => {
  try {
    const n = await PhaseSchedule.countPendingReconciliations(req.params.projectId, req.tenantId);
    res.json({ count: n });
  } catch (error) {
    next(error);
  }
});

router.post('/reconciliations/:id/accept', async (req, res, next) => {
  try {
    const result = await PhaseSchedule.acceptReconciliation(Number(req.params.id), req.tenantId, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/reconciliations/:id/reject',
  [body('notes').optional().isString()],
  validate,
  async (req, res, next) => {
    try {
      const result = await PhaseSchedule.rejectReconciliation(
        Number(req.params.id), req.tenantId, req.user.id, req.body.notes
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Sync schedule item quantity / quantity_installed with the latest Stratus import
// for the project (LF -> SUM(length), EA -> COUNT). Hours and costs are not touched.
router.post('/project/:projectId/sync-stratus-quantities', verifyProjectOwnership, async (req, res, next) => {
  try {
    const result = await PhaseSchedule.syncStratusQuantities(req.params.projectId, req.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
