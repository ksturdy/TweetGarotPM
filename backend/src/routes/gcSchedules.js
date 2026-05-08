const express = require('express');
const multer = require('multer');
const router = express.Router();
const GCSchedule = require('../models/GCSchedule');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { parseGCSchedule } = require('../utils/gcScheduleImporter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx?|csv|xer|pdf|xml)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Invalid file type. Use .xlsx, .xls, .csv, .xer, .pdf, or .xml.'));
  },
});

router.use(authenticate);
router.use(tenantContext);

async function verifyProject(req, res) {
  const projectId = parseInt(req.params.projectId, 10);
  if (Number.isNaN(projectId)) {
    res.status(400).json({ message: 'Invalid project id.' });
    return null;
  }
  const project = await Project.findByIdAndTenant(projectId, req.tenantId);
  if (!project) {
    res.status(404).json({ message: 'Project not found.' });
    return null;
  }
  return projectId;
}

// Upload a new GC schedule version
router.post('/project/:projectId/upload', upload.single('file'), async (req, res) => {
  try {
    const projectId = await verifyProject(req, res);
    if (projectId === null) return;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const tradeRules = await GCSchedule.getTradeRules({ tenantId: req.tenantId });
    let parsed;
    try {
      parsed = await parseGCSchedule({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        tradeRules,
      });
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }

    const version = await GCSchedule.createVersion({
      tenantId: req.tenantId,
      projectId,
      versionLabel: req.body.versionLabel || null,
      scheduleDate: req.body.scheduleDate || null,
      sourceFilename: req.file.originalname,
      sourceFormat: parsed.format,
      notes: req.body.notes || null,
      uploadedBy: req.user && req.user.id,
    });

    try {
      await GCSchedule.bulkInsertActivities({
        versionId: version.id,
        activities: parsed.activities,
      });
      const finalized = await GCSchedule.finalizeVersion(version.id, {
        activityCount: parsed.activities.length,
        parseStatus: 'completed',
      });
      res.status(201).json({
        version: finalized,
        warnings: parsed.warnings,
      });
    } catch (insertErr) {
      await GCSchedule.finalizeVersion(version.id, {
        activityCount: 0,
        parseStatus: 'failed',
        parseError: insertErr.message,
      });
      throw insertErr;
    }
  } catch (err) {
    console.error('GC schedule upload error:', err);
    res.status(500).json({ message: err.message || 'Failed to import GC schedule.' });
  }
});

// List all versions for a project
router.get('/project/:projectId/versions', async (req, res) => {
  try {
    const projectId = await verifyProject(req, res);
    if (projectId === null) return;
    const versions = await GCSchedule.listVersions({ projectId, tenantId: req.tenantId });
    res.json(versions);
  } catch (err) {
    console.error('GC schedule list versions error:', err);
    res.status(500).json({ message: 'Failed to list schedule versions.' });
  }
});

// Activities for a specific version (with filters)
router.get('/versions/:versionId/activities', async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId, 10);
    const version = await GCSchedule.getVersion({ versionId, tenantId: req.tenantId });
    if (!version) return res.status(404).json({ message: 'Version not found.' });

    const activities = await GCSchedule.listActivities({
      versionId,
      filters: {
        mechanicalOnly: req.query.mechanical_only,
        trade: req.query.trade,
        search: req.query.search,
        startAfter: req.query.start_after,
        endBefore: req.query.end_before,
        hideSummary: req.query.hide_summary === 'true',
      },
    });
    res.json({ version, activities });
  } catch (err) {
    console.error('GC schedule list activities error:', err);
    res.status(500).json({ message: 'Failed to list activities.' });
  }
});

// Toggle mechanical override on a single activity
router.patch('/activities/:activityId/mechanical', async (req, res) => {
  try {
    const activityId = parseInt(req.params.activityId, 10);
    const updated = await GCSchedule.setMechanicalOverride({
      activityId,
      isMechanical: !!req.body.isMechanical,
    });
    if (!updated) return res.status(404).json({ message: 'Activity not found.' });
    res.json(updated);
  } catch (err) {
    console.error('GC schedule mechanical override error:', err);
    res.status(500).json({ message: 'Failed to update activity.' });
  }
});

// Bulk-set mechanical override on many activities at once
router.patch('/activities/bulk-mechanical', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map((n) => parseInt(n, 10)).filter(Number.isFinite) : [];
    if (!ids.length) return res.status(400).json({ message: 'No activity ids provided.' });
    const updated = await GCSchedule.bulkSetMechanical({
      activityIds: ids,
      isMechanical: !!req.body.isMechanical,
      tenantId: req.tenantId,
    });
    res.json({ updated });
  } catch (err) {
    console.error('GC schedule bulk mechanical error:', err);
    res.status(err.message?.includes('tenant') ? 403 : 500).json({ message: err.message || 'Failed to update activities.' });
  }
});

// Diff two versions
router.get('/project/:projectId/diff', async (req, res) => {
  try {
    const projectId = await verifyProject(req, res);
    if (projectId === null) return;
    const versionAId = parseInt(req.query.a, 10);
    const versionBId = parseInt(req.query.b, 10);
    if (!versionAId || !versionBId) {
      return res.status(400).json({ message: 'Provide ?a=<versionId>&b=<versionId>.' });
    }
    const [a, b] = await Promise.all([
      GCSchedule.getVersion({ versionId: versionAId, tenantId: req.tenantId }),
      GCSchedule.getVersion({ versionId: versionBId, tenantId: req.tenantId }),
    ]);
    if (!a || !b) return res.status(404).json({ message: 'One or both versions not found.' });
    if (a.project_id !== projectId || b.project_id !== projectId) {
      return res.status(400).json({ message: 'Versions are not in the requested project.' });
    }
    const diff = await GCSchedule.diffVersions({ versionAId, versionBId });
    res.json({ a, b, diff });
  } catch (err) {
    console.error('GC schedule diff error:', err);
    res.status(500).json({ message: 'Failed to diff versions.' });
  }
});

// Delete a version
router.delete('/versions/:versionId', async (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId, 10);
    const ok = await GCSchedule.deleteVersion({ versionId, tenantId: req.tenantId });
    if (!ok) return res.status(404).json({ message: 'Version not found.' });
    res.status(204).send();
  } catch (err) {
    console.error('GC schedule delete version error:', err);
    res.status(500).json({ message: 'Failed to delete version.' });
  }
});

module.exports = router;
