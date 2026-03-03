const express = require('express');
const { body, validationResult } = require('express-validator');
const PlumbingFittingOrder = require('../models/PlumbingFittingOrder');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

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
    const projectId = req.params.projectId || req.body.projectId || req.body.project_id;
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

// Get orders for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status, priority: req.query.priority };
    const orders = await PlumbingFittingOrder.findByProject(req.params.projectId, filters);
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

// Get project stats
router.get('/project/:projectId/stats', verifyProjectOwnership, async (req, res, next) => {
  try {
    const stats = await PlumbingFittingOrder.getProjectStats(req.params.projectId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get single order
router.get('/:id', async (req, res, next) => {
  try {
    const order = await PlumbingFittingOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const project = await Project.findByIdAndTenant(order.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Create order
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('title').trim().notEmpty(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const number = await PlumbingFittingOrder.getNextNumber(projectId);
      const order = await PlumbingFittingOrder.create({
        projectId,
        tenantId: req.tenantId,
        number,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        requiredByDate: req.body.required_by_date,
        drawingNumber: req.body.drawing_number,
        drawingRevision: req.body.drawing_revision,
        specSection: req.body.spec_section,
        locationOnSite: req.body.location_on_site,
        materialType: req.body.material_type,
        pipeSize: req.body.pipe_size,
        fixtureType: req.body.fixture_type,
        roughInDimensions: req.body.rough_in_dimensions,
        quantity: req.body.quantity,
        unit: req.body.unit,
        costCode: req.body.cost_code,
        phaseCode: req.body.phase_code,
        notes: req.body.notes,
        createdBy: req.user.id,
      });
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }
);

// Update order
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await PlumbingFittingOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const order = await PlumbingFittingOrder.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Submit to shop
router.post('/:id/submit', async (req, res, next) => {
  try {
    const existing = await PlumbingFittingOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const order = await PlumbingFittingOrder.update(req.params.id, { status: 'submitted' });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Update fabrication status
router.post('/:id/update-status', async (req, res, next) => {
  try {
    const existing = await PlumbingFittingOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const order = await PlumbingFittingOrder.update(req.params.id, req.body);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await PlumbingFittingOrder.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Fitting order not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }
    await PlumbingFittingOrder.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
