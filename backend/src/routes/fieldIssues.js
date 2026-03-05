const express = require('express');
const { body, validationResult } = require('express-validator');
const FieldIssue = require('../models/FieldIssue');
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

// Get issues for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      trade: req.query.trade,
    };
    const issues = await FieldIssue.findByProject(req.params.projectId, filters);
    res.json(issues);
  } catch (error) {
    next(error);
  }
});

// Get single issue
router.get('/:id', async (req, res, next) => {
  try {
    const issue = await FieldIssue.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const project = await Project.findByIdAndTenant(issue.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    res.json(issue);
  } catch (error) {
    next(error);
  }
});

// Create issue
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const number = await FieldIssue.getNextNumber(projectId);
      const issue = await FieldIssue.create({
        projectId,
        tenantId: req.tenantId,
        number,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority || 'normal',
        trade: req.body.trade,
        location: req.body.location,
        notes: req.body.notes,
        createdBy: req.user.id,
      });
      res.status(201).json(issue);
    } catch (error) {
      next(error);
    }
  }
);

// Update issue
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await FieldIssue.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const issue = await FieldIssue.update(req.params.id, req.body);
    res.json(issue);
  } catch (error) {
    next(error);
  }
});

// Submit issue
router.post('/:id/submit', async (req, res, next) => {
  try {
    const existing = await FieldIssue.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const issue = await FieldIssue.submit(req.params.id);
    res.json(issue);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await FieldIssue.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft issues can be deleted' });
    }
    await FieldIssue.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
