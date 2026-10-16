const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const ScopeJobMapping = require('../models/ScopeJobMapping');
const { pool } = require('../config/database');

router.use(authenticate, tenantContext);

// Resolve total est_cost for a Vista job number
async function resolveJobCost(tenantId, vistaJob) {
  const result = await pool.query(
    `SELECT SUM(est_cost) AS total_est_cost
     FROM vp_phase_codes
     WHERE tenant_id = $1 AND job = $2`,
    [tenantId, vistaJob]
  );
  return parseFloat(result.rows[0]?.total_est_cost) || null;
}

// GET /api/scope-job-mappings/historical/:id
router.get('/historical/:id', async (req, res, next) => {
  try {
    const mappings = await ScopeJobMapping.getByHistoricalProject(req.tenantId, req.params.id);
    res.json({ mappings });
  } catch (err) { next(err); }
});

// GET /api/scope-job-mappings/project/:id
router.get('/project/:id', async (req, res, next) => {
  try {
    const mappings = await ScopeJobMapping.getByLiveProject(req.tenantId, req.params.id);
    res.json({ mappings });
  } catch (err) { next(err); }
});

// PUT /api/scope-job-mappings/historical/:id  body: { scope, vista_job }
router.put('/historical/:id', async (req, res, next) => {
  try {
    const { scope, vista_job } = req.body;
    if (!scope || !vista_job) return res.status(400).json({ error: 'scope and vista_job are required' });

    const cachedEstCost = await resolveJobCost(req.tenantId, vista_job);

    const mapping = await ScopeJobMapping.upsert(req.tenantId, {
      historical_project_id: parseInt(req.params.id, 10),
      scope,
      vista_job,
      cached_est_cost: cachedEstCost,
      created_by: req.user?.id,
    });
    res.json({ mapping });
  } catch (err) { next(err); }
});

// PUT /api/scope-job-mappings/project/:id  body: { scope, vista_job }
router.put('/project/:id', async (req, res, next) => {
  try {
    const { scope, vista_job } = req.body;
    if (!scope || !vista_job) return res.status(400).json({ error: 'scope and vista_job are required' });

    const cachedEstCost = await resolveJobCost(req.tenantId, vista_job);

    const mapping = await ScopeJobMapping.upsert(req.tenantId, {
      live_project_id: parseInt(req.params.id, 10),
      scope,
      vista_job,
      cached_est_cost: cachedEstCost,
      created_by: req.user?.id,
    });
    res.json({ mapping });
  } catch (err) { next(err); }
});

// DELETE /api/scope-job-mappings/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await ScopeJobMapping.delete(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
