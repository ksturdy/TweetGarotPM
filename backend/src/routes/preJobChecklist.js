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

    const vistaResult = await db.query(
      `SELECT id, contract_number, projected_cost,
              COALESCE(orig_contract_amount, 0) AS orig_contract_amount,
              COALESCE(contract_amount, 0) AS contract_amount
       FROM vp_contracts
       WHERE linked_project_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [projectId, req.tenantId]
    );

    const contract = vistaResult.rows[0] ?? null;
    // Estimate is considered uploaded only if the contract has a non-zero value
    // (a shell contract with all zeros means the estimate hasn't been imported yet)
    const vistaLinked = !!contract && (
      Number(contract.orig_contract_amount) !== 0 || Number(contract.contract_amount) !== 0
    );
    // A Vista projection is complete when projected_cost has been populated
    const hasProjection = !!contract && contract.projected_cost != null && Number(contract.projected_cost) !== 0;

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
