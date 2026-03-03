const express = require('express');
const { body, validationResult } = require('express-validator');
const PhaseSchedule = require('../models/PhaseSchedule');
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

// Get available phase codes for a project (from Vista import)
router.get('/project/:projectId/phase-codes', verifyProjectOwnership, async (req, res, next) => {
  try {
    const phaseCodes = await PhaseSchedule.getPhaseCodesByProject(req.params.projectId, req.tenantId);
    res.json(phaseCodes);
  } catch (error) {
    next(error);
  }
});

// Get all schedule items for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const items = await PhaseSchedule.getScheduleItems(req.params.projectId, req.tenantId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Create schedule item(s) from phase codes
router.post('/',
  [
    body('projectId').isInt(),
    body('phaseCodeIds').isArray({ min: 1 }),
    body('groupBy').optional().isIn(['phase', 'cost_type', 'individual'])
  ],
  validate,
  async (req, res, next) => {
    try {
      const { projectId, phaseCodeIds, groupBy } = req.body;

      // Verify project ownership
      const project = await Project.findByIdAndTenant(projectId, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const items = await PhaseSchedule.bulkCreateFromPhaseCodes(
        projectId, phaseCodeIds, groupBy || 'individual', req.tenantId, req.user.id
      );
      res.status(201).json(items);
    } catch (error) {
      next(error);
    }
  }
);

// Update a schedule item
router.put('/:id', async (req, res, next) => {
  try {
    const item = await PhaseSchedule.getScheduleItemById(req.params.id, req.tenantId);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    const updated = await PhaseSchedule.updateScheduleItem(req.params.id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete a schedule item
router.delete('/:id', async (req, res, next) => {
  try {
    const item = await PhaseSchedule.getScheduleItemById(req.params.id, req.tenantId);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    await PhaseSchedule.deleteScheduleItem(req.params.id, req.tenantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Reorder schedule items
router.put('/project/:projectId/reorder', verifyProjectOwnership, async (req, res, next) => {
  try {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }
    await PhaseSchedule.reorder(req.params.projectId, itemIds, req.tenantId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
