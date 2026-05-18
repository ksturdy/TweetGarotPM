const express = require('express');
const { body, validationResult } = require('express-validator');
const ProjectLaborRate = require('../models/ProjectLaborRate');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const verifyProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) return res.status(400).json({ error: 'Project ID is required' });
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    next();
  } catch (e) { next(e); }
};

router.get('/project/:projectId', verifyProject, async (req, res, next) => {
  try {
    const rows = await ProjectLaborRate.list(req.params.projectId, req.tenantId);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/project/:projectId',
  verifyProject,
  body('label').isString().trim().notEmpty(),
  body('billable_rate').optional().isFloat({ min: 0 }),
  body('sort_order').optional().isInt(),
  validate,
  async (req, res, next) => {
    try {
      const row = await ProjectLaborRate.create({
        projectId: req.params.projectId,
        tenantId: req.tenantId,
        label: req.body.label,
        billableRate: req.body.billable_rate,
        sortOrder: req.body.sort_order,
      });
      res.status(201).json(row);
    } catch (e) { next(e); }
  }
);

router.put('/:id',
  body('label').optional().isString().trim().notEmpty(),
  body('billable_rate').optional().isFloat({ min: 0 }),
  body('sort_order').optional().isInt(),
  validate,
  async (req, res, next) => {
    try {
      const row = await ProjectLaborRate.update(req.params.id, req.tenantId, {
        label: req.body.label,
        billableRate: req.body.billable_rate,
        sortOrder: req.body.sort_order,
      });
      if (!row) return res.status(404).json({ error: 'Rate not found' });
      res.json(row);
    } catch (e) { next(e); }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const row = await ProjectLaborRate.delete(req.params.id, req.tenantId);
    if (!row) return res.status(404).json({ error: 'Rate not found' });
    res.json({ id: row.id });
  } catch (e) { next(e); }
});

module.exports = router;
