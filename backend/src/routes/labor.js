const express = require('express');
const ProjectAssignment = require('../models/ProjectAssignment');
const { getProjectEffectiveDates } = require('../utils/projectDates');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(authorize('admin', 'manager'));

// GET /api/labor/projects/:projectId/default-dates
router.get('/projects/:projectId/default-dates', async (req, res, next) => {
  try {
    const dates = await getProjectEffectiveDates(req.params.projectId, req.tenantId);
    res.json(dates);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/board — Labor Board grid data (1 row per active employee)
router.get('/board', async (req, res, next) => {
  try {
    const filters = {
      trade: req.query.trade || undefined,
      title: req.query.title || undefined,
      employee_group: req.query.group || undefined,
      profile_type: req.query.profile_type || undefined,
      search: req.query.search || undefined,
    };
    const rows = await ProjectAssignment.findAllForBoard(req.tenantId, filters);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/dashboard/summary — counts for the top stat cards
router.get('/dashboard/summary', async (req, res, next) => {
  try {
    const summary = await ProjectAssignment.summary(req.tenantId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

const applyEmployeeFilters = (rows, query) => {
  let filtered = rows;
  if (query.trade) {
    filtered = filtered.filter((r) => r.employee_trade === query.trade);
  }
  if (query.group) {
    filtered = filtered.filter((r) => r.employee_group === query.group);
  }
  if (query.title) {
    filtered = filtered.filter((r) => r.employee_title === query.title);
  }
  return filtered;
};

// GET /api/labor/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&trade=&group=&title=
router.get('/calendar', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params required (YYYY-MM-DD)' });
    const rows = await ProjectAssignment.findByDateRange(req.tenantId, from, to);
    res.json(applyEmployeeFilters(rows, req.query));
  } catch (error) {
    next(error);
  }
});

// GET /api/labor/assignments?status=&search=&from=&to=&trade=&group=&title= — flat list
router.get('/assignments', async (req, res, next) => {
  try {
    const from = req.query.from || new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const rows = await ProjectAssignment.findByDateRange(req.tenantId, from, to);

    let filtered = applyEmployeeFilters(rows, req.query);
    if (req.query.status) {
      filtered = filtered.filter((r) => r.status === req.query.status);
    }
    if (req.query.search) {
      const s = String(req.query.search).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(s) ||
          (r.project_name || '').toLowerCase().includes(s) ||
          (r.role || '').toLowerCase().includes(s)
      );
    }
    res.json(filtered);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
