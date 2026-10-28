const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const { authenticate } = require('../middleware/auth');
const pool = require('../config/database');

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

// Get all versions for a budget group
router.get('/group/:groupId', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const versions = await Budget.findByGroupId(req.params.groupId, tenantId);
    res.json(versions);
  } catch (error) {
    console.error('Error fetching budget versions:', error);
    res.status(500).json({ error: 'Failed to fetch budget versions' });
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

    let versionNumber = 1;
    const incomingGroupId = req.body.budget_group_id ? parseInt(req.body.budget_group_id, 10) : null;

    // When creating a new version of an existing group, auto-increment version_number
    if (incomingGroupId) {
      const vResult = await pool.query(
        'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM budgets WHERE budget_group_id = $1 AND tenant_id = $2',
        [incomingGroupId, tenantId]
      );
      versionNumber = parseInt(vResult.rows[0].next_version, 10);
    }

    const budgetData = {
      ...req.body,
      tenant_id: tenantId,
      created_by: userId,
      version_number: versionNumber,
      budget_group_id: incomingGroupId || null
    };

    const budget = await Budget.create(budgetData);

    // Self-link budget_group_id for first-ever versions of a project
    if (!incomingGroupId) {
      await pool.query(
        'UPDATE budgets SET budget_group_id = id WHERE id = $1',
        [budget.id]
      );
      budget.budget_group_id = budget.id;
    }

    // Link the narrative attachment to the newly-created budget
    const attId = parseInt(req.body.narrative_attachment_id, 10);
    if (attId) {
      try {
        await pool.query(
          `UPDATE attachments SET entity_type = 'budget', entity_id = $1 WHERE id = $2`,
          [budget.id, attId]
        );
      } catch (attErr) {
        console.error('[Budgets] Failed to link narrative attachment:', attErr.message);
      }
    }

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
