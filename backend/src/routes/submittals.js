const express = require('express');
const { body, validationResult } = require('express-validator');
const Submittal = require('../models/Submittal');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get submittals for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
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
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const submittal = await Submittal.findById(req.params.id);
    if (!submittal) {
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
  authenticate,
  [
    body('projectId').isInt(),
    body('specSection').trim().notEmpty(),
    body('description').trim().notEmpty(),
  ],
  validate,
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
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const submittal = await Submittal.update(req.params.id, req.body);
    if (!submittal) {
      return res.status(404).json({ error: 'Submittal not found' });
    }
    res.json(submittal);
  } catch (error) {
    next(error);
  }
});

// Review submittal
router.post(
  '/:id/review',
  authenticate,
  [body('status').isIn(['approved', 'approved_as_noted', 'revise_resubmit', 'rejected'])],
  validate,
  async (req, res, next) => {
    try {
      const submittal = await Submittal.review(req.params.id, {
        status: req.body.status,
        reviewNotes: req.body.reviewNotes,
        reviewedBy: req.user.id,
      });
      if (!submittal) {
        return res.status(404).json({ error: 'Submittal not found' });
      }
      res.json(submittal);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
