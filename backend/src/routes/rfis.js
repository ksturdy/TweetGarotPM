const express = require('express');
const { body, validationResult } = require('express-validator');
const RFI = require('../models/RFI');
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

// Get RFIs for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const rfis = await RFI.findByProject(req.params.projectId, filters);
    res.json(rfis);
  } catch (error) {
    next(error);
  }
});

// Get single RFI
router.get('/:id', async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);
    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(rfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Create RFI
router.post(
  '/',
  [
    body('projectId').isInt(),
    body('subject').trim().notEmpty(),
    body('question').trim().notEmpty(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const number = await RFI.getNextNumber(req.body.projectId);
      const rfi = await RFI.create({
        ...req.body,
        number,
        createdBy: req.user.id,
      });
      res.status(201).json(rfi);
    } catch (error) {
      next(error);
    }
  }
);

// Update RFI
router.put('/:id', async (req, res, next) => {
  try {
    // First get the RFI to verify ownership
    const existingRfi = await RFI.findById(req.params.id);
    if (!existingRfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingRfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    const rfi = await RFI.update(req.params.id, req.body);
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Respond to RFI
router.post('/:id/respond', async (req, res, next) => {
  try {
    // First get the RFI to verify ownership
    const existingRfi = await RFI.findById(req.params.id);
    if (!existingRfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingRfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    const rfi = await RFI.respond(req.params.id, {
      response: req.body.response,
      respondedBy: req.user.id,
    });
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Close RFI
router.post('/:id/close', async (req, res, next) => {
  try {
    // First get the RFI to verify ownership
    const existingRfi = await RFI.findById(req.params.id);
    if (!existingRfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    // Verify the RFI's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingRfi.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'RFI not found' });
    }

    const rfi = await RFI.update(req.params.id, { status: 'closed' });
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
