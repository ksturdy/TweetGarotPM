const express = require('express');
const router = express.Router();
const MapMarketGroup = require('../models/MapMarketGroup');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

// GET / — list all groups with their markets
router.get('/', async (req, res, next) => {
  try {
    const groups = await MapMarketGroup.getAll(req.tenantId);
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// GET /:id — single group
router.get('/:id', async (req, res, next) => {
  try {
    const group = await MapMarketGroup.getByIdAndTenant(req.params.id, req.tenantId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// POST / — create group
router.post('/', async (req, res, next) => {
  try {
    const { name, pin_color, markets, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const group = await MapMarketGroup.create(
      { name: name.trim(), pin_color, markets, sort_order },
      req.user.id,
      req.tenantId
    );
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

// PUT /:id — update group
router.put('/:id', async (req, res, next) => {
  try {
    const { name, pin_color, markets, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const existing = await MapMarketGroup.getByIdAndTenant(req.params.id, req.tenantId);
    if (!existing) return res.status(404).json({ error: 'Group not found' });
    const group = await MapMarketGroup.update(
      req.params.id,
      { name: name.trim(), pin_color, markets, sort_order },
      req.tenantId
    );
    res.json(group);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — delete group
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await MapMarketGroup.delete(req.params.id, req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Group not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
