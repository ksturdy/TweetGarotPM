const express = require('express');
const router = express.Router();
const Drawing = require('../models/Drawing');
const Project = require('../models/Project');
const FieldIssue = require('../models/FieldIssue');
const DrawingMarkupLayer = require('../models/DrawingMarkupLayer');
const DrawingMarkup = require('../models/DrawingMarkup');
const DrawingIssuePin = require('../models/DrawingIssuePin');
const DrawingSubmittalTag = require('../models/DrawingSubmittalTag');
const DrawingScaleCalibration = require('../models/DrawingScaleCalibration');
const DrawingMeasurement = require('../models/DrawingMeasurement');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { notify } = require('../utils/notificationService');

router.use(authenticate);
router.use(tenantContext);

// Verify drawing belongs to tenant
const verifyDrawing = async (req, res, next) => {
  try {
    const drawing = await Drawing.findById(req.params.id);
    if (!drawing) return res.status(404).json({ error: 'Drawing not found' });
    const project = await Project.findByIdAndTenant(drawing.project_id, req.tenantId);
    if (!project) return res.status(404).json({ error: 'Drawing not found' });
    req.drawing = drawing;
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
};

// ── Combined page load ─────────────────────────────────────────────────────

router.get('/:id/pages/:pageNumber/markup-data', verifyDrawing, async (req, res, next) => {
  try {
    const { id, pageNumber } = req.params;
    const pg = parseInt(pageNumber, 10);
    const userId = req.user.id;

    const [layers, markups, issuePins, submittalTags, measurements, scaleCalibration] =
      await Promise.all([
        DrawingMarkupLayer.findByDrawingPage(id, pg, userId),
        DrawingMarkup.findByDrawingPage(id, pg, userId),
        DrawingIssuePin.findByDrawingPage(id, pg),
        DrawingSubmittalTag.findByDrawingPage(id, pg),
        DrawingMeasurement.findByDrawingPage(id, pg),
        DrawingScaleCalibration.findByDrawingPage(id, pg),
      ]);

    res.json({ layers, markups, issuePins, submittalTags, measurements, scaleCalibration });
  } catch (err) {
    next(err);
  }
});

// ── Markup layers ──────────────────────────────────────────────────────────

router.post('/:id/pages/:pageNumber/layers', verifyDrawing, async (req, res, next) => {
  try {
    const layer = await DrawingMarkupLayer.create({
      tenantId: req.tenantId,
      drawingId: req.params.id,
      pageNumber: parseInt(req.params.pageNumber, 10),
      name: req.body.name,
      color: req.body.color,
      isPersonal: req.body.is_personal,
      createdBy: req.user.id,
    });
    res.status(201).json(layer);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/layers/:layerId', verifyDrawing, async (req, res, next) => {
  try {
    const layer = await DrawingMarkupLayer.update(req.params.layerId, req.tenantId, req.body);
    if (!layer) return res.status(404).json({ error: 'Layer not found' });
    res.json(layer);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/layers/:layerId', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingMarkupLayer.delete(req.params.layerId, req.tenantId, req.user.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── Markups ────────────────────────────────────────────────────────────────

router.post('/:id/pages/:pageNumber/markups', verifyDrawing, async (req, res, next) => {
  try {
    const markup = await DrawingMarkup.create({
      tenantId: req.tenantId,
      layerId: req.body.layer_id,
      drawingId: req.params.id,
      pageNumber: parseInt(req.params.pageNumber, 10),
      toolType: req.body.tool_type,
      geometry: req.body.geometry,
      style: req.body.style,
      createdBy: req.user.id,
    });
    res.status(201).json(markup);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/markups/:markupId', verifyDrawing, async (req, res, next) => {
  try {
    const markup = await DrawingMarkup.update(req.params.markupId, req.tenantId, req.body);
    if (!markup) return res.status(404).json({ error: 'Markup not found' });
    res.json(markup);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/markups/:markupId', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingMarkup.delete(req.params.markupId, req.tenantId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pages/:pageNumber/markups/bulk-delete', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingMarkup.bulkDelete(req.body.ids, req.tenantId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── Issue pins ─────────────────────────────────────────────────────────────

router.post('/:id/pages/:pageNumber/issue-pins', verifyDrawing, async (req, res, next) => {
  try {
    const drawingId = req.params.id;
    const pageNumber = parseInt(req.params.pageNumber, 10);
    let fieldIssueId = req.body.field_issue_id || null;
    let newIssue = null;

    // If no issue linked, create one inline
    if (!fieldIssueId && req.body.create_issue) {
      const number = await FieldIssue.getNextNumber(req.drawing.project_id);
      newIssue = await FieldIssue.create({
        projectId: req.drawing.project_id,
        tenantId: req.tenantId,
        number,
        title: req.body.issue_title || `Drawing Issue #${number}`,
        description: req.body.issue_description || '',
        priority: req.body.issue_priority || 'normal',
        trade: req.body.issue_trade || null,
        location: req.body.issue_location || null,
        notes: null,
        createdBy: req.user.id,
      });
      fieldIssueId = newIssue.id;

      notify({
        tenantId: req.tenantId,
        projectId: req.drawing.project_id,
        entityType: 'field_issue',
        entityId: newIssue.id,
        eventType: 'created',
        title: `New Issue #${number}: ${newIssue.title}`,
        message: `created drawing issue #${number}: ${newIssue.title}`,
        link: `/projects/${req.drawing.project_id}/field-issues/${newIssue.id}`,
        createdBy: req.user.id,
      });
    }

    const pinNumber = await DrawingIssuePin.getNextPinNumber(drawingId, pageNumber);
    const pin = await DrawingIssuePin.create({
      tenantId: req.tenantId,
      drawingId,
      pageNumber,
      x: req.body.x,
      y: req.body.y,
      pinNumber,
      fieldIssueId,
      createdBy: req.user.id,
    });

    res.status(201).json({ pin, issue: newIssue });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/issue-pins/:pinId', verifyDrawing, async (req, res, next) => {
  try {
    const pin = await DrawingIssuePin.update(req.params.pinId, req.tenantId, req.body);
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    res.json(pin);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/issue-pins/:pinId', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingIssuePin.delete(req.params.pinId, req.tenantId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── Submittal tags ─────────────────────────────────────────────────────────

router.post('/:id/pages/:pageNumber/submittal-tags', verifyDrawing, async (req, res, next) => {
  try {
    const tag = await DrawingSubmittalTag.create({
      tenantId: req.tenantId,
      drawingId: req.params.id,
      pageNumber: parseInt(req.params.pageNumber, 10),
      x: req.body.x,
      y: req.body.y,
      width: req.body.width,
      height: req.body.height,
      submittalId: req.body.submittal_id || null,
      createdBy: req.user.id,
    });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/submittal-tags/:tagId', verifyDrawing, async (req, res, next) => {
  try {
    const tag = await DrawingSubmittalTag.update(req.params.tagId, req.tenantId, req.body);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/submittal-tags/:tagId', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingSubmittalTag.delete(req.params.tagId, req.tenantId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── Scale calibration ──────────────────────────────────────────────────────

router.put('/:id/pages/:pageNumber/scale-calibration', verifyDrawing, async (req, res, next) => {
  try {
    const cal = await DrawingScaleCalibration.upsert({
      tenantId: req.tenantId,
      drawingId: req.params.id,
      pageNumber: parseInt(req.params.pageNumber, 10),
      x1: req.body.x1,
      y1: req.body.y1,
      x2: req.body.x2,
      y2: req.body.y2,
      realWorldValue: req.body.real_world_value,
      realWorldUnit: req.body.real_world_unit,
      createdBy: req.user.id,
    });
    res.json(cal);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/pages/:pageNumber/scale-calibration', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingScaleCalibration.delete(
      req.params.id,
      parseInt(req.params.pageNumber, 10),
      req.tenantId
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── Measurements ───────────────────────────────────────────────────────────

router.post('/:id/pages/:pageNumber/measurements', verifyDrawing, async (req, res, next) => {
  try {
    const m = await DrawingMeasurement.create({
      tenantId: req.tenantId,
      drawingId: req.params.id,
      pageNumber: parseInt(req.params.pageNumber, 10),
      measureType: req.body.measure_type,
      points: req.body.points,
      computedValue: req.body.computed_value,
      unit: req.body.unit,
      label: req.body.label,
      createdBy: req.user.id,
    });
    res.status(201).json(m);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/measurements/:measureId', verifyDrawing, async (req, res, next) => {
  try {
    const m = await DrawingMeasurement.update(req.params.measureId, req.tenantId, req.body);
    if (!m) return res.status(404).json({ error: 'Measurement not found' });
    res.json(m);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/measurements/:measureId', verifyDrawing, async (req, res, next) => {
  try {
    await DrawingMeasurement.delete(req.params.measureId, req.tenantId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
