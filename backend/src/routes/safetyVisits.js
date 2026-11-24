const express = require('express');
const SafetyVisit = require('../models/SafetyVisit');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();
router.use(authenticate);
router.use(tenantContext);

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.project_id;
    if (!projectId) return res.status(400).json({ error: 'project_id required' });
    const project = await Project.findByIdAndTenant(projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) { next(err); }
};

// GET /api/safety-visits/projects  — priority-sorted project list for the planner grid
router.get('/projects', async (req, res, next) => {
  try {
    const { teamId, departmentId, statuses } = req.query;
    const projects = await SafetyVisit.getProjectsWithPriority(req.tenantId, {
      teamId:       teamId       ? parseInt(teamId)       : undefined,
      departmentId: departmentId ? parseInt(departmentId) : undefined,
      statuses:     statuses     ? String(statuses).split(',') : undefined,
    });
    res.json(projects);
  } catch (err) { next(err); }
});

// GET /api/safety-visits  — tenant-wide visit feed for the 6-week window
router.get('/', async (req, res, next) => {
  try {
    const visits = await SafetyVisit.findByTenant(req.tenantId, {
      startDate:  req.query.start,
      endDate:    req.query.end,
      assignedTo: req.query.assigned_to ? parseInt(req.query.assigned_to) : undefined,
    });
    res.json(visits);
  } catch (err) { next(err); }
});

// GET /api/safety-visits/project/:projectId
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const visits = await SafetyVisit.findByProject(req.params.projectId, req.tenantId);
    res.json(visits);
  } catch (err) { next(err); }
});

// GET /api/safety-visits/:id
router.get('/:id', async (req, res, next) => {
  try {
    const visit = await SafetyVisit.findById(req.params.id);
    if (!visit || visit.tenant_id !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    res.json(visit);
  } catch (err) { next(err); }
});

// POST /api/safety-visits
router.post('/', verifyProjectOwnership, async (req, res, next) => {
  try {
    const { visit_type, status, scheduled_date, end_date, assigned_to, travel_hours_ow, travel_notes, is_out_of_state } = req.body;
    const visit = await SafetyVisit.create({
      tenantId:     req.tenantId,
      projectId:    req.project.id,
      visitType:    visit_type,
      status,
      scheduledDate: scheduled_date,
      endDate:      end_date,
      assignedTo:   assigned_to,
      travelHoursOw: travel_hours_ow,
      travelNotes:  travel_notes,
      isOutOfState: is_out_of_state,
      createdBy:    req.user.id,
    });
    res.status(201).json(visit);
  } catch (err) { next(err); }
});

// PUT /api/safety-visits/:id  — general update
router.put('/:id', async (req, res, next) => {
  try {
    const visit = await SafetyVisit.update(req.params.id, req.tenantId, req.body);
    if (!visit) return res.status(404).json({ error: 'Not found' });
    res.json(visit);
  } catch (err) { next(err); }
});

// PUT /api/safety-visits/:id/reschedule  — drag-drop date change
router.put('/:id/reschedule', async (req, res, next) => {
  try {
    const { scheduled_date, end_date } = req.body;
    if (!scheduled_date) return res.status(400).json({ error: 'scheduled_date required' });
    const visit = await SafetyVisit.reschedule(req.params.id, req.tenantId, scheduled_date, end_date ?? null);
    if (!visit) return res.status(404).json({ error: 'Not found' });
    res.json(visit);
  } catch (err) { next(err); }
});

// POST /api/safety-visits/:id/complete
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { completed_date, report_weather, report_temp, report_notes, report_sections } = req.body;
    const visit = await SafetyVisit.complete(req.params.id, req.tenantId, {
      completedDate:   completed_date,
      completedBy:     req.user.id,
      reportWeather:   report_weather,
      reportTemp:      report_temp,
      reportNotes:     report_notes,
      reportSections:  report_sections,
    });
    if (!visit) return res.status(404).json({ error: 'Not found' });
    res.json(visit);
  } catch (err) { next(err); }
});

// DELETE /api/safety-visits/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await SafetyVisit.findById(req.params.id);
    if (!existing || existing.tenant_id !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    await SafetyVisit.delete(req.params.id, req.tenantId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
