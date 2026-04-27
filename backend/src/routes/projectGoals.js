const express = require('express');
const router = express.Router();
const ProjectGoal = require('../models/ProjectGoal');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/projects/:projectId/goals
 * Get goal targets for a project (returns null if none set)
 */
router.get('/:projectId/goals', async (req, res) => {
  try {
    const goals = await ProjectGoal.getByProject(Number(req.params.projectId), req.tenantId);
    res.json(goals);
  } catch (error) {
    console.error('Error fetching project goals:', error);
    res.status(500).json({ error: 'Failed to fetch project goals' });
  }
});

/**
 * PUT /api/projects/:projectId/goals
 * Create or update goal targets for a project
 */
router.put('/:projectId/goals', async (req, res) => {
  try {
    const goals = await ProjectGoal.upsert(
      Number(req.params.projectId),
      req.tenantId,
      req.body,
      req.user.id
    );
    res.json(goals);
  } catch (error) {
    console.error('Error saving project goals:', error);
    res.status(500).json({ error: 'Failed to save project goals' });
  }
});

/**
 * DELETE /api/projects/:projectId/goals
 * Clear all goal targets for a project
 */
router.delete('/:projectId/goals', async (req, res) => {
  try {
    await ProjectGoal.delete(Number(req.params.projectId), req.tenantId);
    res.json({ message: 'Goals cleared' });
  } catch (error) {
    console.error('Error deleting project goals:', error);
    res.status(500).json({ error: 'Failed to delete project goals' });
  }
});

module.exports = router;
