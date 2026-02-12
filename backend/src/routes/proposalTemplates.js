const express = require('express');
const ProposalTemplate = require('../models/ProposalTemplate');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { getAvailableVariables } = require('../utils/templateProcessor');

const router = express.Router();

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/proposal-templates
 * List all proposal templates for the tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, is_active } = req.query;
    const filters = {};

    if (category) filters.category = category;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const templates = await ProposalTemplate.findAllByTenant(req.tenantId, filters);
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/proposal-templates/categories
 * Get list of template categories
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await ProposalTemplate.getCategories(req.tenantId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/proposal-templates/variables
 * Get list of available template variables
 */
router.get('/variables', async (req, res, next) => {
  try {
    const variables = getAvailableVariables();
    res.json(variables);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/proposal-templates/default
 * Get the default template for the tenant
 */
router.get('/default', async (req, res, next) => {
  try {
    const template = await ProposalTemplate.getDefault(req.tenantId);
    if (!template) {
      return res.status(404).json({ error: 'No default template found' });
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/proposal-templates/:id
 * Get a single proposal template with sections
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await ProposalTemplate.findByIdAndTenant(id, req.tenantId);

    if (!template) {
      return res.status(404).json({ error: 'Proposal template not found' });
    }

    res.json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/proposal-templates
 * Create a new proposal template
 */
router.post('/', async (req, res, next) => {
  try {
    const template = await ProposalTemplate.create(req.body, req.tenantId, req.user.id);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/proposal-templates/:id
 * Update a proposal template
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify template exists and belongs to tenant
    const existing = await ProposalTemplate.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Proposal template not found' });
    }

    const updated = await ProposalTemplate.update(id, req.body, req.tenantId, req.user.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/proposal-templates/:id
 * Delete a proposal template
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify template exists and belongs to tenant
    const existing = await ProposalTemplate.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Proposal template not found' });
    }

    // Don't allow deleting the default template
    if (existing.is_default) {
      return res.status(400).json({
        error: 'Cannot delete the default template. Set another template as default first.'
      });
    }

    await ProposalTemplate.delete(id, req.tenantId);
    res.json({ message: 'Proposal template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
