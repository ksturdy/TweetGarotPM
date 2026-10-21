const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const Project = require('../models/Project');
const WeeklyProduction = require('../models/WeeklyProduction');

const router = express.Router();
router.use(authenticate);
router.use(tenantContext);

const verifyProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndTenant(req.params.projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) { next(err); }
};

// GET /api/weekly-production/project/:projectId?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/project/:projectId', verifyProject, async (req, res, next) => {
  try {
    const from = req.query.from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to   = req.query.to   || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const data = await WeeklyProduction.getWeeklyData(req.params.projectId, req.tenantId, from, to);
    res.json(data);
  } catch (err) { next(err); }
});

// PUT /api/weekly-production/project/:projectId/entry/:itemId/:weekEnding
router.put('/project/:projectId/entry/:itemId/:weekEnding', verifyProject, async (req, res, next) => {
  try {
    const qty = parseFloat(req.body.qty_installed);
    if (isNaN(qty) || qty < 0) return res.status(400).json({ error: 'qty_installed must be a non-negative number' });
    await WeeklyProduction.upsertEntry(
      req.params.itemId,
      req.params.weekEnding,
      qty,
      req.tenantId,
      req.user.id
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/weekly-production/project/:projectId/bulk
router.post('/project/:projectId/bulk', verifyProject, async (req, res, next) => {
  try {
    const rows = req.body.rows;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'rows array required' });
    await WeeklyProduction.bulkUpsertEntries(rows, req.params.projectId, req.tenantId, req.user.id);
    res.json({ ok: true, count: rows.length });
  } catch (err) { next(err); }
});

// POST /api/weekly-production/project/:projectId/snapshot  (manual trigger)
router.post('/project/:projectId/snapshot', verifyProject, async (req, res, next) => {
  try {
    const weekEnding = req.body.week_ending || null;
    const count = await WeeklyProduction.snapshotProject(req.params.projectId, req.tenantId, weekEnding);
    res.json({ ok: true, rows: count });
  } catch (err) { next(err); }
});

module.exports = router;
