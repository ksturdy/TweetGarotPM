const express = require('express');
const router = express.Router();
const TradeShow = require('../models/TradeShow');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

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

module.exports = router;
