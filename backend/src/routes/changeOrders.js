const express = require('express');
const { body, validationResult } = require('express-validator');
const ChangeOrder = require('../models/ChangeOrder');
const Project = require('../models/Project');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware to verify project belongs to tenant
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

// Get change orders for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const changeOrders = await ChangeOrder.findByProject(req.params.projectId, filters);
    res.json(changeOrders);
  } catch (error) {
    next(error);
  }
});

// Get project change order totals
router.get('/project/:projectId/totals', verifyProjectOwnership, async (req, res, next) => {
  try {
    const totals = await ChangeOrder.getProjectTotals(req.params.projectId);
    res.json(totals);
  } catch (error) {
    next(error);
  }
});

// Get single change order
router.get('/:id', async (req, res, next) => {
  try {
    const changeOrder = await ChangeOrder.findById(req.params.id);
    if (!changeOrder) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    // Verify the change order's project belongs to tenant
    const project = await Project.findByIdAndTenant(changeOrder.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Create change order
router.post(
  '/',
  [
    body('projectId').isInt(),
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const number = await ChangeOrder.getNextNumber(req.body.projectId);
      const changeOrder = await ChangeOrder.create({
        ...req.body,
        number,
        createdBy: req.user.id,
      });
      res.status(201).json(changeOrder);
    } catch (error) {
      next(error);
    }
  }
);

// Update change order
router.put('/:id', async (req, res, next) => {
  try {
    // First get the change order to verify ownership
    const existingCO = await ChangeOrder.findById(req.params.id);
    if (!existingCO) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    // Verify the change order's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingCO.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Change order not found' });
    }

    const changeOrder = await ChangeOrder.update(req.params.id, req.body);
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Submit change order for approval
router.post('/:id/submit', async (req, res, next) => {
  try {
    // First get the change order to verify ownership
    const existingCO = await ChangeOrder.findById(req.params.id);
    if (!existingCO) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    // Verify the change order's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingCO.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Change order not found' });
    }

    const changeOrder = await ChangeOrder.update(req.params.id, { status: 'pending' });
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Approve change order
router.post('/:id/approve', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    // First get the change order to verify ownership
    const existingCO = await ChangeOrder.findById(req.params.id);
    if (!existingCO) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    // Verify the change order's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingCO.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Change order not found' });
    }

    const changeOrder = await ChangeOrder.approve(req.params.id, {
      approvedBy: req.user.id,
    });
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Reject change order
router.post('/:id/reject', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    // First get the change order to verify ownership
    const existingCO = await ChangeOrder.findById(req.params.id);
    if (!existingCO) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    // Verify the change order's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingCO.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Change order not found' });
    }

    const changeOrder = await ChangeOrder.reject(req.params.id, {
      rejectionReason: req.body.rejectionReason,
    });
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
