const express = require('express');
const router = express.Router();
const CostDatabase = require('../models/CostDatabase');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// Parse comma-separated list query param, return null if missing/empty.
function parseList(value) {
  if (!value) return null;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const trimmed = list.map(v => String(v).trim()).filter(Boolean);
  return trimmed.length ? trimmed : null;
}

function parseIntList(value) {
  const list = parseList(value);
  if (!list) return null;
  const ints = list.map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  return ints.length ? ints : null;
}

function parseFilters(query) {
  const statuses = parseList(query.status);
  const departments = parseList(query.department);
  const markets = parseList(query.market);
  const managerIds = parseIntList(query.manager_id);
  const excludedProjectIds = parseIntList(query.excluded_ids);
  const projectIds = parseIntList(query.project_ids);

  const valueMin = query.value_min != null && query.value_min !== '' ? parseFloat(query.value_min) : null;
  const valueMax = query.value_max != null && query.value_max !== '' ? parseFloat(query.value_max) : null;
  const sqftMin = query.sqft_min != null && query.sqft_min !== '' ? parseInt(query.sqft_min, 10) : null;
  const sqftMax = query.sqft_max != null && query.sqft_max !== '' ? parseInt(query.sqft_max, 10) : null;

  return {
    statuses,
    departments,
    markets,
    managerIds,
    excludedProjectIds,
    projectIds,
    dateFrom: query.date_from || null,
    dateTo: query.date_to || null,
    valueMin: !isNaN(valueMin) ? valueMin : null,
    valueMax: !isNaN(valueMax) ? valueMax : null,
    sqftMin: sqftMin !== null && !isNaN(sqftMin) ? sqftMin : null,
    sqftMax: sqftMax !== null && !isNaN(sqftMax) ? sqftMax : null,
    costType: query.cost_type ? parseInt(query.cost_type, 10) : null,
    phasePrefix: query.phase_prefix || null,
  };
}

router.get('/filters', async (req, res, next) => {
  try {
    const options = await CostDatabase.getFilterOptions(req.tenantId);
    res.json(options);
  } catch (err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const summary = await CostDatabase.getSummary(req.tenantId, filters);
    res.json(summary);
  } catch (err) { next(err); }
});

router.get('/by-cost-type', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const rows = await CostDatabase.getByCostType(req.tenantId, filters);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/by-phase', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const rows = await CostDatabase.getByPhase(req.tenantId, filters);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/phase/:phase/projects', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const costType = req.query.cost_type ? parseInt(req.query.cost_type, 10) : null;
    const rows = await CostDatabase.getPhaseProjects(req.tenantId, filters, req.params.phase, costType);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/projects', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const rows = await CostDatabase.getProjects(req.tenantId, filters);
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/projects/:id/scopes', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const scopes = Array.isArray(req.body.scopes) ? req.body.scopes : [];
    await CostDatabase.updateProjectScopes(projectId, scopes, req.tenantId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/projects/:id/sqft', async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const sqft = req.body.sqft != null ? parseFloat(req.body.sqft) : null;
    await CostDatabase.updateProjectSqft(projectId, sqft, req.tenantId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ============== Estimates endpoints ==============

function parseEstimateFilters(query) {
  const statuses = parseList(query.status);
  const estimatorIds = parseIntList(query.estimator_id);
  const excludedEstimateIds = parseIntList(query.excluded_ids);
  const markets = parseList(query.market);
  const valueMin = query.value_min != null && query.value_min !== '' ? parseFloat(query.value_min) : null;
  const valueMax = query.value_max != null && query.value_max !== '' ? parseFloat(query.value_max) : null;
  return {
    statuses,
    estimatorIds,
    excludedEstimateIds,
    markets,
    dateFrom: query.date_from || null,
    dateTo: query.date_to || null,
    valueMin: !isNaN(valueMin) ? valueMin : null,
    valueMax: !isNaN(valueMax) ? valueMax : null,
  };
}

router.get('/estimates/filters', async (req, res, next) => {
  try {
    const options = await CostDatabase.estimates.getFilterOptions(req.tenantId);
    res.json(options);
  } catch (err) { next(err); }
});

router.get('/estimates/summary', async (req, res, next) => {
  try {
    const filters = parseEstimateFilters(req.query);
    const summary = await CostDatabase.estimates.getSummary(req.tenantId, filters);
    res.json(summary);
  } catch (err) { next(err); }
});

router.get('/estimates/by-cost-type', async (req, res, next) => {
  try {
    const filters = parseEstimateFilters(req.query);
    const rows = await CostDatabase.estimates.getByCostType(req.tenantId, filters);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/estimates/by-section', async (req, res, next) => {
  try {
    const filters = parseEstimateFilters(req.query);
    const rows = await CostDatabase.estimates.getBySection(req.tenantId, filters);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/estimates/list', async (req, res, next) => {
  try {
    const filters = parseEstimateFilters(req.query);
    const rows = await CostDatabase.estimates.getList(req.tenantId, filters);
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/estimates/:id/sqft', async (req, res, next) => {
  try {
    const { sqft } = req.body;
    await CostDatabase.estimates.updateSqft(parseInt(req.params.id, 10), sqft, req.tenantId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
