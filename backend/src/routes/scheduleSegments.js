const express = require('express');
const ProjectScheduleSegment = require('../models/ProjectScheduleSegment');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { getProjectEffectiveDates } = require('../utils/projectDates');

const router = express.Router();

const verifyProject = async (req, res, next) => {
  try {
    const project = await Project.findByIdAndTenant(req.params.projectId, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

// GET /schedule-segments/bulk?project_ids=1,2,3
router.get('/schedule-segments/bulk', authenticate, tenantContext, async (req, res, next) => {
  try {
    const ids = (req.query.project_ids || '').split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length === 0) return res.json({});
    const result = await ProjectScheduleSegment.getBulkByProjects(ids, req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /projects/:projectId/schedule-segments
router.get('/projects/:projectId/schedule-segments', authenticate, tenantContext, verifyProject, async (req, res, next) => {
  try {
    const segments = await ProjectScheduleSegment.getByProject(req.params.projectId, req.tenantId);
    const activeKeys = await ProjectScheduleSegment.getActiveSegmentKeys(req.params.projectId, req.tenantId);
    res.json({ segments, activeKeys });
  } catch (err) {
    next(err);
  }
});

// GET /projects/:projectId/schedule-segments/costs
router.get('/projects/:projectId/schedule-segments/costs', authenticate, tenantContext, verifyProject, async (req, res, next) => {
  try {
    const costs = await ProjectScheduleSegment.getCostsByProject(req.params.projectId, req.tenantId);
    res.json(costs);
  } catch (err) {
    next(err);
  }
});

// PUT /projects/:projectId/schedule-segments/:segmentKey
router.put('/projects/:projectId/schedule-segments/:segmentKey', authenticate, tenantContext, verifyProject, async (req, res, next) => {
  try {
    const { segmentKey } = req.params;
    const { start_date, end_date, contour_type, weekly_hours } = req.body;

    const def = ProjectScheduleSegment.SEGMENT_DEFINITIONS.find((s) => s.key === segmentKey);
    if (!def) return res.status(400).json({ error: 'Unknown segment key' });

    // If only weekly_hours is provided (shift schedule update), do a targeted update
    // that never touches start_date / end_date / contour_type.
    if (weekly_hours != null && start_date === undefined && end_date === undefined && contour_type === undefined) {
      await ProjectScheduleSegment.patchWeeklyHours(req.params.projectId, req.tenantId, segmentKey, Number(weekly_hours));
      return res.json({ segment_key: segmentKey, weekly_hours: Number(weekly_hours) });
    }

    const segment = await ProjectScheduleSegment.upsertSegment(
      req.params.projectId,
      req.tenantId,
      segmentKey,
      def.label,
      start_date || null,
      end_date || null,
      contour_type || null,
      weekly_hours != null ? Number(weekly_hours) : null
    );
    res.json(segment);
  } catch (err) {
    next(err);
  }
});

// POST /projects/:projectId/schedule-segments/initialize
// Idempotent — creates all 13 segment rows from current project effective dates.
// Only fills rows that don't exist yet (ON CONFLICT DO NOTHING in the model).
router.post('/projects/:projectId/schedule-segments/initialize', authenticate, tenantContext, verifyProject, async (req, res, next) => {
  try {
    const dates = await getProjectEffectiveDates(req.params.projectId, req.tenantId);
    const segments = await ProjectScheduleSegment.initializeSegments(
      req.params.projectId,
      req.tenantId,
      dates.start_date,
      dates.end_date
    );
    res.json(segments);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
