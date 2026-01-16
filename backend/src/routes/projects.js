const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all projects
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      managerId: req.query.managerId,
    };
    const projects = await Project.findAll(filters);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get single project
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Create project
router.post(
  '/',
  authenticate,
  authorize('admin', 'manager'),
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
      });
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const project = await Project.update(req.params.id, req.body);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Delete project
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    await Project.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
