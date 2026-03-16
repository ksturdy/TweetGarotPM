const express = require('express');
const { authenticate } = require('../middleware/auth');
const { tenantContext, requireFeature } = require('../middleware/tenant');
const TraceoverRun = require('../models/TraceoverRun');
const TraceoverMeasurement = require('../models/TraceoverMeasurement');
const Takeoff = require('../models/Takeoff');

const router = express.Router({ mergeParams: true }); // mergeParams to access :takeoffId

router.use(authenticate);
router.use(tenantContext);
router.use(requireFeature('estimates'));

// Helper: verify takeoff belongs to tenant
async function verifyTakeoff(req, res) {
  const takeoff = await Takeoff.findByIdAndTenant(req.params.takeoffId, req.tenantId);
  if (!takeoff) {
    res.status(404).json({ error: 'Takeoff not found' });
    return null;
  }
  return takeoff;
}

// ─── List runs for a takeoff ───
router.get('/', async (req, res, next) => {
  try {
    if (!await verifyTakeoff(req, res)) return;

    const { document_id, page_number } = req.query;
    let runs;

    if (document_id && page_number !== undefined) {
      runs = await TraceoverRun.findByDocumentPage(parseInt(document_id), parseInt(page_number));
    } else {
      runs = await TraceoverRun.findByTakeoff(req.params.takeoffId);
    }

    res.json(runs);
  } catch (error) {
    next(error);
  }
});

// ─── Get run by ID ───
router.get('/summary', async (req, res, next) => {
  try {
    if (!await verifyTakeoff(req, res)) return;
    const summary = await TraceoverRun.getSummary(req.params.takeoffId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// ─── Get run by ID ───
router.get('/:runId', async (req, res, next) => {
  try {
    const run = await TraceoverRun.findById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  } catch (error) {
    next(error);
  }
});

// ─── Create a new run ───
router.post('/', async (req, res, next) => {
  try {
    if (!await verifyTakeoff(req, res)) return;

    const run = await TraceoverRun.create({
      tenant_id: req.tenantId,
      takeoff_id: parseInt(req.params.takeoffId),
      ...req.body,
    });

    res.status(201).json(run);
  } catch (error) {
    next(error);
  }
});

// ─── Update a run ───
router.put('/:runId', async (req, res, next) => {
  try {
    const run = await TraceoverRun.findById(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const updated = await TraceoverRun.update(req.params.runId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ─── Delete a run ───
router.delete('/:runId', async (req, res, next) => {
  try {
    const deleted = await TraceoverRun.delete(req.params.runId);
    if (!deleted) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json({ message: 'Run deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Measurements (scoped under takeoff for convenience) ───

router.get('/documents/:docId/measurements', async (req, res, next) => {
  try {
    const { page_number } = req.query;
    let measurements;

    if (page_number !== undefined) {
      measurements = await TraceoverMeasurement.findByDocumentPage(parseInt(req.params.docId), parseInt(page_number));
    } else {
      measurements = await TraceoverMeasurement.findByDocument(parseInt(req.params.docId));
    }

    res.json(measurements);
  } catch (error) {
    next(error);
  }
});

router.post('/documents/:docId/measurements', async (req, res, next) => {
  try {
    const measurement = await TraceoverMeasurement.create({
      document_id: parseInt(req.params.docId),
      ...req.body,
    });
    res.status(201).json(measurement);
  } catch (error) {
    next(error);
  }
});

router.put('/documents/:docId/measurements/:measId', async (req, res, next) => {
  try {
    const updated = await TraceoverMeasurement.update(req.params.measId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Measurement not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/documents/:docId/measurements/:measId', async (req, res, next) => {
  try {
    const deleted = await TraceoverMeasurement.delete(req.params.measId);
    if (!deleted) {
      return res.status(404).json({ error: 'Measurement not found' });
    }
    res.json({ message: 'Measurement deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
