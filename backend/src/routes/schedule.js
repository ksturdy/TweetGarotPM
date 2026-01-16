const express = require('express');
const { body, validationResult } = require('express-validator');
const ScheduleItem = require('../models/ScheduleItem');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get schedule items for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const items = await ScheduleItem.findByProject(req.params.projectId);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// Get project progress summary
router.get('/project/:projectId/progress', authenticate, async (req, res, next) => {
  try {
    const progress = await ScheduleItem.getProjectProgress(req.params.projectId);
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

// Get single schedule item
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await ScheduleItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Get children of a schedule item
router.get('/:id/children', authenticate, async (req, res, next) => {
  try {
    const children = await ScheduleItem.findChildren(req.params.id);
    res.json(children);
  } catch (error) {
    next(error);
  }
});

// Create schedule item
router.post(
  '/',
  authenticate,
  [
    body('projectId').isInt(),
    body('name').trim().notEmpty(),
    body('startDate').isDate(),
    body('endDate').isDate(),
  ],
  validate,
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
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await ScheduleItem.update(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Update progress
router.patch('/:id/progress', authenticate, async (req, res, next) => {
  try {
    const item = await ScheduleItem.updateProgress(req.params.id, req.body.percentComplete);
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// Delete schedule item
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await ScheduleItem.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
