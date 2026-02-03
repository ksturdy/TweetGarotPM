const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const { authenticate } = require('../middleware/auth');

// Get all budgets
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { status, building_type, project_type, search } = req.query;

    const budgets = await Budget.findAll(tenantId, {
      status,
      building_type,
      project_type,
      search
    });

    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get budget stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const stats = await Budget.getStats(tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching budget stats:', error);
    res.status(500).json({ error: 'Failed to fetch budget stats' });
  }
});

// Get single budget by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const budget = await Budget.findById(req.params.id, tenantId);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Create new budget
router.post('/', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;

    const budgetData = {
      ...req.body,
      tenant_id: tenantId,
      created_by: userId
    };

    const budget = await Budget.create(budgetData);
    res.status(201).json(budget);
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Update budget
router.put('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const budget = await Budget.update(req.params.id, tenantId, req.body);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json(budget);
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Delete budget
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const budget = await Budget.delete(req.params.id, tenantId);

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

module.exports = router;
