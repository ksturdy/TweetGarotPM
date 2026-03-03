const express = require('express');
const { body, validationResult } = require('express-validator');
const DailyReport = require('../models/DailyReport');
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

// Get daily reports for a project
router.get('/project/:projectId', verifyProjectOwnership, async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    const reports = await DailyReport.findByProject(req.params.projectId, filters);
    res.json(reports);
  } catch (error) {
    next(error);
  }
});

// Get report by date
router.get('/project/:projectId/date/:date', verifyProjectOwnership, async (req, res, next) => {
  try {
    const report = await DailyReport.findByDate(req.params.projectId, req.params.date);
    if (!report) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Get single daily report with crews
router.get('/:id', async (req, res, next) => {
  try {
    const report = await DailyReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    // Verify the report's project belongs to tenant
    const project = await Project.findByIdAndTenant(report.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const crews = await DailyReport.getCrews(req.params.id);
    res.json({ ...report, crews });
  } catch (error) {
    next(error);
  }
});

// Create daily report
router.post(
  '/',
  [
    body('project_id').isInt(),
    body('report_date').isDate(),
    body('work_performed').trim().notEmpty(),
  ],
  validate,
  verifyProjectOwnership,
  async (req, res, next) => {
    try {
      const projectId = req.body.project_id || req.body.projectId;
      const reportDate = req.body.report_date || req.body.reportDate;

      // Check if report already exists for this date
      const existing = await DailyReport.findByDate(projectId, reportDate);
      if (existing) {
        return res.status(400).json({ error: 'A daily report already exists for this date' });
      }

      const report = await DailyReport.create({
        projectId,
        reportDate,
        weather: req.body.weather,
        temperature: req.body.temperature,
        workPerformed: req.body.work_performed,
        materials: req.body.materials,
        equipment: req.body.equipment,
        visitors: req.body.visitors,
        issues: req.body.issues,
        delayHours: req.body.delay_hours,
        delayReason: req.body.delay_reason,
        safetyIncidents: req.body.safety_incidents,
        safetyNotes: req.body.safety_notes,
        createdBy: req.user.id,
      });
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  }
);

// Update daily report
router.put('/:id', async (req, res, next) => {
  try {
    // First get the report to verify ownership
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    // Verify the report's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }

    const report = await DailyReport.update(req.params.id, req.body);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Delete daily report
router.delete('/:id', async (req, res, next) => {
  try {
    // First get the report to verify ownership
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    // Verify the report's project belongs to tenant
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }

    await DailyReport.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Submit daily report
router.post('/:id/submit', async (req, res, next) => {
  try {
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const report = await DailyReport.submit(req.params.id, { submittedBy: req.user.id });
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Approve daily report
router.post('/:id/approve', async (req, res, next) => {
  try {
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const report = await DailyReport.approve(req.params.id, { approvedBy: req.user.id });
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Add crew entry
router.post('/:id/crews', async (req, res, next) => {
  try {
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const crew = await DailyReport.addCrew(req.params.id, {
      trade: req.body.trade,
      foreman: req.body.foreman,
      crewSize: req.body.crew_size,
      hoursWorked: req.body.hours_worked,
      workDescription: req.body.work_description,
    });
    res.status(201).json(crew);
  } catch (error) {
    next(error);
  }
});

// Update crew entry
router.put('/:id/crews/:crewId', async (req, res, next) => {
  try {
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const crew = await DailyReport.updateCrew(req.params.crewId, req.body);
    res.json(crew);
  } catch (error) {
    next(error);
  }
});

// Delete crew entry
router.delete('/:id/crews/:crewId', async (req, res, next) => {
  try {
    const existingReport = await DailyReport.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    const project = await Project.findByIdAndTenant(existingReport.project_id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    await DailyReport.deleteCrew(req.params.crewId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
