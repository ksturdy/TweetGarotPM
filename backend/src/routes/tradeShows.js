const express = require('express');
const router = express.Router();
const TradeShow = require('../models/TradeShow');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { notify } = require('../utils/notificationService');

router.use(authenticate);
router.use(tenantContext);

// GET /api/trade-shows - List all trade shows
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.year) filters.year = parseInt(req.query.year);
    if (req.query.sales_lead_id) filters.sales_lead_id = parseInt(req.query.sales_lead_id);
    if (req.query.coordinator_id) filters.coordinator_id = parseInt(req.query.coordinator_id);
    if (req.query.search) filters.search = req.query.search;

    const shows = await TradeShow.findAllByTenant(req.tenantId, filters);
    res.json(shows);
  } catch (err) {
    next(err);
  }
});

// POST /api/trade-shows - Create trade show
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const show = await TradeShow.create(req.body, req.tenantId, req.user.id);
    res.status(201).json(show);
  } catch (err) {
    next(err);
  }
});

// GET /api/trade-shows/:id - Get trade show with attendees
router.get('/:id', async (req, res, next) => {
  try {
    const show = await TradeShow.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!show) {
      return res.status(404).json({ error: 'Trade show not found' });
    }
    res.json(show);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trade-shows/:id - Update trade show
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const show = await TradeShow.update(
      parseInt(req.params.id),
      req.body,
      req.tenantId,
      req.user.id
    );

    if (!show) {
      return res.status(404).json({ error: 'Trade show not found' });
    }
    res.json(show);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trade-shows/:id - Delete trade show
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await TradeShow.delete(parseInt(req.params.id), req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Trade show not found' });
    }
    res.json({ message: 'Trade show deleted' });
  } catch (err) {
    next(err);
  }
});

// ── Attendee routes ──

// GET /api/trade-shows/:id/attendees
router.get('/:id/attendees', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const attendees = await TradeShow.getAttendees(showId);
    res.json(attendees);
  } catch (err) {
    next(err);
  }
});

// POST /api/trade-shows/:id/attendees
router.post('/:id/attendees', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const { user_id, external_name } = req.body;
    if (!user_id && (!external_name || !external_name.trim())) {
      return res.status(400).json({ error: 'Either an internal user or external name is required' });
    }

    const attendee = await TradeShow.addAttendee(showId, req.tenantId, req.body);
    res.status(201).json(attendee);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trade-shows/:id/attendees/:attendeeId
router.put('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const { user_id, external_name } = req.body;
    if (!user_id && (!external_name || !external_name.trim())) {
      return res.status(400).json({ error: 'Either an internal user or external name is required' });
    }

    const attendee = await TradeShow.updateAttendee(
      parseInt(req.params.attendeeId),
      showId,
      req.body
    );

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json(attendee);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trade-shows/:id/attendees/:attendeeId
router.delete('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const deleted = await TradeShow.deleteAttendee(parseInt(req.params.attendeeId), showId);
    if (!deleted) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json({ message: 'Attendee removed' });
  } catch (err) {
    next(err);
  }
});

// ── Expense routes ──

router.get('/:id/expenses', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });
    const expenses = await TradeShow.getExpenses(showId);
    res.json(expenses);
  } catch (err) { next(err); }
});

router.post('/:id/expenses', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const amt = parseFloat(req.body.amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'Amount is required and must be a number' });

    const expense = await TradeShow.addExpense(showId, req.tenantId, req.body, req.user.id);
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

router.put('/:id/expenses/:expenseId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const amt = parseFloat(req.body.amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'Amount is required and must be a number' });

    const expense = await TradeShow.updateExpense(
      parseInt(req.params.expenseId), showId, req.body, req.user.id
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) { next(err); }
});

router.delete('/:id/expenses/:expenseId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const deleted = await TradeShow.deleteExpense(parseInt(req.params.expenseId), showId);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
});

// ── To-Do routes ──

router.get('/:id/todos', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });
    const todos = await TradeShow.getTodos(showId);
    res.json(todos);
  } catch (err) { next(err); }
});

router.post('/:id/todos', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const todo = await TradeShow.addTodo(showId, req.tenantId, req.body, req.user.id);

    // Fire an in-app + email notification to the assignee on creation.
    if (todo.assigned_to_user_id && todo.assigned_to_user_id !== req.user.id) {
      const show = await TradeShow.findByIdAndTenant(showId, req.tenantId);
      const dueParts = [todo.due_date, todo.due_time].filter(Boolean).join(' ');
      notify({
        tenantId: req.tenantId,
        projectId: null,
        entityType: 'trade_show_todo',
        entityId: todo.id,
        eventType: 'assigned',
        title: `Trade show task assigned: ${todo.title}`,
        message: `assigned you a task for ${show?.name || 'a trade show'}`,
        link: `/marketing/trade-shows/${showId}`,
        createdBy: req.user.id,
        emailSubject: `New trade show task: ${todo.title}`,
        emailDetails: [
          { label: 'Trade Show', value: show?.name || '' },
          { label: 'Task', value: todo.title },
          { label: 'Priority', value: todo.priority },
          ...(dueParts ? [{ label: 'Due', value: dueParts }] : []),
          ...(todo.description ? [{ label: 'Details', value: todo.description }] : []),
        ],
        targetUserId: todo.assigned_to_user_id,
        contextName: `Trade Show: ${show?.name || ''}`,
      });
    }

    res.status(201).json(todo);
  } catch (err) { next(err); }
});

router.put('/:id/todos/:todoId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const previous = await TradeShow.getTodoById(parseInt(req.params.todoId), showId);
    const todo = await TradeShow.updateTodo(
      parseInt(req.params.todoId), showId, req.body, req.user.id
    );
    if (!todo) return res.status(404).json({ error: 'Task not found' });

    // Notify on assignee change.
    const reassigned =
      todo.assigned_to_user_id &&
      todo.assigned_to_user_id !== req.user.id &&
      todo.assigned_to_user_id !== previous?.assigned_to_user_id;

    if (reassigned) {
      const show = await TradeShow.findByIdAndTenant(showId, req.tenantId);
      const dueParts = [todo.due_date, todo.due_time].filter(Boolean).join(' ');
      notify({
        tenantId: req.tenantId,
        projectId: null,
        entityType: 'trade_show_todo',
        entityId: todo.id,
        eventType: 'reassigned',
        title: `Trade show task assigned: ${todo.title}`,
        message: `reassigned a task to you for ${show?.name || 'a trade show'}`,
        link: `/marketing/trade-shows/${showId}`,
        createdBy: req.user.id,
        emailSubject: `Trade show task: ${todo.title}`,
        emailDetails: [
          { label: 'Trade Show', value: show?.name || '' },
          { label: 'Task', value: todo.title },
          { label: 'Priority', value: todo.priority },
          ...(dueParts ? [{ label: 'Due', value: dueParts }] : []),
        ],
        targetUserId: todo.assigned_to_user_id,
        contextName: `Trade Show: ${show?.name || ''}`,
      });
    }

    res.json(todo);
  } catch (err) { next(err); }
});

router.delete('/:id/todos/:todoId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const deleted = await TradeShow.deleteTodo(parseInt(req.params.todoId), showId);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
