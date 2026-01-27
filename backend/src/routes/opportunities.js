const express = require('express');
const router = express.Router();
const opportunities = require('../models/opportunities');
const opportunityActivities = require('../models/opportunityActivities');
const { authenticate } = require('../middleware/auth');
const { tenantContext, checkLimit } = require('../middleware/tenant');
const { body, validationResult } = require('express-validator');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Get all pipeline stages for tenant
router.get('/stages', async (req, res, next) => {
  try {
    const pool = require('../config/database');
    const result = await pool.query(
      'SELECT id, name, color, probability, display_order FROM pipeline_stages WHERE is_active = true AND tenant_id = $1 ORDER BY display_order',
      [req.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get all opportunities (with optional filters)
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      stage_id: req.query.stage_id,
      assigned_to: req.query.assigned_to,
      priority: req.query.priority,
      search: req.query.search
    };

    const allOpportunities = await opportunities.findAll(filters, req.tenantId);
    res.json(allOpportunities);
  } catch (error) {
    next(error);
  }
});

// Get opportunities grouped by pipeline stages (Kanban view)
router.get('/kanban', async (req, res, next) => {
  try {
    const stages = await opportunities.findByStages(req.tenantId);
    res.json(stages);
  } catch (error) {
    next(error);
  }
});

// Get pipeline analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const filters = {
      assigned_to: req.query.assigned_to,
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };

    const analytics = await opportunities.getAnalytics(filters, req.tenantId);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

// Get pipeline trend data (monthly values over time)
router.get('/trend', async (req, res, next) => {
  try {
    const months = req.query.months || 7; // Default to 7 months
    const trendData = await opportunities.getPipelineTrend(months, req.tenantId);
    res.json(trendData);
  } catch (error) {
    next(error);
  }
});

// Get single opportunity
router.get('/:id', async (req, res, next) => {
  try {
    const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);

    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json(opportunity);
  } catch (error) {
    next(error);
  }
});

// Create new opportunity
router.post('/',
  checkLimit('max_opportunities', opportunities.countByTenant),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('estimated_value').optional({ values: 'falsy' }).isNumeric().withMessage('Estimated value must be a number'),
    body('priority').optional({ values: 'falsy' }).isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('construction_type').optional({ values: 'falsy' }).isString().withMessage('Construction type must be a string'),
    body('market').optional({ values: 'falsy' }).isString().withMessage('Market must be a string')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      console.log('Creating opportunity with data:', req.body);
      const opportunity = await opportunities.create(req.body, req.user.id, req.tenantId);
      res.status(201).json(opportunity);
    } catch (error) {
      console.error('Error creating opportunity:', error);
      next(error);
    }
  }
);

// Update opportunity
router.put('/:id',
  [
    body('estimated_value').optional().isNumeric().withMessage('Estimated value must be a number'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const opportunity = await opportunities.update(req.params.id, req.body, req.tenantId);

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json(opportunity);
    } catch (error) {
      next(error);
    }
  }
);

// Move opportunity to different stage
router.patch('/:id/stage',
  [body('stage_id').isInt().withMessage('Valid stage_id required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const opportunity = await opportunities.updateStage(req.params.id, req.body.stage_id, req.tenantId);

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json(opportunity);
    } catch (error) {
      next(error);
    }
  }
);

// Convert opportunity to project
router.post('/:id/convert',
  [body('project_id').isInt().withMessage('Valid project_id required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const opportunity = await opportunities.convertToProject(req.params.id, req.body.project_id, req.tenantId);

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json(opportunity);
    } catch (error) {
      next(error);
    }
  }
);

// Mark opportunity as lost
router.post('/:id/lost',
  [body('reason').optional().trim()],
  async (req, res, next) => {
    try {
      const opportunity = await opportunities.markAsLost(req.params.id, req.body.reason, req.tenantId);

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      res.json(opportunity);
    } catch (error) {
      next(error);
    }
  }
);

// Delete opportunity
router.delete('/:id', async (req, res, next) => {
  try {
    const opportunity = await opportunities.delete(req.params.id, req.tenantId);

    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json({ message: 'Opportunity deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== Activity Routes =====

// Get all activities for an opportunity
router.get('/:id/activities', async (req, res, next) => {
  try {
    // Verify opportunity belongs to tenant first
    const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    const activities = await opportunityActivities.findByOpportunityId(req.params.id);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

// Create new activity
router.post('/:id/activities',
  [
    body('activity_type').isIn(['call', 'meeting', 'email', 'note', 'task', 'voice_note']).withMessage('Invalid activity type'),
    body('subject').optional().trim()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Verify opportunity belongs to tenant first
      const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      const activityData = {
        ...req.body,
        opportunity_id: req.params.id
      };

      const activity = await opportunityActivities.create(activityData, req.user.id);
      res.status(201).json(activity);
    } catch (error) {
      next(error);
    }
  }
);

// Update activity
router.put('/:opportunityId/activities/:activityId', async (req, res, next) => {
  try {
    // Verify opportunity belongs to tenant first
    const opportunity = await opportunities.findByIdAndTenant(req.params.opportunityId, req.tenantId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const activity = await opportunityActivities.update(req.params.activityId, req.body);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    next(error);
  }
});

// Mark activity as complete
router.patch('/:opportunityId/activities/:activityId/complete', async (req, res, next) => {
  try {
    // Verify opportunity belongs to tenant first
    const opportunity = await opportunities.findByIdAndTenant(req.params.opportunityId, req.tenantId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const activity = await opportunityActivities.markComplete(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    next(error);
  }
});

// Delete activity
router.delete('/:opportunityId/activities/:activityId', async (req, res, next) => {
  try {
    // Verify opportunity belongs to tenant first
    const opportunity = await opportunities.findByIdAndTenant(req.params.opportunityId, req.tenantId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const activity = await opportunityActivities.delete(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get upcoming activities across all opportunities
router.get('/activities/upcoming', async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const activities = await opportunityActivities.findUpcoming(req.user.id, limit);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

// Get overdue activities
router.get('/activities/overdue', async (req, res, next) => {
  try {
    const activities = await opportunityActivities.findOverdue(req.user.id);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
