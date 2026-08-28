const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const PreJobChecklist = require('../models/PreJobChecklist');
const Project = require('../models/Project');
const db = require('../config/database');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const verifyProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndTenant(req.params.projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

// GET /api/pre-job-checklist/project/:projectId/readiness
router.get('/project/:projectId/readiness', verifyProject, async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const [contractResult, estimateResult, projectionResult] = await Promise.all([
      db.query(
        `SELECT id, contract_number FROM vp_contracts
         WHERE linked_project_id = $1 AND tenant_id = $2 LIMIT 1`,
        [projectId, req.tenantId]
      ),
      // Estimate is uploaded when at least one phase code has est_cost > 0
      db.query(
        `SELECT id FROM vp_phase_codes
         WHERE linked_project_id = $1 AND tenant_id = $2 AND est_cost > 0 LIMIT 1`,
        [projectId, req.tenantId]
      ),
      // Projection is complete when at least one phase code has projected_cost > 0
      db.query(
        `SELECT id FROM vp_phase_codes
         WHERE linked_project_id = $1 AND tenant_id = $2 AND projected_cost > 0 LIMIT 1`,
        [projectId, req.tenantId]
      ),
    ]);

    const contract = contractResult.rows[0] ?? null;
    const vistaLinked = estimateResult.rows.length > 0;
    const hasProjection = projectionResult.rows.length > 0;

    res.json({
      vistaLinked,
      vistaContractNumber: vistaLinked ? (contract?.contract_number || null) : null,
      hasProjection,
      ready: vistaLinked && hasProjection,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/pre-job-checklist/project/:projectId
router.get('/project/:projectId', verifyProject, async (req, res) => {
  try {
    const checklist = await PreJobChecklist.getByProjectId(req.params.projectId, req.tenantId);
    res.json(checklist || {
      project_info: {},
      labor: {},
      material: {},
      subcontracts: {},
      rental: {},
      mep_equipment: {},
      general_conditions: {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pre-job-checklist/project/:projectId/section/:section
router.put('/project/:projectId/section/:section', verifyProject, async (req, res) => {
  try {
    const checklist = await PreJobChecklist.updateSection(
      req.params.projectId,
      req.tenantId,
      req.params.section,
      req.body
    );
    res.json(checklist);
  } catch (err) {
    if (err.message.startsWith('Invalid section')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
