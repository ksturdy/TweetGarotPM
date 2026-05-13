const express = require('express');
const router = express.Router();
const db = require('../config/database');
const opportunities = require('../models/opportunities');
const opportunityActivities = require('../models/opportunityActivities');
const OpportunityComment = require('../models/OpportunityComment');
const OpportunityLink = require('../models/OpportunityLink');
const OpportunityFollower = require('../models/OpportunityFollower');
const OpportunityEstimate = require('../models/OpportunityEstimate');
const OpportunityScore = require('../models/OpportunityScore');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');
const { tenantContext, checkLimit } = require('../middleware/tenant');
const { body, validationResult } = require('express-validator');

// Helper: notify followers of an opportunity event (fire-and-forget)
async function notifyFollowers(opportunityId, tenantId, excludeUserId, { eventType, title, message, link }) {
  try {
    const followerIds = await OpportunityFollower.getFollowerUserIds(opportunityId, tenantId);
    for (const userId of followerIds) {
      if (userId === excludeUserId) continue;
      await Notification.create({
        tenantId,
        userId,
        entityType: 'opportunity',
        entityId: opportunityId,
        eventType,
        title,
        message,
        link: link || '/sales-pipeline',
        createdBy: excludeUserId,
        emailSent: false,
      });
    }
  } catch (err) {
    console.error('Error sending opportunity notifications:', err);
  }
}

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

// Opportunities broken down by customer score tier
// Optional query param: ?campaign_id=123 to scope to a single campaign
router.get('/score-breakdown', async (req, res, next) => {
  try {
    const params = [req.tenantId];
    let campaignFilter = '';
    if (req.query.campaign_id) {
      params.push(req.query.campaign_id);
      campaignFilter = ` AND o.campaign_id = $${params.length}`;
    }
    const result = await db.query(`
      SELECT
        CASE
          WHEN c.customer_score >= 85 THEN 'A'
          WHEN c.customer_score >= 70 THEN 'B'
          WHEN c.customer_score >= 50 THEN 'C'
          WHEN c.customer_score IS NOT NULL AND c.customer_score < 50 THEN 'D'
          ELSE 'Unscored'
        END as tier,
        COUNT(*) as count,
        COALESCE(SUM(o.estimated_value), 0) as total_value
      FROM opportunities o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.tenant_id = $1${campaignFilter}
      GROUP BY tier
      ORDER BY tier
    `, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// ===== Estimate Routes (must be before /:id) =====

// Get default estimate percentages from historical data
// Optional query param: ?trades=pf,sm (comma-separated active trades)
router.get('/estimate-defaults', async (req, res, next) => {
  try {
    const options = {};
    if (req.query.trades) {
      options.trades = req.query.trades.split(',').filter(t => ['pf', 'sm', 'pl'].includes(t));
    }
    const defaults = await OpportunityEstimate.getDefaultPercentages(req.tenantId, options);
    res.json(defaults);
  } catch (error) {
    next(error);
  }
});

// Get all active pipeline opportunities with their estimate data (for labor forecast overlay)
router.get('/with-estimates', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        o.id, o.title, o.estimated_value, o.estimated_start_date, o.estimated_duration_days,
        o.estimated_end_date, o.location_group, o.market, o.priority,
        o.contour_type, o.user_adjusted_start_date, o.user_adjusted_duration_months,
        o.stage_id, o.probability, o.assigned_to, o.customer_id,
        o.awarded_status,
        ps.name as stage_name, ps.probability as stage_probability,
        e.first_name || ' ' || e.last_name as assigned_to_name,
        COALESCE(c.name, c.customer_owner) as customer_name,
        oe.labor_pct,
        oe.pf_labor_pct, oe.sm_labor_pct, oe.pl_labor_pct,
        oe.pf_shop_pct, oe.pf_field_pct,
        oe.sm_shop_pct, oe.sm_field_pct,
        oe.pl_shop_pct, oe.pl_field_pct,
        oe.pf_labor_rate, oe.sm_labor_rate, oe.pl_labor_rate
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN employees e ON o.assigned_to = e.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN opportunity_estimates oe ON oe.opportunity_id = o.id
      WHERE o.tenant_id = $1
        AND ps.name NOT IN ('Won', 'Lost', 'Passed')
        AND NOT (ps.name = 'Awarded' AND COALESCE(o.awarded_status, '') IN ('In Progress', 'Completed'))
        AND o.estimated_value IS NOT NULL
        AND o.estimated_value > 0
      ORDER BY o.estimated_value DESC
    `, [req.tenantId]);
    res.json(result.rows);
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
    body('market').optional({ values: 'falsy' }).isString().withMessage('Market must be a string'),
    body('location_group').optional({ values: 'falsy' }).isIn(['NEW', 'CW', 'WW', 'AZ', '']).withMessage('Invalid location group')
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

      // Fetch old opportunity to detect stage change
      const oldOpportunity = req.body.stage_id
        ? await opportunities.findByIdAndTenant(req.params.id, req.tenantId)
        : null;

      const opportunity = await opportunities.update(req.params.id, req.body, req.tenantId, req.user.id);

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Notify followers if stage changed
      if (oldOpportunity && String(oldOpportunity.stage_id) !== String(req.body.stage_id)) {
        const pool = require('../config/database');
        const stageResult = await pool.query(
          'SELECT id, name FROM pipeline_stages WHERE id IN ($1, $2) AND tenant_id = $3',
          [oldOpportunity.stage_id, req.body.stage_id, req.tenantId]
        );
        const stageMap = {};
        stageResult.rows.forEach(s => { stageMap[s.id] = s.name; });
        const oldName = stageMap[oldOpportunity.stage_id] || 'Unknown';
        const newName = stageMap[req.body.stage_id] || 'Unknown';

        notifyFollowers(opportunity.id, req.tenantId, req.user.id, {
          eventType: 'stage_changed',
          title: 'Opportunity Stage Changed',
          message: `"${opportunity.title}" moved from ${oldName} to ${newName}`,
        });
      }

      res.json(opportunity);
    } catch (error) {
      next(error);
    }
  }
);

// Update projection overrides for revenue grid
router.patch('/:id/projection', async (req, res, next) => {
  try {
    const { contour_type, user_adjusted_start_date, user_adjusted_duration_months } = req.body;
    const opportunity = await opportunities.updateProjectionOverrides(
      req.params.id,
      { contour_type, user_adjusted_start_date, user_adjusted_duration_months },
      req.tenantId,
      req.user.id
    );

    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json(opportunity);
  } catch (error) {
    next(error);
  }
});

// Move opportunity to different stage
router.patch('/:id/stage',
  [body('stage_id').isInt().withMessage('Valid stage_id required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Fetch old opportunity to detect stage change for notifications
      const oldOpportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
      if (!oldOpportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      const opportunity = await opportunities.updateStage(req.params.id, req.body.stage_id, req.tenantId, req.user.id);

      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      // Notify followers if stage actually changed
      if (String(oldOpportunity.stage_id) !== String(req.body.stage_id)) {
        const pool = require('../config/database');
        const stageResult = await pool.query(
          'SELECT id, name FROM pipeline_stages WHERE id IN ($1, $2) AND tenant_id = $3',
          [oldOpportunity.stage_id, req.body.stage_id, req.tenantId]
        );
        const stageMap = {};
        stageResult.rows.forEach(s => { stageMap[s.id] = s.name; });
        const oldName = stageMap[oldOpportunity.stage_id] || 'Unknown';
        const newName = stageMap[req.body.stage_id] || 'Unknown';

        notifyFollowers(opportunity.id, req.tenantId, req.user.id, {
          eventType: 'stage_changed',
          title: 'Opportunity Stage Changed',
          message: `"${opportunity.title}" moved from ${oldName} to ${newName}`,
        });
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
      const opportunity = await opportunities.markAsLost(req.params.id, req.body.reason, req.tenantId, req.user.id);

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
        opportunity_id: req.params.id,
        scheduled_at: req.body.scheduled_at || null,
        reminder_at: req.body.reminder_at || null,
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

    const updateData = {
      ...req.body,
      scheduled_at: req.body.scheduled_at === '' ? null : req.body.scheduled_at,
      reminder_at: req.body.reminder_at === '' ? null : req.body.reminder_at,
    };
    const activity = await opportunityActivities.update(req.params.activityId, updateData);

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

// ===== Comment Routes =====

// Get all comments for an opportunity
router.get('/:id/comments', async (req, res, next) => {
  try {
    const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    const comments = await OpportunityComment.findByOpportunityId(req.params.id, req.tenantId);
    res.json(comments);
  } catch (error) {
    next(error);
  }
});

// Add a comment to an opportunity
router.post('/:id/comments',
  [body('comment').trim().notEmpty().withMessage('Comment is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      const comment = await OpportunityComment.create(
        req.params.id, req.user.id, req.tenantId, req.body.comment
      );

      // Auto-follow the commenter (unless explicitly opted out)
      if (req.body.auto_follow !== false) {
        await OpportunityFollower.follow(req.params.id, req.user.id, req.tenantId);
      }

      // Notify other followers about the new comment
      const followerIds = await OpportunityFollower.getFollowerUserIds(Number(req.params.id), req.tenantId);
      notifyFollowers(Number(req.params.id), req.tenantId, req.user.id, {
        eventType: 'comment_added',
        title: 'New Comment on Opportunity',
        message: `New comment on "${opportunity.title}"`,
      });

      // Notify @mentioned users (skip commenter and existing followers to avoid duplicates)
      const mentionedUserIds = req.body.mentioned_user_ids || [];
      if (mentionedUserIds.length > 0) {
        const followerSet = new Set(followerIds);
        for (const mentionedUserId of mentionedUserIds) {
          if (mentionedUserId === req.user.id) continue;
          // Only create a mention notification if they won't already get the follower notification
          if (!followerSet.has(mentionedUserId)) {
            try {
              await Notification.create({
                tenantId: req.tenantId,
                userId: mentionedUserId,
                entityType: 'opportunity',
                entityId: Number(req.params.id),
                eventType: 'mentioned_in_comment',
                title: 'You were mentioned in a comment',
                message: `You were mentioned in a comment on "${opportunity.title}"`,
                link: '/sales',
                createdBy: req.user.id,
                emailSent: false,
              });
            } catch (err) {
              console.error('Error notifying mentioned user:', err);
            }
          }
          // Auto-follow mentioned users
          try {
            await OpportunityFollower.follow(req.params.id, mentionedUserId, req.tenantId);
          } catch (err) {
            // Ignore if already following
          }
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  }
);

// Update own comment
router.put('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const comment = await OpportunityComment.update(
      req.params.commentId, req.user.id, req.body.comment
    );
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    res.json(comment);
  } catch (error) {
    next(error);
  }
});

// Delete own comment
router.delete('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const comment = await OpportunityComment.delete(req.params.commentId, req.user.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== Link Routes =====

// Get all links for an opportunity
router.get('/:id/links', async (req, res, next) => {
  try {
    const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    const links = await OpportunityLink.findByOpportunityId(req.params.id, req.tenantId);
    res.json(links);
  } catch (error) {
    next(error);
  }
});

// Create a new link
router.post('/:id/links',
  [body('url').trim().notEmpty().withMessage('URL is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const opportunity = await opportunities.findByIdAndTenant(req.params.id, req.tenantId);
      if (!opportunity) {
        return res.status(404).json({ error: 'Opportunity not found' });
      }

      const link = await OpportunityLink.create(
        req.params.id, req.user.id, req.tenantId, req.body.url
      );
      res.status(201).json(link);
    } catch (error) {
      next(error);
    }
  }
);

// Update a link
router.put('/:id/links/:linkId',
  [body('url').trim().notEmpty().withMessage('URL is required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const link = await OpportunityLink.update(
        req.params.linkId, req.tenantId, req.body.url
      );
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }
      res.json(link);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a link
router.delete('/:id/links/:linkId', async (req, res, next) => {
  try {
    const link = await OpportunityLink.delete(req.params.linkId, req.tenantId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json({ message: 'Link deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ===== Follow Routes =====

// Check if current user follows this opportunity
router.get('/:id/follow', async (req, res, next) => {
  try {
    const following = await OpportunityFollower.isFollowing(req.params.id, req.user.id);
    res.json({ following });
  } catch (error) {
    next(error);
  }
});

// Follow an opportunity
router.post('/:id/follow', async (req, res, next) => {
  try {
    await OpportunityFollower.follow(req.params.id, req.user.id, req.tenantId);
    res.json({ following: true });
  } catch (error) {
    next(error);
  }
});

// Unfollow an opportunity
router.delete('/:id/follow', async (req, res, next) => {
  try {
    await OpportunityFollower.unfollow(req.params.id, req.user.id);
    res.json({ following: false });
  } catch (error) {
    next(error);
  }
});

// ===== Estimate Routes =====

// Get estimate for an opportunity
router.get('/:id/estimate', async (req, res, next) => {
  try {
    const estimate = await OpportunityEstimate.findByOpportunityId(req.params.id, req.tenantId);
    res.json(estimate);
  } catch (error) {
    next(error);
  }
});

// Create or update estimate for an opportunity
router.put('/:id/estimate', async (req, res, next) => {
  try {
    const estimate = await OpportunityEstimate.upsert(req.params.id, req.tenantId, req.body, req.user.id);
    res.json(estimate);
  } catch (error) {
    next(error);
  }
});

// Delete estimate for an opportunity
router.delete('/:id/estimate', async (req, res, next) => {
  try {
    const deleted = await OpportunityEstimate.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ===== Go/No-Go Score Routes =====

const scoreValidation = [
  body('gate').isInt({ min: 1, max: 2 }).withMessage('Gate must be 1 or 2'),
  body('customer_relationship').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('scope_fit').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('delivery_method').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('strategic_value').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('schedule_fit').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('margin_profile').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('win_probability_score').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('db_payment_dispute').optional().isBoolean(),
  body('db_liquidated_damages').optional().isBoolean(),
  body('db_schedule_conflict').optional().isBoolean(),
  body('db_scope_outside').optional().isBoolean(),
  body('db_margin_below_floor').optional().isBoolean(),
  body('db_bonding_unmet').optional().isBoolean(),
  body('has_override').optional().isBoolean(),
  body('override_reason').optional({ nullable: true }).trim(),
  body('notes').optional({ nullable: true }).trim(),
];

// Get all scores for an opportunity (history)
router.get('/:id/scores', async (req, res, next) => {
  try {
    const scores = await OpportunityScore.findByOpportunityId(req.params.id, req.tenantId);
    res.json(scores);
  } catch (error) {
    next(error);
  }
});

// Get most recent score
router.get('/:id/scores/latest', async (req, res, next) => {
  try {
    const score = await OpportunityScore.findLatest(req.params.id, req.tenantId);
    res.json(score);
  } catch (error) {
    next(error);
  }
});

// Create a new score
router.post('/:id/scores', scoreValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const score = await OpportunityScore.create(
      req.params.id,
      req.tenantId,
      req.body,
      req.user.id
    );
    res.status(201).json(score);
  } catch (error) {
    next(error);
  }
});

// Update an existing score
router.put('/:id/scores/:scoreId', scoreValidation, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const score = await OpportunityScore.update(
      req.params.scoreId,
      req.tenantId,
      req.body,
      req.user.id
    );
    if (!score) {
      return res.status(404).json({ error: 'Score not found' });
    }
    res.json(score);
  } catch (error) {
    next(error);
  }
});

// Delete a score
router.delete('/:id/scores/:scoreId', async (req, res, next) => {
  try {
    const deleted = await OpportunityScore.delete(req.params.scoreId, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Score not found' });
    }
    res.json({ message: 'Score deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
