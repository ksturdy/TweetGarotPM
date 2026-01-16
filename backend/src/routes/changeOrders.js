const express = require('express');
const { body, validationResult } = require('express-validator');
const ChangeOrder = require('../models/ChangeOrder');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get change orders for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const filters = { status: req.query.status };
    const changeOrders = await ChangeOrder.findByProject(req.params.projectId, filters);
    res.json(changeOrders);
  } catch (error) {
    next(error);
  }
});

// Get project change order totals
router.get('/project/:projectId/totals', authenticate, async (req, res, next) => {
  try {
    const totals = await ChangeOrder.getProjectTotals(req.params.projectId);
    res.json(totals);
  } catch (error) {
    next(error);
  }
});

// Get single change order
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const changeOrder = await ChangeOrder.findById(req.params.id);
    if (!changeOrder) {
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
  authenticate,
  [
    body('projectId').isInt(),
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
  ],
  validate,
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
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const changeOrder = await ChangeOrder.update(req.params.id, req.body);
    if (!changeOrder) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Submit change order for approval
router.post('/:id/submit', authenticate, async (req, res, next) => {
  try {
    const changeOrder = await ChangeOrder.update(req.params.id, { status: 'pending' });
    if (!changeOrder) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Approve change order
router.post('/:id/approve', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const changeOrder = await ChangeOrder.approve(req.params.id, {
      approvedBy: req.user.id,
    });
    if (!changeOrder) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

// Reject change order
router.post('/:id/reject', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const changeOrder = await ChangeOrder.reject(req.params.id, {
      rejectionReason: req.body.rejectionReason,
    });
    if (!changeOrder) {
      return res.status(404).json({ error: 'Change order not found' });
    }
    res.json(changeOrder);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
