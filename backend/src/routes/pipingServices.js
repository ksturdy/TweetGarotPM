const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const PipingService = require('../models/PipingService');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// List all piping services for tenant (with size rules)
router.get('/', async (req, res, next) => {
  try {
    const services = await PipingService.findAll(req.tenantId);
    res.json(services);
  } catch (error) {
    next(error);
  }
});

// Get single piping service with size rules
router.get('/:id', async (req, res, next) => {
  try {
    const service = await PipingService.findById(req.params.id, req.tenantId);
    if (!service) {
      return res.status(404).json({ error: 'Piping service not found' });
    }
    res.json(service);
  } catch (error) {
    next(error);
  }
});

// Create piping service
router.post('/', async (req, res, next) => {
  try {
    const { name, service_category } = req.body;
    if (!name || !service_category) {
      return res.status(400).json({ error: 'name and service_category are required' });
    }
    const service = await PipingService.create(req.tenantId, req.body);
    res.status(201).json(service);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A piping service with this name already exists' });
    }
    next(error);
  }
});

// Update piping service
router.put('/:id', async (req, res, next) => {
  try {
    const service = await PipingService.update(req.params.id, req.tenantId, req.body);
    if (!service) {
      return res.status(404).json({ error: 'Piping service not found' });
    }
    res.json(service);
  } catch (error) {
    next(error);
  }
});

// Delete piping service
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await PipingService.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Piping service not found' });
    }
    res.json({ message: 'Piping service deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Size Rules ───

router.post('/:id/size-rules', async (req, res, next) => {
  try {
    const { max_size_inches, pipe_spec_id } = req.body;
    if (max_size_inches === undefined || !pipe_spec_id) {
      return res.status(400).json({ error: 'max_size_inches and pipe_spec_id are required' });
    }
    const rule = await PipingService.addSizeRule(req.params.id, req.body);
    res.status(201).json(rule);
  } catch (error) {
    next(error);
  }
});

router.put('/:id/size-rules/:ruleId', async (req, res, next) => {
  try {
    const rule = await PipingService.updateSizeRule(req.params.ruleId, req.body);
    if (!rule) {
      return res.status(404).json({ error: 'Size rule not found' });
    }
    res.json(rule);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/size-rules/:ruleId', async (req, res, next) => {
  try {
    const deleted = await PipingService.deleteSizeRule(req.params.ruleId);
    if (!deleted) {
      return res.status(404).json({ error: 'Size rule not found' });
    }
    res.json({ message: 'Size rule deleted' });
  } catch (error) {
    next(error);
  }
});

// Resolve which pipe spec to use for a given size
router.get('/:id/resolve-spec', async (req, res, next) => {
  try {
    const { size_inches } = req.query;
    if (!size_inches) {
      return res.status(400).json({ error: 'size_inches query parameter is required' });
    }
    const specId = await PipingService.resolveSpecForSize(req.params.id, parseFloat(size_inches));
    res.json({ pipe_spec_id: specId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
