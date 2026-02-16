const express = require('express');
const { body, validationResult } = require('express-validator');
const WeeklyGoalPlan = require('../models/WeeklyGoalPlan');
const WeeklyGoalTask = require('../models/WeeklyGoalTask');
const DailyTradeActuals = require('../models/DailyTradeActuals');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware to verify project belongs to tenant
const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
};

// ========== WEEKLY GOAL PLANS ROUTES ==========

// Get all plans for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status
    };
    const plans = await WeeklyGoalPlan.findByProject(req.params.projectId, filters);
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// Get single plan by ID
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.id, req.tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Weekly goal plan not found' });
    }
    res.json(plan);
  } catch (error) {
    next(error);
  }
});

// Get plan summary (planned vs actual hours)
router.get('/:id/summary', async (req, res, next) => {
  try {
    const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.id, req.tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Weekly goal plan not found' });
    }
    const summary = await WeeklyGoalPlan.getWeeklySummary(req.params.id);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// Create new plan
router.post(
  '/',
  [
    body('projectId').isInt(),
    body('weekStartDate').isISO8601(),
    body('weekEndDate').isISO8601(),
    body('includeSunday').optional().isBoolean(),
    body('plumbingForeman').optional().isString(),
    body('plumbingCrewSize').optional().isInt({ min: 0 }),
    body('plumbingHoursPerDay').optional().isFloat({ min: 0 }),
    body('plumbingDaysWorked').optional().isInt({ min: 0 }),
    body('pipingForeman').optional().isString(),
    body('pipingCrewSize').optional().isInt({ min: 0 }),
    body('pipingHoursPerDay').optional().isFloat({ min: 0 }),
    body('pipingDaysWorked').optional().isInt({ min: 0 }),
    body('sheetMetalForeman').optional().isString(),
    body('sheetMetalCrewSize').optional().isInt({ min: 0 }),
    body('sheetMetalHoursPerDay').optional().isFloat({ min: 0 }),
    body('sheetMetalDaysWorked').optional().isInt({ min: 0 }),
    body('status').optional().isIn(['active', 'completed', 'cancelled']),
    body('notes').optional().isString()
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      // Validate week dates
      const startDate = new Date(req.body.weekStartDate);
      const endDate = new Date(req.body.weekEndDate);
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'Week end date must be after start date' });
      }

      const plan = await WeeklyGoalPlan.create({
        ...req.body,
        tenantId: req.tenantId,
        createdBy: req.user.id
      });
      res.status(201).json(plan);
    } catch (error) {
      if (error.message && error.message.includes('duplicate key')) {
        return res.status(409).json({ error: 'A plan already exists for this week' });
      }
      next(error);
    }
  }
);

// Update plan
router.put(
  '/:id',
  [
    body('weekStartDate').optional().isISO8601(),
    body('weekEndDate').optional().isISO8601(),
    body('includeSunday').optional().isBoolean(),
    body('plumbingForeman').optional().isString(),
    body('plumbingCrewSize').optional().isInt({ min: 0 }),
    body('plumbingHoursPerDay').optional().isFloat({ min: 0 }),
    body('plumbingDaysWorked').optional().isInt({ min: 0 }),
    body('pipingForeman').optional().isString(),
    body('pipingCrewSize').optional().isInt({ min: 0 }),
    body('pipingHoursPerDay').optional().isFloat({ min: 0 }),
    body('pipingDaysWorked').optional().isInt({ min: 0 }),
    body('sheetMetalForeman').optional().isString(),
    body('sheetMetalCrewSize').optional().isInt({ min: 0 }),
    body('sheetMetalHoursPerDay').optional().isFloat({ min: 0 }),
    body('sheetMetalDaysWorked').optional().isInt({ min: 0 }),
    body('status').optional().isIn(['active', 'completed', 'cancelled']),
    body('notes').optional().isString()
  ],
  validate,
  async (req, res, next) => {
    try {
      const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.id, req.tenantId);
      if (!plan) {
        return res.status(404).json({ error: 'Weekly goal plan not found' });
      }

      // Validate week dates if both provided
      if (req.body.weekStartDate && req.body.weekEndDate) {
        const startDate = new Date(req.body.weekStartDate);
        const endDate = new Date(req.body.weekEndDate);
        if (endDate <= startDate) {
          return res.status(400).json({ error: 'Week end date must be after start date' });
        }
      }

      const updated = await WeeklyGoalPlan.update(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete plan
router.delete('/:id', async (req, res, next) => {
  try {
    const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.id, req.tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Weekly goal plan not found' });
    }
    await WeeklyGoalPlan.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ========== WEEKLY GOAL TASKS ROUTES ==========

// Get all tasks for a plan
router.get('/:planId/tasks', async (req, res, next) => {
  try {
    const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.planId, req.tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Weekly goal plan not found' });
    }

    const filters = {
      trade: req.query.trade,
      date: req.query.date,
      status: req.query.status
    };
    const tasks = await WeeklyGoalTask.findByWeeklyPlan(req.params.planId, filters);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Create new task
router.post(
  '/:planId/tasks',
  [
    body('trade').isIn(['plumbing', 'piping', 'sheet_metal']),
    body('taskDate').isISO8601(),
    body('description').notEmpty().isString(),
    body('quantity').optional().isFloat({ min: 0 }),
    body('unit').optional().isString(),
    body('status').optional().isIn(['complete', 'incomplete']),
    body('incompleteReason').optional().isIn(['rescheduled', 'weather', 'materials', 'equipment', 'labor', 'gc_delay', 'other_trade', 'other']),
    body('incompleteNotes').optional().isString(),
    body('actualHours').optional().isFloat({ min: 0 }),
    body('sortOrder').optional().isInt({ min: 0 })
  ],
  validate,
  async (req, res, next) => {
    try {
      const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.planId, req.tenantId);
      if (!plan) {
        return res.status(404).json({ error: 'Weekly goal plan not found' });
      }

      const task = await WeeklyGoalTask.create({
        weeklyGoalPlanId: req.params.planId,
        tenantId: req.tenantId,
        createdBy: req.user.id,
        ...req.body
      });
      res.status(201).json(task);
    } catch (error) {
      if (error.message && error.message.includes('must be between')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

// Update task
router.put(
  '/tasks/:taskId',
  [
    body('trade').optional().isIn(['plumbing', 'piping', 'sheet_metal']),
    body('taskDate').optional().isISO8601(),
    body('description').optional().isString(),
    body('quantity').optional().isFloat({ min: 0 }),
    body('unit').optional().isString(),
    body('status').optional().isIn(['complete', 'incomplete']),
    body('incompleteReason').optional().isIn(['rescheduled', 'weather', 'materials', 'equipment', 'labor', 'gc_delay', 'other_trade', 'other']),
    body('incompleteNotes').optional().isString(),
    body('actualHours').optional().isFloat({ min: 0 }),
    body('sortOrder').optional().isInt({ min: 0 })
  ],
  validate,
  async (req, res, next) => {
    try {
      const task = await WeeklyGoalTask.findByIdAndTenant(req.params.taskId, req.tenantId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updated = await WeeklyGoalTask.update(req.params.taskId, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Update task status
router.patch(
  '/tasks/:taskId/status',
  [
    body('status').isIn(['complete', 'incomplete']),
    body('incompleteReason').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return ['rescheduled', 'weather', 'materials', 'equipment', 'labor', 'gc_delay', 'other_trade', 'other'].includes(value);
    }),
    body('incompleteNotes').optional().custom((value) => {
      if (value === null || value === undefined) return true;
      return typeof value === 'string';
    })
  ],
  validate,
  async (req, res, next) => {
    try {
      const task = await WeeklyGoalTask.findByIdAndTenant(req.params.taskId, req.tenantId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updated = await WeeklyGoalTask.updateStatus(
        req.params.taskId,
        req.body.status,
        req.body.incompleteReason === null ? null : req.body.incompleteReason,
        req.body.incompleteNotes === null ? null : req.body.incompleteNotes
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Move task earlier (previous day)
router.patch('/tasks/:taskId/move-earlier', async (req, res, next) => {
  try {
    const task = await WeeklyGoalTask.findByIdAndTenant(req.params.taskId, req.tenantId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await WeeklyGoalTask.moveTask(req.params.taskId, 'earlier');
    res.json(updated);
  } catch (error) {
    if (error.message && error.message.includes('Cannot move')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Move task later (next day)
router.patch('/tasks/:taskId/move-later', async (req, res, next) => {
  try {
    const task = await WeeklyGoalTask.findByIdAndTenant(req.params.taskId, req.tenantId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await WeeklyGoalTask.moveTask(req.params.taskId, 'later');
    res.json(updated);
  } catch (error) {
    if (error.message && error.message.includes('Cannot move')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// Move task to next week
router.patch('/tasks/:taskId/move-next-week', async (req, res, next) => {
  try {
    const task = await WeeklyGoalTask.findByIdAndTenant(req.params.taskId, req.tenantId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updated = await WeeklyGoalTask.moveTask(req.params.taskId, 'next-week');
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete task
router.delete('/tasks/:taskId', async (req, res, next) => {
  try {
    const task = await WeeklyGoalTask.findByIdAndTenant(req.params.taskId, req.tenantId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await WeeklyGoalTask.delete(req.params.taskId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ========== DAILY TRADE ACTUALS ROUTES ==========

// Get daily actuals for a plan
router.get('/:planId/daily-actuals', async (req, res, next) => {
  try {
    const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.planId, req.tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Weekly goal plan not found' });
    }

    const actuals = await DailyTradeActuals.findByPlanAndTenant(req.params.planId, req.tenantId);
    res.json(actuals);
  } catch (error) {
    next(error);
  }
});

// Create or update daily actuals
router.post(
  '/:planId/daily-actuals',
  [
    body('work_date').isISO8601(),
    body('trade').isIn(['plumbing', 'piping', 'sheet_metal']),
    body('actual_crew_size').optional().isInt({ min: 0 }),
    body('actual_hours_worked').optional().isFloat({ min: 0 }),
    body('notes').optional().isString()
  ],
  validate,
  async (req, res, next) => {
    try {
      const plan = await WeeklyGoalPlan.findByIdAndTenant(req.params.planId, req.tenantId);
      if (!plan) {
        return res.status(404).json({ error: 'Weekly goal plan not found' });
      }

      const actuals = await DailyTradeActuals.create({
        weeklyGoalPlanId: req.params.planId,
        tenantId: req.tenantId,
        workDate: req.body.work_date,
        trade: req.body.trade,
        actualCrewSize: req.body.actual_crew_size,
        actualHoursWorked: req.body.actual_hours_worked,
        notes: req.body.notes,
        createdBy: req.user.id
      });
      res.status(201).json(actuals);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
