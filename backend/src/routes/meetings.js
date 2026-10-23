const express = require('express');
const { body, validationResult } = require('express-validator');
const Meeting = require('../models/Meeting');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId;
    if (!projectId) return res.status(400).json({ error: 'Project ID is required' });
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) { next(err); }
};

// ─── Series ──────────────────────────────────────────────────────────────────

router.get('/series/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const series = await Meeting.findSeriesByProject(req.params.projectId);
    res.json(series);
  } catch (err) { next(err); }
});

router.post('/series',
  [body('title').notEmpty(), body('projectId').notEmpty()],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const b = req.body;
      const series = await Meeting.createSeries({
        tenantId: req.tenantId,
        projectId: b.projectId,
        title: b.title,
        meetingType: b.meeting_type || b.meetingType,
        recurrenceType: b.recurrence_type || b.recurrenceType,
        dayOfWeek: b.day_of_week ?? b.dayOfWeek,
        startTime: b.start_time || b.startTime,
        endTime: b.end_time || b.endTime,
        location: b.location,
        description: b.description,
        createdBy: req.user.id,
        carryOverStatuses: b.carry_over_statuses || b.carryOverStatuses,
      });
      res.status(201).json(series);
    } catch (err) { next(err); }
  }
);

router.put('/series/:seriesId', async (req, res, next) => {
  try {
    const series = await Meeting.findSeriesById(req.params.seriesId);
    if (!series) return res.status(404).json({ error: 'Series not found' });
    const updated = await Meeting.updateSeries(req.params.seriesId, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/series/:seriesId', async (req, res, next) => {
  try {
    await Meeting.deleteSeries(req.params.seriesId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Meetings ─────────────────────────────────────────────────────────────────

router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = { status: req.query.status, seriesId: req.query.seriesId };
    const meetings = await Meeting.findByProject(req.params.projectId, filters);
    res.json(meetings);
  } catch (err) { next(err); }
});

router.get('/action-items/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const items = await Meeting.findActionItemsByProject(req.params.projectId);
    res.json(items);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const project = await Project.findByIdAndTenant(meeting.project_id, req.tenantId);
    if (!project) return res.status(403).json({ error: 'Access denied' });
    res.json(meeting);
  } catch (err) { next(err); }
});

router.post('/',
  [body('title').notEmpty(), body('projectId').notEmpty()],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const number = await Meeting.getNextNumber(req.body.projectId);
      const meeting = await Meeting.create({
        tenantId: req.tenantId,
        projectId: req.body.projectId,
        seriesId: req.body.seriesId,
        previousMeetingId: req.body.previousMeetingId,
        number,
        title: req.body.title,
        meetingType: req.body.meetingType,
        scheduledDate: req.body.scheduledDate,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        location: req.body.location,
        description: req.body.description,
        createdBy: req.user.id,
      });
      res.status(201).json(meeting);
    } catch (err) { next(err); }
  }
);

router.put('/:id', async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const updated = await Meeting.update(req.params.id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/publish', async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.status !== 'draft') return res.status(400).json({ error: 'Only draft meetings can be published' });
    const updated = await Meeting.publish(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/close', async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.status === 'closed') return res.status(400).json({ error: 'Meeting is already closed' });
    const updated = await Meeting.close(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/schedule-next', async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!meeting.series_id) return res.status(400).json({ error: 'Meeting is not part of a series' });
    const next = await Meeting.scheduleNext(req.params.id, req.tenantId, req.user.id);
    res.status(201).json(next);
  } catch (err) { next(err); }
});

router.post('/:id/schedule-followup', async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    const followup = await Meeting.scheduleFollowup(req.params.id, req.tenantId, req.user.id);
    res.status(201).json(followup);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Meeting.delete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Attendees ────────────────────────────────────────────────────────────────

router.post('/:id/attendees', async (req, res, next) => {
  try {
    const attendee = await Meeting.addAttendee(req.params.id, req.body);
    res.status(201).json(attendee);
  } catch (err) { next(err); }
});

router.put('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    const attendee = await Meeting.updateAttendee(req.params.attendeeId, req.body);
    res.json(attendee);
  } catch (err) { next(err); }
});

router.delete('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    await Meeting.removeAttendee(req.params.attendeeId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Agenda Items ─────────────────────────────────────────────────────────────

router.post('/:id/agenda-items', async (req, res, next) => {
  try {
    const item = await Meeting.addAgendaItem(req.params.id, req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id/agenda-items/reorder', async (req, res, next) => {
  try {
    await Meeting.reorderAgendaItems(req.params.id, req.body.orderedIds);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/:id/agenda-items/:itemId', async (req, res, next) => {
  try {
    const item = await Meeting.updateAgendaItem(req.params.itemId, req.body);
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/:id/agenda-items/:itemId', async (req, res, next) => {
  try {
    await Meeting.deleteAgendaItem(req.params.itemId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Action Items ─────────────────────────────────────────────────────────────

router.post('/:id/action-items', async (req, res, next) => {
  try {
    const item = await Meeting.addActionItem(req.params.id, req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.put('/:id/action-items/reorder', async (req, res, next) => {
  try {
    await Meeting.reorderActionItems(req.params.id, req.body.orderedIds);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/:id/action-items/:itemId', async (req, res, next) => {
  try {
    const item = await Meeting.updateActionItem(req.params.itemId, req.body);
    res.json(item);
  } catch (err) { next(err); }
});

router.delete('/:id/action-items/:itemId', async (req, res, next) => {
  try {
    await Meeting.deleteActionItem(req.params.itemId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
