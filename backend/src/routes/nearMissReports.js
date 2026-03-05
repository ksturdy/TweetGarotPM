const express = require('express');
const { body, validationResult } = require('express-validator');
const NearMissReport = require('../models/NearMissReport');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

const router = express.Router();

router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const verifyProjectOwnership = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.body.projectId || req.body.project_id;
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

// Get reports for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      report_type: req.query.report_type,
    };
    const reports = await NearMissReport.findByProject(req.params.projectId, filters);
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// Get single report
router.get('/:id', async (req, res, next) => {
  try {
    const report = await NearMissReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const project = await Project.findByIdAndTenant(report.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Create report
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('description').trim().notEmpty(),
    body('date_of_incident').isDate(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const number = await NearMissReport.getNextNumber(projectId);
      const report = await NearMissReport.create({
        projectId,
        tenantId: req.tenantId,
        number,
        reportType: req.body.report_type || 'near_miss',
        dateOfIncident: req.body.date_of_incident,
        locationOnSite: req.body.location_on_site,
        description: req.body.description,
        correctiveAction: req.body.corrective_action,
        dateCorrected: req.body.date_corrected,
        reportedBy: req.body.reported_by,
        notes: req.body.notes,
        createdBy: req.user.id,
      });
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  }
);

// Update report
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await NearMissReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const report = await NearMissReport.update(req.params.id, req.body);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Submit report
router.post('/:id/submit', async (req, res, next) => {
  try {
    const existing = await NearMissReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const report = await NearMissReport.submit(req.params.id);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Delete (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await NearMissReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const project = await Project.findByIdAndTenant(existing.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (existing.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft reports can be deleted' });
    }
    await NearMissReport.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
