const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext, checkLimit } = require('../middleware/tenant');

const router = express.Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all projects (within tenant)
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      managerId: req.query.managerId,
    };
    const projects = await Project.findAllByTenant(req.tenantId, filters);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get single project (with tenant check)
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findByIdAndTenant(req.params.id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Create project (with tenant and limit check)
router.post(
  '/',
  authorize('admin', 'manager'),
  checkLimit('max_projects', async (tenantId) => Project.countByTenant(tenantId)),
  [
    body('name').trim().notEmpty(),
    body('number').trim().notEmpty(),
    body('client').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const project = await Project.create({
        ...req.body,
        managerId: req.body.managerId || req.user.id,
        tenantId: req.tenantId,
      });
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project (with tenant check)
router.put('/:id', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const project = await Project.update(req.params.id, req.body, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Delete project (with tenant check)
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const deleted = await Project.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
