const express = require('express');
const CaseStudyTemplate = require('../models/CaseStudyTemplate');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

// GET /api/case-study-templates
router.get('/', async (req, res, next) => {
  try {
    const { category, is_active } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (is_active !== undefined) filters.is_active = is_active === 'true';

    const templates = await CaseStudyTemplate.findAllByTenant(req.tenantId, filters);
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// GET /api/case-study-templates/categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await CaseStudyTemplate.getCategories(req.tenantId);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/case-study-templates/default
router.get('/default', async (req, res, next) => {
  try {
    const template = await CaseStudyTemplate.getDefault(req.tenantId);
    if (!template) {
      return res.status(404).json({ error: 'No default template found' });
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// GET /api/case-study-templates/:id
router.get('/:id', async (req, res, next) => {
  try {
    const template = await CaseStudyTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!template) {
      return res.status(404).json({ error: 'Case study template not found' });
    }
    res.json(template);
  } catch (error) {
    next(error);
  }
});

// POST /api/case-study-templates
router.post('/', async (req, res, next) => {
  try {
    const template = await CaseStudyTemplate.create(req.body, req.tenantId, req.user.id);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

// PUT /api/case-study-templates/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await CaseStudyTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Case study template not found' });
    }
    const updated = await CaseStudyTemplate.update(req.params.id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/case-study-templates/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await CaseStudyTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Case study template not found' });
    }
    if (existing.is_default) {
      return res.status(400).json({
        error: 'Cannot delete the default template. Set another template as default first.'
      });
    }
    await CaseStudyTemplate.delete(req.params.id, req.tenantId);
    res.json({ message: 'Case study template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
