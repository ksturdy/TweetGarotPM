const express = require('express');
const { body, validationResult } = require('express-validator');
const ScheduleItem = require('../models/ScheduleItem');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
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

// Get schedule items for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const items = await ScheduleItem.findByProject(req.params.projectId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Get project progress summary
router.get('/project/:projectId/progress', verifyProjectOwnership, async (req, res, next) => {
  try {
    const progress = await ScheduleItem.getProjectProgress(req.params.projectId);
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

// Get single schedule item
router.get('/:id', async (req, res, next) => {
  try {
    const item = await ScheduleItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    // Verify the item's project belongs to tenant
    const project = await Project.findByIdAndTenant(item.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Get children of a schedule item
router.get('/:id/children', async (req, res, next) => {
  try {
    // First verify the parent item belongs to tenant
    const item = await ScheduleItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    const project = await Project.findByIdAndTenant(item.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    const children = await ScheduleItem.findChildren(req.params.id);
    res.json(children);
  } catch (error) {
    next(error);
  }
});

// Create schedule item
router.post(
  '/',
  [
    body('projectId').isInt(),
    body('name').trim().notEmpty(),
    body('startDate').isDate(),
    body('endDate').isDate(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const item = await ScheduleItem.create({
        ...req.body,
        createdBy: req.user.id,
      });
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Update schedule item
router.put('/:id', async (req, res, next) => {
  try {
    // First get the item to verify ownership
    const existingItem = await ScheduleItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    // Verify the item's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingItem.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    const item = await ScheduleItem.update(req.params.id, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Update progress
router.patch('/:id/progress', async (req, res, next) => {
  try {
    // First get the item to verify ownership
    const existingItem = await ScheduleItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    // Verify the item's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingItem.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    const item = await ScheduleItem.updateProgress(req.params.id, req.body.percentComplete);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Delete schedule item
router.delete('/:id', async (req, res, next) => {
  try {
    // First get the item to verify ownership
    const existingItem = await ScheduleItem.findById(req.params.id);
    if (!existingItem) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    // Verify the item's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingItem.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    await ScheduleItem.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
