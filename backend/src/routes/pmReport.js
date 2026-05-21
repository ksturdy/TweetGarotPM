const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const VistaData = require('../models/VistaData');
const { generatePMReportPdfBuffer } = require('../utils/pmReportPdfBuffer');

router.use(authenticate);
router.use(tenantContext);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const INACTIVE_STATUSES = new Set([
  'Hard-Closed', 'Closed', 'Completed', 'completed', 'Cancelled', 'cancelled',
]);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const isActive = (c) => !c.status || !INACTIVE_STATUSES.has(c.status);

function classifyJobHealth(c) {
  const est = num(c.current_est_cost) || num(c.projected_cost);
  const projected = num(c.projected_cost);
  const projectedRevenue = num(c.projected_revenue);
  const earnedRevenue = num(c.earned_revenue);
  const billed = num(c.billed_amount);
  const contractAmount = num(c.contract_amount);
  const grossProfitPct = num(c.gross_profit_percent);
  const origMarginPct = num(c.original_estimated_margin_pct);

  const reasons = [];
  let score = 100;

  const costVariance = est > 0 ? (projected - est) / est : 0;
  if (costVariance > 0.05) {
    score -= 30;
    reasons.push(`Projected cost ${(costVariance * 100).toFixed(1)}% over estimate`);
  } else if (costVariance > 0) {
    score -= 10;
    reasons.push(`Projected cost ${(costVariance * 100).toFixed(1)}% over estimate`);
  }

  if (origMarginPct > 0 && grossProfitPct < origMarginPct - 2) {
    score -= 20;
    reasons.push(`Margin slipped from ${origMarginPct.toFixed(1)}% to ${grossProfitPct.toFixed(1)}%`);
  }
  if (grossProfitPct < 0) {
    score -= 30;
    reasons.push(`Negative projected margin (${grossProfitPct.toFixed(1)}%)`);
  }

  const overUnder = billed - earnedRevenue;
  if (contractAmount > 0) {
    const ouPct = Math.abs(overUnder) / contractAmount;
    if (overUnder < 0 && ouPct > 0.05) {
      score -= 15;
      reasons.push(`Under-billed by ${(ouPct * 100).toFixed(1)}% of contract`);
    }
  }

  const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;

  let health = 'green';
  if (score < 60) health = 'red';
  else if (score < 85) health = 'yellow';

  return {
    health,
    score: Math.max(0, score),
    reasons,
    costVariance,
    pctComplete,
    overUnderBilled: overUnder,
  };
}

async function loadSnapshotTrends(projectIds, tenantId) {
  if (!projectIds.length) return new Map();
  const result = await db.query(
    `SELECT project_id, snapshot_date,
            projected_cost, current_est_cost, gross_profit_dollars, gross_profit_percent,
            backlog, earned_revenue, projected_revenue, billed_amount, cash_flow
     FROM project_snapshots
     WHERE tenant_id = $1 AND project_id = ANY($2::int[])
     ORDER BY project_id, snapshot_date DESC`,
    [tenantId, projectIds]
  );
  const byProject = new Map();
  for (const row of result.rows) {
    if (!byProject.has(row.project_id)) byProject.set(row.project_id, []);
    const arr = byProject.get(row.project_id);
    if (arr.length < 8) arr.push(row);
  }
  return byProject;
}

function buildTrend(snapshots) {
  if (!snapshots || snapshots.length === 0) return null;
  const latest = snapshots[0];
  const prior = snapshots[1] || null;
  const fourWeeksAgo = snapshots[Math.min(snapshots.length - 1, 4)] || null;

  const delta = (a, b) => {
    if (!b) return null;
    return num(a) - num(b);
  };

  return {
    snapshotCount: snapshots.length,
    latestDate: latest.snapshot_date,
    series: snapshots.slice().reverse().map(s => ({
      date: s.snapshot_date,
      projectedCost: num(s.projected_cost),
      grossProfitPct: num(s.gross_profit_percent),
      backlog: num(s.backlog),
      earnedRevenue: num(s.earned_revenue),
      cashFlow: num(s.cash_flow),
    })),
    weekOverWeek: prior ? {
      projectedCost: delta(latest.projected_cost, prior.projected_cost),
      grossProfitPct: delta(latest.gross_profit_percent, prior.gross_profit_percent),
      backlog: delta(latest.backlog, prior.backlog),
      earnedRevenue: delta(latest.earned_revenue, prior.earned_revenue),
      cashFlow: delta(latest.cash_flow, prior.cash_flow),
    } : null,
    fourWeek: fourWeeksAgo && fourWeeksAgo !== latest ? {
      projectedCost: delta(latest.projected_cost, fourWeeksAgo.projected_cost),
      grossProfitPct: delta(latest.gross_profit_percent, fourWeeksAgo.gross_profit_percent),
      backlog: delta(latest.backlog, fourWeeksAgo.backlog),
    } : null,
  };
}

function buildPMGroups(contracts, snapshotTrends) {
  const byPM = new Map();

  for (const c of contracts) {
    if (!isActive(c)) continue;

    const key = c.linked_employee_id
      ? `emp:${c.linked_employee_id}`
      : `name:${c.project_manager_name || 'Unknown'}`;

    if (!byPM.has(key)) {
      byPM.set(key, {
        key,
        employeeId: c.linked_employee_id || null,
        pmName: c.linked_employee_name || c.project_manager_name || 'Unknown',
        departmentId: c.linked_department_id || null,
        departmentName: c.linked_department_name || null,
        linked: !!c.linked_employee_id,
        jobs: [],
        totals: {
          activeJobs: 0,
          contractAmount: 0,
          projectedRevenue: 0,
          earnedRevenue: 0,
          projectedCost: 0,
          estimatedCost: 0,
          grossProfitDollars: 0,
          backlog: 0,
          billed: 0,
          openReceivables: 0,
          cashFlow: 0,
        },
        healthCounts: { green: 0, yellow: 0, red: 0 },
      });
    }
    const row = byPM.get(key);

    const health = classifyJobHealth(c);
    const trend = c.linked_project_id ? buildTrend(snapshotTrends.get(c.linked_project_id)) : null;

    row.jobs.push({
      contractNumber: c.contract_number,
      description: c.description,
      customerName: c.linked_customer_name || c.customer_name,
      projectId: c.linked_project_id,
      projectNumber: c.linked_project_number,
      projectName: c.linked_project_name,
      status: c.status,
      departmentCode: c.department_code,

      contractAmount: num(c.contract_amount),
      origContractAmount: num(c.orig_contract_amount),
      approvedChanges: num(c.approved_changes),
      pendingChangeOrders: num(c.pending_change_orders),
      projectedRevenue: num(c.projected_revenue),
      earnedRevenue: num(c.earned_revenue),
      billedAmount: num(c.billed_amount),
      receivedAmount: num(c.received_amount),
      openReceivables: num(c.open_receivables),
      backlog: num(c.backlog),
      cashFlow: num(c.cash_flow),

      projectedCost: num(c.projected_cost),
      actualCost: num(c.actual_cost),
      currentEstCost: num(c.current_est_cost),

      grossProfitDollars: num(c.gross_profit_dollars),
      grossProfitPercent: num(c.gross_profit_percent),
      originalEstimatedMarginPct: num(c.original_estimated_margin_pct),

      totalHoursEstimate: num(c.total_hours_estimate),
      totalHoursJtd: num(c.total_hours_jtd),

      health: health.health,
      healthScore: health.score,
      healthReasons: health.reasons,
      pctComplete: health.pctComplete,
      overUnderBilled: health.overUnderBilled,
      costVariance: health.costVariance,

      trend,
    });

    row.totals.activeJobs += 1;
    row.totals.contractAmount += num(c.contract_amount);
    row.totals.projectedRevenue += num(c.projected_revenue);
    row.totals.earnedRevenue += num(c.earned_revenue);
    row.totals.projectedCost += num(c.projected_cost);
    row.totals.estimatedCost += num(c.current_est_cost) || num(c.projected_cost);
    row.totals.grossProfitDollars += num(c.gross_profit_dollars);
    row.totals.backlog += num(c.backlog);
    row.totals.billed += num(c.billed_amount);
    row.totals.openReceivables += num(c.open_receivables);
    row.totals.cashFlow += num(c.cash_flow);
    row.healthCounts[health.health] += 1;
  }

  const pms = Array.from(byPM.values()).map(row => {
    const t = row.totals;
    const aggGpPct = t.projectedRevenue > 0
      ? (t.projectedRevenue - t.projectedCost) / t.projectedRevenue * 100
      : 0;
    const aggCostVariance = t.estimatedCost > 0
      ? (t.projectedCost - t.estimatedCost) / t.estimatedCost
      : 0;

    let overallHealth = 'green';
    if (row.healthCounts.red > 0) overallHealth = 'red';
    else if (row.healthCounts.yellow > Math.max(1, row.healthCounts.green)) overallHealth = 'yellow';
    else if (row.healthCounts.yellow > 0) overallHealth = 'yellow';

    row.jobs.sort((a, b) => a.healthScore - b.healthScore);

    return {
      ...row,
      totals: {
        ...t,
        aggregateGrossProfitPct: aggGpPct,
        aggregateCostVariance: aggCostVariance,
      },
      overallHealth,
    };
  });

  pms.sort((a, b) => {
    const rank = { red: 0, yellow: 1, green: 2 };
    if (rank[a.overallHealth] !== rank[b.overallHealth]) {
      return rank[a.overallHealth] - rank[b.overallHealth];
    }
    return b.totals.backlog - a.totals.backlog;
  });

  return pms;
}

/**
 * Build the full PM Report payload for a tenant, optionally filtered.
 * Shared by the JSON endpoint, the PDF download endpoint, and the scheduled
 * report runner.
 *
 * @param {number} tenantId
 * @param {Object} filters
 *   - pm_keys: string[]  (PM keys like "emp:123" or "name:Doe, Jane") — narrows to selected PMs
 *   - departments: string[]  (department names) — narrows by department
 *   - health: 'red' | 'yellow' | 'green'  — narrows to one health level
 */
async function buildPMReportData(tenantId, filters = {}) {
  const contracts = await VistaData.getAllContracts({}, tenantId);
  const linkedProjectIds = contracts
    .filter(c => isActive(c) && c.linked_project_id)
    .map(c => c.linked_project_id);
  const uniqueIds = Array.from(new Set(linkedProjectIds));
  const snapshotTrends = await loadSnapshotTrends(uniqueIds, tenantId);

  let pms = buildPMGroups(contracts, snapshotTrends);

  if (Array.isArray(filters.pm_keys) && filters.pm_keys.length > 0) {
    const allowed = new Set(filters.pm_keys);
    pms = pms.filter(p => allowed.has(p.key));
  }
  if (Array.isArray(filters.departments) && filters.departments.length > 0) {
    const allowed = new Set(filters.departments);
    pms = pms.filter(p => allowed.has(p.departmentName || '(Unassigned)'));
  }
  if (filters.health && ['red', 'yellow', 'green'].includes(filters.health)) {
    pms = pms.filter(p => p.overallHealth === filters.health);
  }

  return {
    generatedAt: new Date().toISOString(),
    pms,
    filters,
    meta: {
      totalContractsScanned: contracts.length,
      activeJobsCounted: pms.reduce((s, p) => s + p.totals.activeJobs, 0),
      pmCount: pms.length,
      projectsWithSnapshots: snapshotTrends.size,
    },
  };
}

/**
 * GET /api/reports/pm-report
 * Aggregates open Vista contracts by PM with health scoring and snapshot trends.
 * Query params (all optional):
 *   - pm_keys: comma-separated PM keys
 *   - departments: comma-separated department names
 *   - health: red|yellow|green
 */
router.get('/', async (req, res) => {
  try {
    const filters = parseQueryFilters(req.query);
    const data = await buildPMReportData(req.tenantId, filters);
    res.json(data);
  } catch (error) {
    console.error('Error building PM report:', error);
    res.status(500).json({ error: 'Failed to build PM report' });
  }
});

function parseQueryFilters(q) {
  const filters = {};
  if (q.pm_keys) {
    filters.pm_keys = String(q.pm_keys).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (q.departments) {
    filters.departments = String(q.departments).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (q.health) filters.health = String(q.health);
  return filters;
}

/**
 * GET /api/reports/pm-report/pdf-download
 * Renders the report as a PDF and streams it back.
 */
router.get('/pdf-download', async (req, res) => {
  try {
    const filters = parseQueryFilters(req.query);
    const scheduleName = req.query.scheduleName ? String(req.query.scheduleName) : null;
    const data = await buildPMReportData(req.tenantId, filters);
    const pdfBuffer = await generatePMReportPdfBuffer(data, scheduleName);

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Project-Manager-Report-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PM report PDF:', error);
    res.status(500).json({ error: 'Failed to generate PM report PDF' });
  }
});

/**
 * POST /api/reports/pm-report/summary
 * Generates an AI summary of a single PM's health & performance.
 * Body: { pm: <pm row object from GET response> }
 */
router.post('/summary', async (req, res) => {
  try {
    const { pm } = req.body;
    if (!pm || !pm.pmName) {
      return res.status(400).json({ error: 'pm payload required' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI summary unavailable — ANTHROPIC_API_KEY not configured' });
    }

    const fmt$ = (n) => {
      const v = Number(n) || 0;
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
      if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
      return `$${Math.round(v).toLocaleString('en-US')}`;
    };
    const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

    const t = pm.totals || {};
    const jobLines = (pm.jobs || []).slice(0, 20).map((j, i) => {
      const wow = j.trend?.weekOverWeek;
      const wowStr = wow
        ? ` | WoW: GP% ${(wow.grossProfitPct ?? 0).toFixed(2)}pp, projCost ${fmt$(wow.projectedCost)}, backlog ${fmt$(wow.backlog)}`
        : '';
      return `${i + 1}. [${j.health.toUpperCase()}] ${j.contractNumber} — ${j.description || 'no description'}
   Contract: ${fmt$(j.contractAmount)} | %Complete: ${fmtPct(j.pctComplete * 100)} | GP%: ${fmtPct(j.grossProfitPercent)} (orig ${fmtPct(j.originalEstimatedMarginPct)})
   Projected Cost vs Est: ${fmt$(j.projectedCost)} vs ${fmt$(j.currentEstCost)} (variance ${fmtPct(j.costVariance * 100)})
   Over/(Under) Billed: ${fmt$(j.overUnderBilled)} | Backlog: ${fmt$(j.backlog)} | Cash Flow: ${fmt$(j.cashFlow)}${wowStr}
   Issues: ${j.healthReasons.length ? j.healthReasons.join('; ') : 'none'}`;
    }).join('\n\n');

    const systemPrompt = `You are Titan, an AI analyst for Tweet Garot Mechanical (commercial HVAC and plumbing contractor).
You assess project manager performance from Vista contract data and weekly financial snapshots.
Be concise, specific, and use plain prose with short paragraphs and a bullet list of jobs to watch.
Do not invent numbers — only reference figures provided.
Lead with an overall health verdict (Healthy / Watch / At Risk), then 2-3 short paragraphs covering:
  1) Portfolio health (margin, cost variance, billing position),
  2) Performance trends (what the snapshot deltas show — improving or slipping?),
  3) Specific jobs requiring attention (red/yellow jobs by name).
Close with a short "Recommended actions" bullet list (1-3 items).
Keep total response under 400 words. No markdown headers, just paragraphs and a final bullet list.`;

    const userMessage = `Project Manager: ${pm.pmName}${pm.departmentName ? ` (${pm.departmentName})` : ''}
Overall Health: ${pm.overallHealth.toUpperCase()}
Active Jobs: ${t.activeJobs} (green ${pm.healthCounts.green}, yellow ${pm.healthCounts.yellow}, red ${pm.healthCounts.red})

Portfolio Totals:
- Contract Amount: ${fmt$(t.contractAmount)}
- Projected Revenue: ${fmt$(t.projectedRevenue)}
- Earned Revenue: ${fmt$(t.earnedRevenue)}
- Projected Cost: ${fmt$(t.projectedCost)} (estimated ${fmt$(t.estimatedCost)}, variance ${fmtPct(t.aggregateCostVariance * 100)})
- Aggregate GP%: ${fmtPct(t.aggregateGrossProfitPct)}
- Backlog: ${fmt$(t.backlog)}
- Open Receivables: ${fmt$(t.openReceivables)}
- Net Cash Flow: ${fmt$(t.cashFlow)}

Jobs (worst to best):
${jobLines}

Summarize this PM's health and performance.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0].text;
    res.json({
      summary: text,
      pmName: pm.pmName,
      generatedAt: new Date().toISOString(),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('Error generating PM summary:', {
      status: error?.status,
      message: error?.message,
      type: error?.error?.type,
      apiError: error?.error?.error,
    });
    if (error?.status === 401) {
      return res.status(500).json({ error: 'AI service authentication failed — check ANTHROPIC_API_KEY' });
    }
    const detail = error?.error?.error?.message || error?.message || 'Failed to generate summary';
    res.status(error?.status && error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: detail });
  }
});

module.exports = router;
module.exports.buildPMReportData = buildPMReportData;
