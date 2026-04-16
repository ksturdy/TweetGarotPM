const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { generateExecutiveReportPdfBuffer } = require('../utils/executiveReportPdfBuffer');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Helper: get numeric value, defaulting null/undefined to 0
const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// Format date to YYYY-MM-DD string
const formatDate = (d) => {
  if (!d) return null;
  return typeof d === 'string' ? d : new Date(d).toISOString().split('T')[0];
};

/**
 * Shared report data builder - used by JSON, PDF, and email endpoints
 */
async function buildReportData(tenantId, requestedDate) {
  // Get all available snapshot dates
  const datesResult = await db.query(
    `SELECT DISTINCT snapshot_date
     FROM project_snapshots
     WHERE tenant_id = $1
     ORDER BY snapshot_date DESC
     LIMIT 52`,
    [tenantId]
  );

  const availableDates = datesResult.rows.map(r => r.snapshot_date);

  // Determine current and previous snapshot dates (may be null if no snapshots yet)
  let currentDate = null, previousDate = null;

  if (availableDates.length > 0) {
    if (requestedDate) {
      const idx = availableDates.findIndex(d => {
        const dStr = typeof d === 'string' ? d : new Date(d).toISOString().split('T')[0];
        return dStr === requestedDate;
      });
      if (idx >= 0) {
        currentDate = availableDates[idx];
        previousDate = idx + 1 < availableDates.length ? availableDates[idx + 1] : null;
      } else {
        currentDate = availableDates[0];
        previousDate = availableDates.length > 1 ? availableDates[1] : null;
      }
    } else {
      currentDate = availableDates[0];
      previousDate = availableDates.length > 1 ? availableDates[1] : null;
    }
  }

  // Fetch snapshots for current and previous dates in parallel
  const snapshotQuery = `
    SELECT
      ps.project_id,
      ps.contract_amount,
      ps.orig_contract_amount,
      ps.approved_changes,
      ps.pending_change_orders,
      ps.change_order_count,
      ps.projected_revenue,
      ps.earned_revenue,
      ps.backlog,
      ps.percent_complete,
      ps.gross_profit_dollars,
      ps.gross_profit_percent,
      ps.original_estimated_margin,
      ps.original_estimated_margin_pct,
      ps.billed_amount,
      ps.received_amount,
      ps.open_receivables,
      ps.cash_flow,
      ps.actual_cost,
      ps.projected_cost,
      ps.current_est_cost,
      ps.actual_labor_rate,
      ps.estimated_labor_rate,
      ps.total_hours_estimate,
      ps.total_hours_jtd,
      ps.total_hours_projected,
      ps.pf_hours_jtd,
      ps.sm_hours_jtd,
      ps.pl_hours_jtd,
      p.name as project_name,
      p.number as project_number,
      p.market,
      p.status,
      COALESCE(e.first_name || ' ' || e.last_name, '') as manager_name
    FROM project_snapshots ps
    JOIN projects p ON ps.project_id = p.id
    LEFT JOIN employees e ON p.manager_id = e.id
    WHERE ps.tenant_id = $1
      AND ps.snapshot_date = $2
  `;

  // Run all queries in parallel: snapshots + new jobs/opportunities/estimates
  const snapshotQueries = [
    currentDate ? db.query(snapshotQuery, [tenantId, currentDate]) : Promise.resolve({ rows: [] }),
    previousDate ? db.query(snapshotQuery, [tenantId, previousDate]) : Promise.resolve({ rows: [] }),
    // New projects (started in last 90 days, largest by contract value)
    db.query(
      `SELECT p.id as project_id, p.name as project_name, p.number as project_number,
              p.market, p.status,
              COALESCE(vc.contract_amount, p.contract_value) as contract_value,
              p.start_date,
              COALESCE(e.first_name || ' ' || e.last_name, '') as manager_name
       FROM projects p
       LEFT JOIN employees e ON p.manager_id = e.id
       LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
       WHERE p.tenant_id = $1
         AND p.status NOT IN ('Hard-Closed', 'Soft-Closed', 'completed', 'cancelled')
         AND COALESCE(vc.contract_amount, p.contract_value) > 0
         AND p.start_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY COALESCE(vc.contract_amount, p.contract_value) DESC
       LIMIT 10`,
      [tenantId]
    ),
    // New opportunities (last 90 days)
    db.query(
      `SELECT o.id, o.title, o.estimated_value, o.market, o.created_at,
              o.priority,
              COALESCE(c.customer_facility, o.client_company, '') as customer_name,
              COALESCE(ps.name, '') as stage_name
       FROM opportunities o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
       WHERE o.tenant_id = $1
         AND o.created_at >= NOW() - INTERVAL '90 days'
         AND o.estimated_value IS NOT NULL
         AND o.estimated_value > 0
       ORDER BY o.estimated_value DESC
       LIMIT 10`,
      [tenantId]
    ),
    // Recent estimates (last 90 days)
    db.query(
      `SELECT est.id, est.estimate_number, est.project_name, est.total_cost,
              est.status, est.created_at,
              COALESCE(est.customer_name, c.customer_facility, '') as customer_name,
              COALESCE(est.estimator_name, '') as estimator_name
       FROM estimates est
       LEFT JOIN customers c ON est.customer_id = c.id
       WHERE est.tenant_id = $1
         AND est.created_at >= NOW() - INTERVAL '90 days'
         AND est.total_cost IS NOT NULL
         AND est.total_cost > 0
       ORDER BY est.total_cost DESC
       LIMIT 10`,
      [tenantId]
    ),
  ];

  const [currentResult, previousResult, newProjectsResult, newOppsResult, recentEstResult] = await Promise.all(snapshotQueries);

  const currentSnapshots = currentResult.rows;
  const previousSnapshots = previousResult.rows;
  const newProjects = newProjectsResult.rows;
  const newOpportunities = newOppsResult.rows;
  const recentEstimates = recentEstResult.rows;

  // Index previous snapshots by project_id for O(1) lookup
  const prevMap = new Map();
  for (const snap of previousSnapshots) {
    prevMap.set(snap.project_id, snap);
  }

  // Build summary KPIs
  const summary = {
    totalProjects: currentSnapshots.length,
    totalContractValue: currentSnapshots.reduce((sum, s) => sum + num(s.contract_amount), 0),
    totalGrossProfit: currentSnapshots.reduce((sum, s) => sum + num(s.gross_profit_dollars), 0),
    avgGrossMarginPct: 0,
    totalBacklog: currentSnapshots.reduce((sum, s) => sum + num(s.backlog), 0),
    totalEarnedRevenue: currentSnapshots.reduce((sum, s) => sum + num(s.earned_revenue), 0),
  };

  const totalProjectedRevenue = currentSnapshots.reduce((sum, s) => sum + num(s.projected_revenue), 0);
  summary.avgGrossMarginPct = totalProjectedRevenue > 0
    ? summary.totalGrossProfit / totalProjectedRevenue
    : 0;

  // Helper: build a top-10 list from snapshots
  const buildTop10 = (snapshots, sortField, sortDir, filterFn, computeValueFn) => {
    let filtered = filterFn ? snapshots.filter(filterFn) : [...snapshots];

    filtered.sort((a, b) => {
      const aVal = computeValueFn ? computeValueFn(a) : num(a[sortField]);
      const bVal = computeValueFn ? computeValueFn(b) : num(b[sortField]);
      return sortDir === 'DESC' ? bVal - aVal : aVal - bVal;
    });

    return filtered.slice(0, 10).map((snap, idx) => {
      const value = computeValueFn ? computeValueFn(snap) : num(snap[sortField]);
      const prev = prevMap.get(snap.project_id);
      const previousValue = prev
        ? (computeValueFn ? computeValueFn(prev) : num(prev[sortField]))
        : null;
      const change = previousValue !== null ? value - previousValue : 0;
      const changePercent = previousValue !== null && previousValue !== 0
        ? (change / Math.abs(previousValue)) * 100
        : 0;

      return {
        rank: idx + 1,
        projectId: snap.project_id,
        projectName: snap.project_name,
        projectNumber: snap.project_number,
        managerName: snap.manager_name,
        market: snap.market,
        value: Math.round(value * 100) / 100,
        previousValue: previousValue !== null ? Math.round(previousValue * 100) / 100 : null,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 10) / 10,
      };
    });
  };

  // Build "Movers & Shakers" - sort by absolute GP change
  const buildMoversShakers = () => {
    const bothWeeks = currentSnapshots.filter(s => prevMap.has(s.project_id));

    const withChange = bothWeeks.map(snap => {
      const prev = prevMap.get(snap.project_id);
      const currentGP = num(snap.gross_profit_dollars);
      const prevGP = num(prev.gross_profit_dollars);
      const change = currentGP - prevGP;
      return { ...snap, gpChange: change, absGpChange: Math.abs(change) };
    });

    withChange.sort((a, b) => b.absGpChange - a.absGpChange);

    return withChange.slice(0, 10).map((snap, idx) => {
      const prev = prevMap.get(snap.project_id);
      return {
        rank: idx + 1,
        projectId: snap.project_id,
        projectName: snap.project_name,
        projectNumber: snap.project_number,
        managerName: snap.manager_name,
        market: snap.market,
        value: Math.round(snap.gpChange * 100) / 100,
        previousValue: Math.round(num(prev.gross_profit_dollars) * 100) / 100,
        change: Math.round(snap.gpChange * 100) / 100,
        changePercent: num(prev.gross_profit_dollars) !== 0
          ? Math.round((snap.gpChange / Math.abs(num(prev.gross_profit_dollars))) * 1000) / 10
          : 0,
      };
    });
  };

  // Define all categories
  const categories = [
    {
      id: 'heavy-hitters',
      title: 'The Heavy Hitters',
      subtitle: 'Largest Jobs by Contract Value',
      icon: 'trophy',
      color: '#1a56db',
      formatType: 'currency',
      items: buildTop10(currentSnapshots, 'contract_amount', 'DESC'),
    },
    {
      id: 'money-makers',
      title: 'Money Makers',
      subtitle: 'Top Gross Profit Dollars',
      icon: 'money',
      color: '#10b981',
      formatType: 'currency',
      items: buildTop10(currentSnapshots, 'gross_profit_dollars', 'DESC'),
    },
    {
      id: 'margin-masters',
      title: 'Margin Masters',
      subtitle: 'Top Gross Profit Percentage',
      icon: 'trending_up',
      color: '#8b5cf6',
      formatType: 'percent',
      items: buildTop10(
        currentSnapshots,
        'gross_profit_percent',
        'DESC',
        (s) => num(s.contract_amount) > 500000
      ),
    },
    {
      id: 'bleeding-edge',
      title: 'The Bleeding Edge',
      subtitle: 'Worst Gross Profit (Losers)',
      icon: 'trending_down',
      color: '#ef4444',
      formatType: 'currency',
      items: buildTop10(
        currentSnapshots,
        'gross_profit_dollars',
        'ASC',
        (s) => num(s.gross_profit_dollars) < 0
      ),
    },
    {
      id: 'movers-shakers',
      title: 'Movers & Shakers',
      subtitle: 'Biggest GP$ Change This Week',
      icon: 'swap_vert',
      color: '#f59e0b',
      formatType: 'currency',
      items: previousDate ? buildMoversShakers() : [],
    },
    {
      id: 'cash-kings',
      title: 'Cash Kings',
      subtitle: 'Top Cash Flow',
      icon: 'account_balance',
      color: '#06b6d4',
      formatType: 'currency',
      items: buildTop10(currentSnapshots, 'cash_flow', 'DESC'),
    },
    {
      id: 'cash-crunch',
      title: 'Cash Crunch',
      subtitle: 'Worst Cash Flow (Money Pits)',
      icon: 'trending_down',
      color: '#b91c1c',
      formatType: 'currency',
      items: buildTop10(
        currentSnapshots,
        'cash_flow',
        'ASC',
        (s) => num(s.cash_flow) < 0
      ),
    },
    {
      id: 'backlog-beasts',
      title: 'Backlog Beasts',
      subtitle: 'Largest Backlog',
      icon: 'inventory',
      color: '#ec4899',
      formatType: 'currency',
      items: buildTop10(currentSnapshots, 'backlog', 'DESC'),
    },
    {
      id: 'almost-there',
      title: 'Almost There',
      subtitle: 'Closest to Completion (75-99%)',
      icon: 'flag',
      color: '#14b8a6',
      formatType: 'percent',
      items: buildTop10(
        currentSnapshots,
        'percent_complete',
        'DESC',
        (s) => {
          const pct = num(s.percent_complete);
          const closed = ['Hard-Closed', 'Soft-Closed', 'completed', 'cancelled'];
          return pct >= 0.75 && pct < 0.995 && !closed.includes(s.status);
        }
      ),
    },
    {
      id: 'change-order-champs',
      title: 'Change Order Champs',
      subtitle: 'Most Change Order Value',
      icon: 'description',
      color: '#f97316',
      formatType: 'currency',
      items: buildTop10(currentSnapshots, 'approved_changes', 'DESC'),
    },
    {
      id: 'labor-leaders',
      title: 'Labor Leaders',
      subtitle: 'Most Total Labor Hours (JTD)',
      icon: 'engineering',
      color: '#6366f1',
      formatType: 'number',
      items: buildTop10(currentSnapshots, 'total_hours_jtd', 'DESC'),
    },
    {
      id: 'new-big-jobs',
      title: 'Fresh & Large',
      subtitle: 'Largest New Jobs (Last 90 Days)',
      icon: 'new_releases',
      color: '#0d9488',
      formatType: 'currency',
      items: newProjects.map((p, idx) => ({
        rank: idx + 1,
        projectId: p.project_id,
        projectName: p.project_name,
        projectNumber: p.project_number,
        managerName: p.manager_name,
        market: p.market,
        value: Math.round(num(p.contract_value) * 100) / 100,
        previousValue: null,
        change: 0,
        changePercent: 0,
      })),
    },
    {
      id: 'hot-opportunities',
      title: 'Hot Opportunities',
      subtitle: 'Newest & Largest Opportunities (Last 90 Days)',
      icon: 'local_fire_department',
      color: '#e11d48',
      formatType: 'currency',
      items: newOpportunities.map((o, idx) => ({
        rank: idx + 1,
        projectId: o.id,
        projectName: o.title,
        projectNumber: o.stage_name || '',
        managerName: o.customer_name,
        market: o.market,
        value: Math.round(num(o.estimated_value) * 100) / 100,
        previousValue: null,
        change: 0,
        changePercent: 0,
      })),
    },
    {
      id: 'big-estimates',
      title: 'Big Bids',
      subtitle: 'Largest Recent Estimates (Last 90 Days)',
      icon: 'calculate',
      color: '#7c3aed',
      formatType: 'currency',
      items: recentEstimates.map((est, idx) => ({
        rank: idx + 1,
        projectId: est.id,
        projectName: est.project_name,
        projectNumber: est.estimate_number || '',
        managerName: est.estimator_name || est.customer_name,
        market: null,
        value: Math.round(num(est.total_cost) * 100) / 100,
        previousValue: null,
        change: 0,
        changePercent: 0,
      })),
    },
  ];

  return {
    reportDate: formatDate(currentDate),
    previousDate: formatDate(previousDate),
    availableDates: availableDates.map(formatDate),
    summary,
    categories,
  };
}

/**
 * GET /api/executive-report
 * Weekly Executive Report - JSON data
 */
router.get('/', async (req, res) => {
  try {
    const reportData = await buildReportData(req.tenantId, req.query.snapshotDate);
    res.json(reportData);
  } catch (error) {
    console.error('Error generating executive report:', error);
    res.status(500).json({ error: 'Failed to generate executive report' });
  }
});

/**
 * GET /api/executive-report/pdf-download
 * Download Executive Report as PDF
 */
router.get('/pdf-download', async (req, res) => {
  try {
    const reportData = await buildReportData(req.tenantId, req.query.snapshotDate);
    const pdfBuffer = await generateExecutiveReportPdfBuffer(reportData);

    const dateStr = reportData.reportDate || new Date().toISOString().split('T')[0];
    const filename = `Executive-Report-${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating executive report PDF:', error);
    res.status(500).json({ error: 'Failed to generate executive report PDF' });
  }
});

/**
 * GET /api/executive-report/email-draft
 * Download .eml email draft with PDF attached (opens in Outlook as unsent)
 */
router.get('/email-draft', async (req, res) => {
  try {
    const reportData = await buildReportData(req.tenantId, req.query.snapshotDate);
    const pdfBuffer = await generateExecutiveReportPdfBuffer(reportData);

    const dateStr = reportData.reportDate || new Date().toISOString().split('T')[0];
    const dateLabel = reportData.reportDate
      ? new Date(reportData.reportDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'Current';
    const pdfFilename = `Executive-Report-${dateStr}.pdf`;

    const emailBody = `Please find attached the Executive Report for the week of ${dateLabel}.

This report includes Top 10 rankings across key financial categories including contract value, gross profit, margin performance, cash flow, backlog, and more.

Best regards,
${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();

    // Create MIME .eml content
    const boundary = '----=_NextPart_' + Date.now().toString(16);
    const base64Pdf = pdfBuffer.toString('base64');
    const base64Lines = base64Pdf.match(/.{1,76}/g) || [];

    const emlContent = [
      'MIME-Version: 1.0',
      'To: ',
      `Subject: Executive Report - Week of ${dateLabel}`,
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
    res.setHeader('Content-Disposition', `attachment; filename="Executive-Report-${dateStr}.eml"`);
    res.send(emlContent);
  } catch (error) {
    console.error('Error generating executive report email draft:', error);
    res.status(500).json({ error: 'Failed to generate email draft' });
  }
});

module.exports = router;
module.exports.buildReportData = buildReportData;
