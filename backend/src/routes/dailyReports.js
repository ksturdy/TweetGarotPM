const express = require('express');
const { body, validationResult } = require('express-validator');
const DailyReport = require('../models/DailyReport');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get daily reports for a project
router.get('/project/:projectId', authenticate, async (req, res, next) => {
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
router.get('/project/:projectId/date/:date', authenticate, async (req, res, next) => {
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

// Get single daily report
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const report = await DailyReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Create daily report
router.post(
  '/',
  authenticate,
  [
    body('projectId').isInt(),
    body('reportDate').isDate(),
    body('workPerformed').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      // Check if report already exists for this date
      const existing = await DailyReport.findByDate(req.body.projectId, req.body.reportDate);
      if (existing) {
        return res.status(400).json({ error: 'A daily report already exists for this date' });
      }

      const report = await DailyReport.create({
        ...req.body,
        createdBy: req.user.id,
      });
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  }
);

// Update daily report
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const report = await DailyReport.update(req.params.id, req.body);
    if (!report) {
      return res.status(404).json({ error: 'Daily report not found' });
    }
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Delete daily report
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await DailyReport.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
