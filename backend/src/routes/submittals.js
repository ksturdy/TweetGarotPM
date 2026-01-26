const express = require('express');
const { body, validationResult } = require('express-validator');
const Submittal = require('../models/Submittal');
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

// Get submittals for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      specSection: req.query.specSection,
    };
    const submittals = await Submittal.findByProject(req.params.projectId, filters);
    res.json(submittals);
  } catch (error) {
    next(error);
  }
});

// Get single submittal
router.get('/:id', async (req, res, next) => {
  try {
    const submittal = await Submittal.findById(req.params.id);
    if (!submittal) {
      return res.status(404).json({ error: 'Submittal not found' });
    }
    // Verify the submittal's project belongs to tenant
    const project = await Project.findByIdAndTenant(submittal.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Submittal not found' });
    }
    res.json(submittal);
  } catch (error) {
    next(error);
  }
});

// Create submittal
router.post(
  '/',
  [
    body('projectId').isInt(),
    body('specSection').trim().notEmpty(),
    body('description').trim().notEmpty(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const number = await Submittal.getNextNumber(req.body.projectId);
      const submittal = await Submittal.create({
        ...req.body,
        number,
        createdBy: req.user.id,
      });
      res.status(201).json(submittal);
    } catch (error) {
      next(error);
    }
  }
);

// Update submittal
router.put('/:id', async (req, res, next) => {
  try {
    // First get the submittal to verify ownership
    const existingSubmittal = await Submittal.findById(req.params.id);
    if (!existingSubmittal) {
      return res.status(404).json({ error: 'Submittal not found' });
    }
    // Verify the submittal's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingSubmittal.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Submittal not found' });
    }

    const submittal = await Submittal.update(req.params.id, req.body);
    res.json(submittal);
  } catch (error) {
    next(error);
  }
});

// Review submittal
router.post(
  '/:id/review',
  [body('status').isIn(['approved', 'approved_as_noted', 'revise_resubmit', 'rejected'])],
  validate,
  async (req, res, next) => {
    try {
      // First get the submittal to verify ownership
      const existingSubmittal = await Submittal.findById(req.params.id);
      if (!existingSubmittal) {
        return res.status(404).json({ error: 'Submittal not found' });
      }
      // Verify the submittal's project belongs to tenant
      const project = await Project.findByIdAndTenant(existingSubmittal.project_id, req.tenantId);
      if (!project) {
        return res.status(404).json({ error: 'Submittal not found' });
      }

      const submittal = await Submittal.review(req.params.id, {
        status: req.body.status,
        reviewNotes: req.body.reviewNotes,
        reviewedBy: req.user.id,
      });
      res.json(submittal);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
