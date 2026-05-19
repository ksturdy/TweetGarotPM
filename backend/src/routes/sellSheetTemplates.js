const express = require('express');
const SellSheetTemplate = require('../models/SellSheetTemplate');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

// GET /api/sell-sheet-templates
router.get('/', async (req, res, next) => {
  try {
    const { category, is_active } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const templates = await SellSheetTemplate.findAllByTenant(req.tenantId, filters);
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// GET /api/sell-sheet-templates/categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await SellSheetTemplate.getCategories(req.tenantId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/sell-sheet-templates/default
router.get('/default', async (req, res, next) => {
  try {
    const template = await SellSheetTemplate.getDefault(req.tenantId);
    if (!template) {
      return res.status(404).json({ error: 'No default template found' });
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// GET /api/sell-sheet-templates/:id
router.get('/:id', async (req, res, next) => {
  try {
    const template = await SellSheetTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!template) {
      return res.status(404).json({ error: 'Sell sheet template not found' });
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// POST /api/sell-sheet-templates
router.post('/', async (req, res, next) => {
  try {
    const template = await SellSheetTemplate.create(req.body, req.tenantId, req.user.id);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// PUT /api/sell-sheet-templates/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await SellSheetTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Sell sheet template not found' });
    }
    const updated = await SellSheetTemplate.update(req.params.id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sell-sheet-templates/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await SellSheetTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Sell sheet template not found' });
    }
    if (existing.is_default) {
      return res.status(400).json({
        error: 'Cannot delete the default template. Set another template as default first.'
      });
    }
    await SellSheetTemplate.delete(req.params.id, req.tenantId);
    res.json({ message: 'Sell sheet template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
