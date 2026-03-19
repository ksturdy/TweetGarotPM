const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const Tenant = require('../models/Tenant');
const VistaData = require('../models/VistaData');
const opportunities = require('../models/opportunities');
const { buildBacklogFitReport, generateStrategyRecommendations, pursuitRules: defaultPursuitRules, workDurationRules: defaultWorkDurationRules } = require('../utils/backlogFitCalculator');
const { generateBacklogReportPdfBuffer } = require('../utils/backlogReportPdfBuffer');

router.use(authenticate);
router.use(tenantContext);

/**
 * Shared: fetch all source data and run calculations for the report
 */
async function buildReportData(tenantId) {
  const [contracts, allOpps, tenant] = await Promise.all([
    VistaData.getAllContracts({ status: '' }, tenantId),
    opportunities.findAll({}, tenantId),
    Tenant.findById(tenantId),
  ]);

  const saved = tenant?.settings?.backlogFitSettings || {};
  const forecast = tenant?.settings?.forecastRules || {};
  const settings = {
    capacityTarget: saved.capacityTarget || 5000000,
    horizonMonths: saved.horizonMonths || 12,
    comparisonMode: saved.comparisonMode || 'revenue',
    laborCapacityTarget: saved.laborCapacityTarget || 150,
    laborPctOfValue: saved.laborPctOfValue || 60,
    avgLaborRate: saved.avgLaborRate || 85,
    hoursPerPersonPerMonth: saved.hoursPerPersonPerMonth || 173,
    regionTargets: saved.regionTargets || null,
    pursuitRules: forecast.pursuitRules || defaultPursuitRules,
    workDurationRules: forecast.workDurationRules || defaultWorkDurationRules,
  };

  const reportData = buildBacklogFitReport(contracts, allOpps, settings);
  const recommendations = generateStrategyRecommendations(reportData.variants, settings, reportData.regional12);

  return { reportData, recommendations };
}

/**
 * GET /api/backlog-report/pdf-download
 * Download the Backlog Fit Analysis Report as a PDF
 */
router.get('/pdf-download', async (req, res) => {
  try {
    const { reportData, recommendations } = await buildReportData(req.tenantId);
    const generatedBy = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
    const pdfBuffer = await generateBacklogReportPdfBuffer(reportData, recommendations, generatedBy);

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Backlog-Fit-Report-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating backlog fit report PDF:', error);
    res.status(500).json({ error: 'Failed to generate backlog fit report PDF' });
  }
});

/**
 * GET /api/backlog-report/email-draft
 * Download a .eml file with PDF attached (opens in Outlook as unsent draft)
 */
router.get('/email-draft', async (req, res) => {
  try {
    const { reportData, recommendations } = await buildReportData(req.tenantId);
    const generatedBy = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
    const pdfBuffer = await generateBacklogReportPdfBuffer(reportData, recommendations, generatedBy);

    const dateStr = new Date().toISOString().split('T')[0];
    const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const pdfFilename = `Backlog-Fit-Report-${dateStr}.pdf`;

    const emailBody = `Please find attached the Backlog Fit Analysis Report as of ${dateLabel}.

This report analyzes capacity gaps across four scenarios (All States 12/18 months, Wisconsin 12/18 months) in both revenue and labor modes, and includes strategic opportunity targeting recommendations.

Best regards,
${generatedBy}`.trim();

    const boundary = '----=_NextPart_' + Date.now().toString(16);
    const base64Pdf = pdfBuffer.toString('base64');
    const base64Lines = base64Pdf.match(/.{1,76}/g) || [];

    const emlContent = [
      'MIME-Version: 1.0',
      'To: ',
      `Subject: Backlog Fit Analysis Report - ${dateLabel}`,
      'X-Unsent: 1',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      'This is a multi-part message in MIME format.',
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="utf-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      emailBody,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      '',
      ...base64Lines,
      `--${boundary}--`,
    ].join('\r\n');

    res.setHeader('Content-Type', 'message/rfc822');
    res.setHeader('Content-Disposition', `attachment; filename="Backlog-Fit-Report-${dateStr}.eml"`);
    res.send(emlContent);
  } catch (error) {
    console.error('Error generating backlog fit report email:', error);
    res.status(500).json({ error: 'Failed to generate backlog fit report email draft' });
  }
});

module.exports = router;
