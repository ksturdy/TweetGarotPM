const express = require('express');
const CustomerAssessment = require('../models/CustomerAssessment');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Get current assessment for a customer
router.get('/:customerId/assessment', authenticate, async (req, res, next) => {
  try {
    const assessment = await CustomerAssessment.findByCustomerId(req.params.customerId);
    if (!assessment) {
      return res.status(404).json({ error: 'No assessment found' });
    }
    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

// Get assessment history for a customer
router.get('/:customerId/assessments', authenticate, async (req, res, next) => {
  try {
    const assessments = await CustomerAssessment.findAllByCustomerId(req.params.customerId);
    res.json(assessments);
  } catch (error) {
    next(error);
  }
});

// Create new assessment
router.post('/:customerId/assessment', authenticate, async (req, res, next) => {
  try {
    const assessment = await CustomerAssessment.create(
      req.params.customerId,
      req.body,
      req.user.id
    );
    res.status(201).json(assessment);
  } catch (error) {
    next(error);
  }
});

// Update existing assessment
router.put('/:customerId/assessment/:id', authenticate, async (req, res, next) => {
  try {
    const assessment = await CustomerAssessment.update(
      req.params.id,
      req.body,
      req.user.id
    );
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(assessment);
  } catch (error) {
    next(error);
  }
});

// Delete assessment
router.delete('/:customerId/assessment/:id', authenticate, async (req, res, next) => {
  try {
    await CustomerAssessment.delete(req.params.id);
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get assessment statistics
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const stats = await CustomerAssessment.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
