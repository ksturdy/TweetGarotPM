const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const RateTable = require('../models/RateTable');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// List all rate tables for tenant
router.get('/', async (req, res, next) => {
  try {
    const tables = await RateTable.findAll(req.tenantId);
    res.json(tables);
  } catch (error) {
    next(error);
  }
});

// Get a single rate table with columns
router.get('/:id', async (req, res, next) => {
  try {
    const table = await RateTable.findById(Number(req.params.id), req.tenantId);
    if (!table) return res.status(404).json({ error: 'Rate table not found' });
    res.json(table);
  } catch (error) {
    next(error);
  }
});

// Create a rate table with columns
router.post('/', async (req, res, next) => {
  try {
    const { name, category, notes, columns } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }
    const table = await RateTable.create(req.tenantId, { name, category, notes, columns });
    res.status(201).json(table);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A rate table named "${req.body.name}" already exists` });
    }
    next(error);
  }
});

// Update rate table metadata
router.put('/:id', async (req, res, next) => {
  try {
    const table = await RateTable.update(Number(req.params.id), req.tenantId, req.body);
    if (!table) return res.status(404).json({ error: 'Rate table not found' });
    res.json(table);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A rate table named "${req.body.name}" already exists` });
    }
    next(error);
  }
});

// Delete a rate table
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await RateTable.delete(Number(req.params.id), req.tenantId);
    if (!result) return res.status(404).json({ error: 'Rate table not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Duplicate a rate table
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const table = await RateTable.duplicate(Number(req.params.id), req.tenantId, name);
    if (!table) return res.status(404).json({ error: 'Rate table not found' });
    res.status(201).json(table);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `A rate table named "${req.body.name}" already exists` });
    }
    next(error);
  }
});

// ─── Column endpoints ───

// Update a single column
router.put('/:id/columns/:colId', async (req, res, next) => {
  try {
    const column = await RateTable.updateColumn(Number(req.params.colId), req.body);
    if (!column) return res.status(404).json({ error: 'Column not found' });
    res.json(column);
  } catch (error) {
    next(error);
  }
});

// Add columns to a rate table
router.post('/:id/columns', async (req, res, next) => {
  try {
    const { columns } = req.body;
    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: 'columns array is required' });
    }
    const added = await RateTable.addColumns(Number(req.params.id), columns);
    res.status(201).json(added);
  } catch (error) {
    next(error);
  }
});

// Remove a column
router.delete('/:id/columns/:colId', async (req, res, next) => {
  try {
    const result = await RateTable.removeColumn(Number(req.params.colId));
    if (!result) return res.status(404).json({ error: 'Column not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
