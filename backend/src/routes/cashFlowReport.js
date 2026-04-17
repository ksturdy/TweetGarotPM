const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generateCashFlowReportPdfBuffer } = require('../utils/cashFlowReportPdfBuffer');

router.use(authenticate);
router.use(tenantContext);

/**
 * Shared data builder - used by the JSON endpoint, PDF download, and scheduled report runner.
 * @param {number} tenantId
 * @param {Object} filters - Optional filters: { status, pm, department, market, search }
 * @returns {Promise<Array>} - Array of project cash flow rows
 */
async function buildCashFlowData(tenantId, filters = {}) {
  const result = await db.query(
    `SELECT
       p.id,
       p.number,
       p.name,
       p.status,
       p.market,
       p.manager_id,
       e.first_name || ' ' || e.last_name as manager_name,
       d.department_number,
       d.name as department_name,
       COALESCE(c.name, c.customer_owner, p.client) as customer_name,
       COALESCE(oc.name, oc.customer_owner) as owner_name,
       COALESCE(vc.contract_amount, p.contract_value) as contract_value,
       vc.orig_contract_amount,
       vc.earned_revenue,
       vc.billed_amount,
       vc.received_amount,
       vc.open_receivables,
       vc.cash_flow,
       vc.actual_cost,
       vc.projected_cost,
       vc.projected_revenue,
       COALESCE(vc.gross_profit_percent, p.gross_margin_percent) as gross_profit_percent,
       vc.gross_profit_dollars,
       COALESCE(vc.backlog, p.backlog) as backlog,
       vc.pending_change_orders,
       vc.approved_changes,
       vc.change_order_count,
       CASE
         WHEN vc.projected_cost > 0 THEN (vc.actual_cost / vc.projected_cost)
         ELSE NULL
       END as percent_complete
     FROM projects p
     LEFT JOIN employees e ON p.manager_id = e.id
     LEFT JOIN departments d ON p.department_id = d.id
     LEFT JOIN customers c ON p.customer_id = c.id
     LEFT JOIN customers oc ON p.owner_customer_id = oc.id
     LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
     WHERE p.tenant_id = $1
     ORDER BY p.number ASC`,
    [tenantId]
  );

  let rows = result.rows;

  // Apply filters if provided
  if (filters.status && filters.status !== 'all') {
    rows = rows.filter(r => r.status === filters.status);
  }
  if (filters.pm && filters.pm !== 'all') {
    rows = rows.filter(r => r.manager_name === filters.pm);
  }
  if (filters.department && filters.department !== 'all') {
    rows = rows.filter(r => r.department_name === filters.department || r.department_number === filters.department);
  }
  if (filters.market && filters.market !== 'all') {
    rows = rows.filter(r => r.market === filters.market);
  }
  if (filters.team) {
    const Team = require('../models/Team');
    const members = await Team.getMembers(Number(filters.team), tenantId);
    const employeeIds = new Set(members.map(m => m.employee_id));
    rows = rows.filter(r => r.manager_id && employeeIds.has(r.manager_id));
  }
  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter(r =>
      (r.name && r.name.toLowerCase().includes(term)) ||
      (r.number && String(r.number).toLowerCase().includes(term)) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(term)) ||
      (r.manager_name && r.manager_name.toLowerCase().includes(term))
    );
  }

  return rows;
}

/**
 * GET /api/reports/cash-flow
 * Returns project-level cash flow data from vp_contracts
 */
router.get('/', async (req, res) => {
  try {
    const rows = await buildCashFlowData(req.tenantId);
    res.json(rows);
  } catch (error) {
    console.error('Cash flow report error:', error);
    res.status(500).json({ error: 'Failed to load cash flow data' });
  }
});

/**
 * GET /api/reports/cash-flow/pdf-download
 * Download Cash Flow Report as PDF
 */
router.get('/pdf-download', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      pm: req.query.pm,
      department: req.query.department,
      market: req.query.market,
      search: req.query.search,
    };
    const rows = await buildCashFlowData(req.tenantId, filters);
    rows.sort((a, b) => (Number(a.cash_flow) || 0) - (Number(b.cash_flow) || 0));
    const pdfBuffer = await generateCashFlowReportPdfBuffer(rows, filters);

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Cash-Flow-Report-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating cash flow report PDF:', error);
    res.status(500).json({ error: 'Failed to generate cash flow report PDF' });
  }
});

/**
 * GET /api/reports/cash-flow/email-draft
 * Download .eml email draft with PDF attached
 */
router.get('/email-draft', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      pm: req.query.pm,
      department: req.query.department,
      market: req.query.market,
      search: req.query.search,
    };
    const rows = await buildCashFlowData(req.tenantId, filters);
    rows.sort((a, b) => (Number(a.cash_flow) || 0) - (Number(b.cash_flow) || 0));
    const pdfBuffer = await generateCashFlowReportPdfBuffer(rows, filters);

    const dateStr = new Date().toISOString().split('T')[0];
    const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const pdfFilename = `Cash-Flow-Report-${dateStr}.pdf`;
    const generatedBy = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();

    const emailBody = `Please find attached the Cash Flow Report as of ${dateLabel}.

This report includes project-level cash flow data across ${rows.length} projects.

Best regards,
${generatedBy}`.trim();

    const boundary = '----=_NextPart_' + Date.now().toString(16);
    const base64Pdf = pdfBuffer.toString('base64');
    const base64Lines = base64Pdf.match(/.{1,76}/g) || [];

    const emlContent = [
      'MIME-Version: 1.0',
      'To: ',
      `Subject: Cash Flow Report - ${dateLabel}`,
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
    res.setHeader('Content-Disposition', `attachment; filename="Cash-Flow-Report-${dateStr}.eml"`);
    res.send(emlContent);
  } catch (error) {
    console.error('Error generating cash flow report email draft:', error);
    res.status(500).json({ error: 'Failed to generate email draft' });
  }
});

/**
 * Build snapshot-based cash flow metrics (reusable)
 */
async function buildCashFlowMetrics(tenantId) {
  const result = await db.query(
    `WITH first_positive AS (
       SELECT DISTINCT ON (ps.project_id)
         ps.project_id,
         ps.snapshot_date,
         ps.percent_complete,
         ps.cash_flow
       FROM project_snapshots ps
       WHERE ps.cash_flow > 0
         AND ps.tenant_id = $1
       ORDER BY ps.project_id, ps.snapshot_date ASC
     )
     SELECT
       fp.project_id,
       fp.snapshot_date,
       fp.percent_complete,
       fp.cash_flow
     FROM first_positive fp`,
    [tenantId]
  );

  const rows = result.rows;
  const count = rows.length;
  const avgPctComplete = count > 0
    ? rows.reduce((sum, r) => sum + (parseFloat(r.percent_complete) || 0), 0) / count
    : 0;

  return {
    avg_pct_at_first_positive: avgPctComplete,
    projects_that_turned_positive: count,
    per_project: rows.map(r => ({
      project_id: r.project_id,
      first_positive_date: r.snapshot_date,
      percent_complete_at_positive: parseFloat(r.percent_complete) || 0,
    })),
  };
}

/**
 * GET /api/reports/cash-flow/metrics
 * Returns computed metrics from snapshot history
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await buildCashFlowMetrics(req.tenantId);
    res.json(metrics);
  } catch (error) {
    console.error('Cash flow metrics error:', error);
    res.status(500).json({ error: 'Failed to load cash flow metrics' });
  }
});

module.exports = router;
module.exports.buildCashFlowData = buildCashFlowData;
module.exports.buildCashFlowMetrics = buildCashFlowMetrics;
