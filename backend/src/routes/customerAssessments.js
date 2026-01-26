const express = require('express');
const CustomerAssessment = require('../models/CustomerAssessment');
const Customer = require('../models/Customer');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Apply auth and tenant middleware
router.use(authenticate);
router.use(tenantContext);

// Middleware to verify customer belongs to tenant
const verifyCustomerOwnership = async (req, res, next) => {
  try {
    const customerId = req.params.customerId;
    const customer = await Customer.findByIdAndTenant(customerId, req.tenantId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    req.customer = customer;
    next();
  } catch (error) {
    next(error);
  }
};

// Get assessment statistics (tenant-scoped) - must be before :customerId routes
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await CustomerAssessment.getStatsByTenant(req.tenantId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get current assessment for a customer
router.get('/:customerId/assessment', verifyCustomerOwnership, async (req, res, next) => {
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
router.get('/:customerId/assessments', verifyCustomerOwnership, async (req, res, next) => {
  try {
    const assessments = await CustomerAssessment.findAllByCustomerId(req.params.customerId);
    res.json(assessments);
  } catch (error) {
    next(error);
  }
});

// Create new assessment
router.post('/:customerId/assessment', verifyCustomerOwnership, async (req, res, next) => {
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
router.put('/:customerId/assessment/:id', verifyCustomerOwnership, async (req, res, next) => {
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
router.delete('/:customerId/assessment/:id', verifyCustomerOwnership, async (req, res, next) => {
  try {
    await CustomerAssessment.delete(req.params.id);
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
