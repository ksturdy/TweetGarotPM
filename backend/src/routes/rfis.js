const express = require('express');
const { body, validationResult } = require('express-validator');
const RFI = require('../models/RFI');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get RFIs for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const rfis = await RFI.findByProject(req.params.projectId, filters);
    res.json(rfis);
  } catch (error) {
    next(error);
  }
});

// Get single RFI
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.findById(req.params.id);
    if (!rfi) {
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
  authenticate,
  [
    body('projectId').isInt(),
    body('subject').trim().notEmpty(),
    body('question').trim().notEmpty(),
  ],
  validate,
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
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.update(req.params.id, req.body);
    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Respond to RFI
router.post('/:id/respond', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.respond(req.params.id, {
      response: req.body.response,
      respondedBy: req.user.id,
    });
    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

// Close RFI
router.post('/:id/close', authenticate, async (req, res, next) => {
  try {
    const rfi = await RFI.update(req.params.id, { status: 'closed' });
    if (!rfi) {
      return res.status(404).json({ error: 'RFI not found' });
    }
    res.json(rfi);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
