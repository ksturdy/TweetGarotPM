const express = require('express');
const router = express.Router();
const ScheduledReport = require('../models/ScheduledReport');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/scheduled-reports
 * List all scheduled reports for the tenant
 */
router.get('/', async (req, res) => {
  try {
    const reports = await ScheduledReport.findAllByTenant(req.tenantId);
    res.json(reports);
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
});

/**
 * GET /api/scheduled-reports/:id
 * Get a single scheduled report with recipients
 */
router.get('/:id', async (req, res) => {
  try {
    const report = await ScheduledReport.findById(parseInt(req.params.id), req.tenantId);
    if (!report) return res.status(404).json({ error: 'Scheduled report not found' });
    res.json(report);
  } catch (error) {
    console.error('Error fetching scheduled report:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled report' });
  }
});

/**
 * POST /api/scheduled-reports
 * Create a new scheduled report
 */
router.post('/', async (req, res) => {
  try {
    const { name, report_type, frequency, day_of_week, day_of_month,
      time_of_day, timezone, filters, is_enabled,
      recipient_user_ids, recipient_team_ids } = req.body;

    if (!name || !report_type || !frequency) {
      return res.status(400).json({ error: 'name, report_type, and frequency are required' });
    }

    if (frequency === 'weekly' && (day_of_week === undefined || day_of_week === null)) {
      return res.status(400).json({ error: 'day_of_week is required for weekly frequency' });
    }

    if (frequency === 'monthly' && (day_of_month === undefined || day_of_month === null)) {
      return res.status(400).json({ error: 'day_of_month is required for monthly frequency' });
    }

    const hasUserRecipients = recipient_user_ids && recipient_user_ids.length > 0;
    const hasTeamRecipients = recipient_team_ids && recipient_team_ids.length > 0;
    if (!hasUserRecipients && !hasTeamRecipients) {
      return res.status(400).json({ error: 'At least one recipient or team is required' });
    }

    const report = await ScheduledReport.create({
      name, report_type, frequency, day_of_week, day_of_month,
      time_of_day, timezone, filters, is_enabled,
      created_by: req.user.id, recipient_user_ids, recipient_team_ids,
    }, req.tenantId);

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    res.status(500).json({ error: `Failed to create scheduled report: ${error.message}` });
  }
});

/**
 * PUT /api/scheduled-reports/:id
 * Update a scheduled report
 */
router.put('/:id', async (req, res) => {
  try {
    const report = await ScheduledReport.update(parseInt(req.params.id), req.body, req.tenantId);
    if (!report) return res.status(404).json({ error: 'Scheduled report not found' });
    res.json(report);
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    res.status(500).json({ error: 'Failed to update scheduled report' });
  }
});

/**
 * DELETE /api/scheduled-reports/:id
 * Delete a scheduled report
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ScheduledReport.delete(parseInt(req.params.id), req.tenantId);
    if (!deleted) return res.status(404).json({ error: 'Scheduled report not found' });
    res.json({ message: 'Scheduled report deleted' });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    res.status(500).json({ error: 'Failed to delete scheduled report' });
  }
});

/**
 * POST /api/scheduled-reports/:id/send-now
 * Manually trigger a one-off send for testing
 */
router.post('/:id/send-now', async (req, res) => {
  try {
    const report = await ScheduledReport.findById(parseInt(req.params.id), req.tenantId);
    if (!report) return res.status(404).json({ error: 'Scheduled report not found' });

    // Lazy-load the runner to avoid circular dependencies at startup
    const { executeScheduledReport } = require('../jobs/scheduledReportRunner');
    const result = await executeScheduledReport(report);

    res.json({ message: 'Report sent successfully', result });
  } catch (error) {
    console.error('Error sending scheduled report:', error);
    res.status(500).json({ error: `Failed to send report: ${error.message}` });
  }
});

module.exports = router;
