const express = require('express');
const ServiceOffering = require('../models/ServiceOffering');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Disable caching for all service offering endpoints
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

/**
 * GET /api/service-offerings
 * List all service offerings for the tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, is_active } = req.query;
    const filters = {};

    if (category) filters.category = category;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const serviceOfferings = await ServiceOffering.findAllByTenant(req.tenantId, filters);
    res.json(serviceOfferings);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/service-offerings/categories
 * Get list of categories used in service offerings
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await ServiceOffering.getCategories(req.tenantId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/service-offerings/:id
 * Get a single service offering
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const serviceOffering = await ServiceOffering.findByIdAndTenant(id, req.tenantId);

    if (!serviceOffering) {
      return res.status(404).json({ error: 'Service offering not found' });
    }

    res.json(serviceOffering);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/service-offerings
 * Create a new service offering
 */
router.post('/', async (req, res, next) => {
  try {
    const serviceOffering = await ServiceOffering.create(req.body, req.tenantId);
    res.status(201).json(serviceOffering);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/service-offerings/:id
 * Update a service offering
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify service offering exists and belongs to tenant
    const existing = await ServiceOffering.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Service offering not found' });
    }

    const updated = await ServiceOffering.update(id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/service-offerings/:id
 * Delete a service offering
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify service offering exists and belongs to tenant
    const existing = await ServiceOffering.findByIdAndTenant(id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Service offering not found' });
    }

    // Check if used in proposals (will be implemented when proposals module exists)
    const isUsed = await ServiceOffering.isUsedInProposals(id);
    if (isUsed) {
      return res.status(400).json({
        error: 'Cannot delete service offering that is used in proposals'
      });
    }

    await ServiceOffering.delete(id, req.tenantId);
    res.json({ message: 'Service offering deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/service-offerings/reorder
 * Reorder service offerings
 */
router.post('/reorder', async (req, res, next) => {
  try {
    const { updates } = req.body; // Array of { id, display_order }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    await ServiceOffering.reorder(updates, req.tenantId);
    res.json({ message: 'Service offerings reordered successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
