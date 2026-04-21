const ScheduledReport = require('../models/ScheduledReport');
const { sendEmail } = require('../utils/emailService');

// Report type → data + PDF generation mapping
const REPORT_HANDLERS = {
  async executive_report(report) {
    const { buildReportData } = require('../routes/executiveReport');
    const { generateExecutiveReportPdfBuffer } = require('../utils/executiveReportPdfBuffer');

    const snapshotDate = report.filters?.snapshotDate || null;
    const reportData = await buildReportData(report.tenant_id, snapshotDate);
    const pdfBuffer = await generateExecutiveReportPdfBuffer(reportData);
    const dateStr = reportData.reportDate || new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Executive-Report-${dateStr}.pdf`,
      subject: `Executive Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Executive Report.\n\nThis report includes Top 10 rankings across key financial categories including contract value, gross profit, margin performance, cash flow, backlog, and more.`,
    };
  },

  async backlog_fit(report) {
    const { buildReportData } = require('../routes/backlogReport');
    const { generateBacklogReportPdfBuffer } = require('../utils/backlogReportPdfBuffer');

    const { reportData, recommendations } = await buildReportData(report.tenant_id);
    const pdfBuffer = await generateBacklogReportPdfBuffer(reportData, recommendations, 'Automated Report');
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Backlog-Fit-Report-${dateStr}.pdf`,
      subject: `Backlog Fit Analysis Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Backlog Fit Analysis Report.\n\nThis report analyzes capacity gaps across four scenarios (All States 12/18 months, Wisconsin 12/18 months) in both revenue and labor modes, and includes strategic opportunity targeting recommendations.`,
    };
  },

  async buyout_metric(report) {
    const { buildBuyoutMetricData } = require('../routes/buyoutMetricReport');
    const { generateBuyoutMetricReportPdfBuffer } = require('../utils/buyoutMetricReportPdfBuffer');

    const filters = report.filters || {};
    // Resolve team name for display on cover page
    if (filters.team) {
      const Team = require('../models/Team');
      const team = await Team.getByIdAndTenant(Number(filters.team), report.tenant_id);
      if (team) filters.teamName = team.name;
    }
    const rows = await buildBuyoutMetricData(report.tenant_id, filters);
    // Sort by most buyout remaining first (descending)
    rows.sort((a, b) => (b.buyout_remaining || 0) - (a.buyout_remaining || 0));
    const pdfBuffer = await generateBuyoutMetricReportPdfBuffer(rows, filters);
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Buyout-Metric-Report-${dateStr}.pdf`,
      subject: `Buyout Metric Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Buyout Metric Report covering ${rows.length} project${rows.length !== 1 ? 's' : ''}.`,
    };
  },

  async cash_flow(report) {
    const { buildCashFlowData, buildCashFlowMetrics } = require('../routes/cashFlowReport');
    const { generateCashFlowReportPdfBuffer } = require('../utils/cashFlowReportPdfBuffer');

    const filters = report.filters || {};
    // Resolve team name for display on cover page
    if (filters.team) {
      const Team = require('../models/Team');
      const team = await Team.getByIdAndTenant(Number(filters.team), report.tenant_id);
      if (team) filters.teamName = team.name;
    }
    const rows = await buildCashFlowData(report.tenant_id, filters);
    const metrics = await buildCashFlowMetrics(report.tenant_id);
    // Sort by worst cash flow first (ascending)
    rows.sort((a, b) => (Number(a.cash_flow) || 0) - (Number(b.cash_flow) || 0));
    const pdfBuffer = await generateCashFlowReportPdfBuffer(rows, filters, report.name, metrics);
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Cash-Flow-Report-${dateStr}.pdf`,
      subject: `Cash Flow Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Cash Flow Report covering ${rows.length} project${rows.length !== 1 ? 's' : ''}.`,
    };
  },
};

/**
 * Execute a single scheduled report: generate PDF and email to all recipients.
 * @param {Object} report - Row from scheduled_reports with recipients joined
 * @returns {Object} - Result summary
 */
async function executeScheduledReport(report) {
  const handler = REPORT_HANDLERS[report.report_type];
  if (!handler) {
    throw new Error(`Unknown report type: ${report.report_type}`);
  }

  const recipients = report.recipients || [];
  if (recipients.length === 0) {
    throw new Error('No recipients configured for this scheduled report');
  }

  // Generate the report PDF
  const { pdfBuffer, filename, subject, body } = await handler(report);

  // Collect recipient emails
  const toAddresses = recipients.map(r => r.email).filter(Boolean);
  if (toAddresses.length === 0) {
    throw new Error('No valid email addresses found for recipients');
  }

  // Send a single email to all recipients
  const result = await sendEmail({
    to: toAddresses.join(', '),
    subject: `${subject}${report.name ? ` (${report.name})` : ''}`,
    text: `${body}\n\nThis is an automated report from TITAN Project Management.\nSchedule: "${report.name}"`,
    html: generateEmailHtml(body, report.name),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    reportId: report.id,
    reportName: report.name,
    recipientCount: toAddresses.length,
    emailResult: result,
  };
}

/**
 * Generate a simple HTML email body for the scheduled report.
 */
function generateEmailHtml(bodyText, scheduleName) {
  const lines = bodyText.split('\n').map(l => `<p style="margin: 0 0 8px;">${l}</p>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #002356, #004080); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px; letter-spacing: 0.05em;">TITAN</h1>
    <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Automated Report Delivery</p>
  </div>
  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
    ${lines}
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">
        This is an automated report from TITAN Project Management.<br>
        Schedule: "${scheduleName || 'Unnamed'}"
      </p>
    </div>
  </div>
  <div style="background: #f3f4f6; padding: 12px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="font-size: 11px; color: #9ca3af; margin: 0;">TITAN Project Management</p>
  </div>
</body>
</html>`;
}

/**
 * Main cron runner: find all due reports and execute them.
 */
async function runScheduledReports() {
  const dueReports = await ScheduledReport.findDueReports();

  if (dueReports.length === 0) return;

  console.log(`[Scheduled Reports] Found ${dueReports.length} due report(s) to send...`);

  let sent = 0;
  let failed = 0;

  for (const report of dueReports) {
    try {
      console.log(`[Scheduled Reports] Processing "${report.name}" (${report.report_type}) for tenant ${report.tenant_id}...`);
      await executeScheduledReport(report);
      await ScheduledReport.markRun(report.id);
      sent++;
      console.log(`[Scheduled Reports] Sent "${report.name}" to ${report.recipients.length} recipient(s)`);
    } catch (err) {
      failed++;
      console.error(`[Scheduled Reports] Failed to send "${report.name}":`, err.message);
    }
  }

  console.log(`[Scheduled Reports] Complete: ${sent} sent, ${failed} failed`);
}

module.exports = { runScheduledReports, executeScheduledReport };
