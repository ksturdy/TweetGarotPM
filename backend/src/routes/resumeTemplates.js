const express = require('express');
const ResumeTemplate = require('../models/ResumeTemplate');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/resume-templates
 * List resume templates for the tenant.
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.is_active !== undefined) {
      filters.is_active = req.query.is_active === 'true';
    }
    const templates = await ResumeTemplate.findAllByTenant(req.tenantId, filters);
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

router.get('/default', async (req, res, next) => {
  try {
    const tpl = await ResumeTemplate.getDefault(req.tenantId);
    if (!tpl) return res.status(404).json({ error: 'No default resume template configured' });
    res.json(tpl);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tpl = await ResumeTemplate.findByIdAndTenant(req.params.id, req.tenantId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tpl);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const tpl = await ResumeTemplate.create(req.body, req.tenantId);
    res.status(201).json(tpl);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const tpl = await ResumeTemplate.update(req.params.id, req.body, req.tenantId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tpl);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/set-default', async (req, res, next) => {
  try {
    const tpl = await ResumeTemplate.setDefault(req.params.id, req.tenantId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json(tpl);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await ResumeTemplate.delete(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
