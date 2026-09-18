const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const ProjectAssignment = require('../models/ProjectAssignment');
const VistaData = require('../models/VistaData');
const { calcBacklogSnapshot } = require('../utils/backlogFitCalculator');
const { generateCompanyHealthPdfBuffer } = require('../utils/companyHealthPdfGenerator');
const { buildLaborForecastData } = require('../utils/forecastProjections');
const Anthropic = require('@anthropic-ai/sdk');

router.use(authenticate);
router.use(tenantContext);

const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

async function buildData(tenantId) {
  const [
    liveProjectsResult,
    snapshotSummaryResult,
    backlogByMarketResult,
    oppsByStageResult,
    oppsByMarketResult,
    projectStatusResult,
    deptBreakdownResult,
    laborSummary,
    contracts,
    laborForecastRaw,
    gmTrendResult,
    financialHealthResult,
    cfMetricsResult,
    marketBreakdownResult,
  ] = await Promise.all([
    // 1. Live project stats
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE p.status = 'Open') as active_projects,
        COALESCE(SUM(
          CASE
            WHEN p.status IN ('completed','cancelled','Hard-Closed') THEN 0
            WHEN vc.id IS NOT NULL THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
            ELSE GREATEST(COALESCE(p.backlog,0), 0)
          END
        ), 0) as total_backlog
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
    `, [tenantId]),

    // 2. Latest snapshot summary
    db.query(`
      WITH latest AS (
        SELECT MAX(snapshot_date) as max_date FROM project_snapshots WHERE tenant_id = $1
      )
      SELECT
        COALESCE(SUM(ps.contract_amount), 0) as total_contract_value,
        COALESCE(SUM(ps.gross_profit_dollars), 0) as total_gross_profit,
        COALESCE(SUM(ps.earned_revenue), 0) as total_earned_revenue,
        COALESCE(SUM(ps.cash_flow), 0) as total_cash_flow,
        CASE WHEN SUM(ps.projected_revenue) > 0
          THEN SUM(ps.gross_profit_dollars) / SUM(ps.projected_revenue) * 100
          ELSE 0 END as avg_gm_pct,
        (SELECT max_date FROM latest) as snapshot_date
      FROM project_snapshots ps, latest
      WHERE ps.tenant_id = $1 AND ps.snapshot_date = latest.max_date
    `, [tenantId]),

    // 3. Backlog by market
    db.query(`
      SELECT
        COALESCE(p.market, 'Other') as market,
        COALESCE(SUM(
          CASE
            WHEN p.status IN ('completed','cancelled','Hard-Closed') THEN 0
            WHEN vc.id IS NOT NULL THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
            ELSE GREATEST(COALESCE(p.backlog,0), 0)
          END
        ), 0) as backlog
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.status NOT IN ('completed','cancelled','Hard-Closed')
      GROUP BY market
      HAVING COALESCE(SUM(
        CASE
          WHEN vc.id IS NOT NULL THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
          ELSE GREATEST(COALESCE(p.backlog,0), 0)
        END
      ), 0) > 0
      ORDER BY backlog DESC
      LIMIT 10
    `, [tenantId]),

    // 4. Opportunities by stage
    db.query(`
      SELECT
        ps.name as stage_name,
        ps.color as stage_color,
        COUNT(o.id)::int as count,
        COALESCE(SUM(o.estimated_value), 0) as total_value,
        COALESCE(SUM(
          o.estimated_value * CASE LOWER(COALESCE(o.priority, ''))
            WHEN 'high'   THEN 0.80
            WHEN 'medium' THEN 0.40
            WHEN 'low'    THEN 0.15
            ELSE 0.25
          END
        ), 0) as weighted_value
      FROM pipeline_stages ps
      LEFT JOIN opportunities o ON o.stage_id = ps.id AND o.tenant_id = $1 AND o.estimated_value > 0
      WHERE ps.tenant_id = $1 AND ps.is_active = true
      GROUP BY ps.id, ps.name, ps.color, ps.display_order
      ORDER BY ps.display_order
    `, [tenantId]),

    // 5. Opportunities by market
    db.query(`
      SELECT
        COALESCE(o.market, 'Other') as market,
        COUNT(*)::int as count,
        COALESCE(SUM(o.estimated_value), 0) as total_value
      FROM opportunities o
      JOIN pipeline_stages ps ON o.stage_id = ps.id AND ps.tenant_id = $1 AND ps.is_active = true
      WHERE o.tenant_id = $1 AND COALESCE(o.estimated_value, 0) > 0
      GROUP BY market
      ORDER BY total_value DESC
      LIMIT 10
    `, [tenantId]),

    // 6. Project status distribution
    db.query(`
      SELECT status, COUNT(*)::int as count
      FROM projects WHERE tenant_id = $1
      GROUP BY status ORDER BY count DESC
    `, [tenantId]),

    // 7. Department breakdown (projects with a department assigned)
    db.query(`
      SELECT
        d.department_number,
        d.name as group_name,
        COUNT(DISTINCT p.id)::int as project_count,
        COALESCE(SUM(
          CASE
            WHEN vc.id IS NOT NULL THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
            ELSE GREATEST(COALESCE(p.backlog,0), 0)
          END
        ), 0) as backlog,
        CASE WHEN SUM(ps.projected_revenue) > 0
          THEN SUM(ps.gross_profit_dollars) / SUM(ps.projected_revenue) * 100
          ELSE 0 END as gm_pct,
        COALESCE(SUM(ps.gross_profit_dollars), 0) as gross_profit
      FROM projects p
      JOIN departments d ON d.id = p.department_id AND d.tenant_id = $1
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      LEFT JOIN project_snapshots ps ON ps.project_id = p.id AND ps.tenant_id = $1
        AND ps.snapshot_date = (SELECT MAX(snapshot_date) FROM project_snapshots WHERE tenant_id = $1)
      WHERE p.tenant_id = $1 AND p.status NOT IN ('completed','cancelled','Hard-Closed')
      GROUP BY d.department_number, d.name
      ORDER BY backlog DESC LIMIT 20
    `, [tenantId]),

    // 8. Labor summary (current headcount from Labor Board)
    ProjectAssignment.summary(tenantId),

    // 9. Vista contracts for backlog 6/12mo projection
    VistaData.getAllContracts({ status: '' }, tenantId),

    // 10. Vista-based labor forecast (same source as the Labor Forecast page)
    buildLaborForecastData(tenantId, { timeHorizon: 18 }),

    // 11. GM% trend — latest snapshot per month for the past 6 months
    db.query(`
      WITH monthly_latest AS (
        SELECT
          date_trunc('month', snapshot_date) AS month_start,
          MAX(snapshot_date) AS latest_date
        FROM project_snapshots
        WHERE tenant_id = $1
          AND snapshot_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY date_trunc('month', snapshot_date)
      )
      SELECT
        TO_CHAR(ml.month_start, 'Mon ''YY') AS month_label,
        ml.month_start::date AS month_date,
        CASE WHEN SUM(ps.projected_revenue) > 0
          THEN ROUND((SUM(ps.gross_profit_dollars) / SUM(ps.projected_revenue) * 100)::numeric, 2)
          ELSE 0 END AS gm_pct
      FROM monthly_latest ml
      JOIN project_snapshots ps ON ps.tenant_id = $1 AND ps.snapshot_date = ml.latest_date
      GROUP BY ml.month_start
      ORDER BY ml.month_start
    `, [tenantId]),

    // 12. Financial health — open/soft-closed projects only, from Vista contracts
    db.query(`
      SELECT
        COALESCE(SUM(vc.open_receivables), 0) as total_open_receivables,
        COUNT(*) FILTER (WHERE vc.cash_flow > 0)::int as positive_cf_count,
        COUNT(*)::int as active_linked_count,
        CASE WHEN SUM(
          CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) IS NOT NULL
                    AND GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0) > 0
               THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
               ELSE 0 END
        ) > 0
        THEN SUM(
          CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) IS NOT NULL
                    AND GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0) > 0
               THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
                    * COALESCE(vc.gross_profit_percent, p.gross_margin_percent)
               ELSE 0 END
        ) / NULLIF(SUM(
          CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) IS NOT NULL
                    AND GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0) > 0
               THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
               ELSE 0 END
        ), 0) * 100
        ELSE 0 END as backlog_gm_pct,
        COUNT(*) FILTER (
          WHERE vc.projected_cost > 0
            AND (vc.actual_cost / vc.projected_cost) > 0.15
            AND vc.cash_flow > 0
        )::int as cf_positive_over15_count,
        COUNT(*) FILTER (
          WHERE vc.projected_cost > 0
            AND (vc.actual_cost / vc.projected_cost) > 0.15
        )::int as over15_count
      FROM projects p
      JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.status IN ('Open', 'Soft-Closed')
    `, [tenantId]),

    // 13. Avg % complete when projects first turned cash-flow positive (all-time, from snapshots)
    db.query(`
      WITH first_positive AS (
        SELECT DISTINCT ON (ps.project_id)
          ps.project_id,
          ps.percent_complete
        FROM project_snapshots ps
        WHERE ps.cash_flow > 0
          AND ps.tenant_id = $1
          AND ps.percent_complete IS NOT NULL
        ORDER BY ps.project_id, ps.snapshot_date ASC
      )
      SELECT
        COUNT(*)::int as projects_that_turned_positive,
        COALESCE(AVG(percent_complete) * 100, 0) as avg_pct_at_first_positive
      FROM first_positive
    `, [tenantId]),

    // 14. Market breakdown (all active projects grouped by market)
    db.query(`
      SELECT
        COALESCE(p.market, 'Other') as market,
        COUNT(DISTINCT p.id)::int as project_count,
        COALESCE(SUM(
          CASE
            WHEN vc.id IS NOT NULL THEN GREATEST(COALESCE(vc.backlog,0) + COALESCE(vc.ipd_amount,0), 0)
            ELSE GREATEST(COALESCE(p.backlog,0), 0)
          END
        ), 0) as backlog,
        CASE WHEN SUM(ps.projected_revenue) > 0
          THEN SUM(ps.gross_profit_dollars) / SUM(ps.projected_revenue) * 100
          ELSE 0 END as gm_pct,
        COALESCE(SUM(ps.gross_profit_dollars), 0) as gross_profit
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      LEFT JOIN project_snapshots ps ON ps.project_id = p.id AND ps.tenant_id = $1
        AND ps.snapshot_date = (SELECT MAX(snapshot_date) FROM project_snapshots WHERE tenant_id = $1)
      WHERE p.tenant_id = $1 AND p.status NOT IN ('completed','cancelled','Hard-Closed')
      GROUP BY COALESCE(p.market, 'Other')
      ORDER BY backlog DESC LIMIT 20
    `, [tenantId]),
  ]);

  // Compute backlog 6mo/12mo using existing utility
  const snapshot = calcBacklogSnapshot(contracts);
  const liveStats = liveProjectsResult.rows[0] || {};
  const snapshotSummary = snapshotSummaryResult.rows[0] || {};
  const totalBacklog = num(liveStats.total_backlog);

  const vpBacklog = contracts.reduce((s, c) => {
    const st = (c.status || '').toLowerCase();
    if (!st.includes('open') && !st.includes('soft')) return s;
    return s + (parseFloat(c.backlog) || 0);
  }, 0);
  const nonVpBacklog = Math.max(0, totalBacklog - vpBacklog);

  const oppsTotalValue = oppsByStageResult.rows.reduce((s, r) => s + num(r.total_value), 0);
  const oppsWeightedValue = oppsByStageResult.rows.reduce((s, r) => s + num(r.weighted_value), 0);
  const oppsTotalCount = oppsByStageResult.rows.reduce((s, r) => s + (r.count || 0), 0);

  // Convert Vista-based labor forecast (hours) into headcount using 173 hrs/person/month
  const HRS_PER_PERSON = 173;
  const { columns: laborColumns, columnTotals } = laborForecastRaw;

  const byMonth = laborColumns.map((col, i) => {
    const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
    return {
      month_key: col.key,
      month_label: col.label,
      month_offset: i,
      total_headcount: Math.round(ct.total / HRS_PER_PERSON),
      pf: Math.round(ct.pf / HRS_PER_PERSON),
      sm: Math.round(ct.sm / HRS_PER_PERSON),
      pl: Math.round(ct.pl / HRS_PER_PERSON),
    };
  });

  const TRADE_LABELS = { pf: 'Pipefitter', sm: 'Sheet Metal', pl: 'Plumber' };
  const byTrade = ['sm', 'pf', 'pl'].map(key => {
    const slice = (from, to) => laborColumns.slice(from, to)
      .map(col => Math.round((columnTotals.get(col.key)?.[key] || 0) / HRS_PER_PERSON));
    const h6 = Math.max(0, ...slice(0, 6));
    const h12 = Math.max(0, ...slice(6, 12));
    const h18 = Math.max(0, ...slice(12, 18));
    return { trade: TRADE_LABELS[key], h6, h12, h18 };
  }).filter(t => t.h6 > 0 || t.h12 > 0 || t.h18 > 0);

  const h6Headcount = Math.max(0, ...byMonth.filter(r => r.month_offset < 6).map(r => r.total_headcount));
  const h12Headcount = Math.max(0, ...byMonth.filter(r => r.month_offset >= 6 && r.month_offset < 12).map(r => r.total_headcount));
  const h18Headcount = Math.max(0, ...byMonth.filter(r => r.month_offset >= 12).map(r => r.total_headcount));

  const finHealth = financialHealthResult.rows[0] || {};
  const cfMetrics = cfMetricsResult.rows[0] || {};

  return {
    as_of: snapshotSummary.snapshot_date,
    kpis: {
      active_projects: num(liveStats.active_projects),
      total_backlog: totalBacklog,
      backlog_6mo: snapshot.backlog_6mo + nonVpBacklog,
      backlog_12mo: snapshot.backlog_12mo + nonVpBacklog,
      total_contract_value: num(snapshotSummary.total_contract_value),
      total_gross_profit: num(snapshotSummary.total_gross_profit),
      avg_gm_pct: num(snapshotSummary.avg_gm_pct),
      total_cash_flow: num(snapshotSummary.total_cash_flow),
      total_open_receivables: num(finHealth.total_open_receivables),
      positive_cf_count: parseInt(finHealth.positive_cf_count) || 0,
      active_linked_count: parseInt(finHealth.active_linked_count) || 0,
      backlog_gm_pct: num(finHealth.backlog_gm_pct),
      cf_positive_over15_count: parseInt(finHealth.cf_positive_over15_count) || 0,
      over15_count: parseInt(finHealth.over15_count) || 0,
      avg_pct_at_first_positive: num(cfMetrics.avg_pct_at_first_positive),
      projects_that_turned_positive: parseInt(cfMetrics.projects_that_turned_positive) || 0,
      total_pipeline_value: oppsTotalValue,
      weighted_pipeline: oppsWeightedValue,
      total_opps_count: oppsTotalCount,
    },
    backlog_by_market: backlogByMarketResult.rows,
    opps_by_stage: oppsByStageResult.rows,
    opps_by_market: oppsByMarketResult.rows,
    gm_trend: gmTrendResult.rows,
    dept_breakdown: deptBreakdownResult.rows,
    market_breakdown: marketBreakdownResult.rows,
    labor_summary: laborSummary,
    labor_forecast: {
      by_month: byMonth,
      by_trade: byTrade,
      horizons: { h6: h6Headcount, h12: h12Headcount, h18: h18Headcount },
    },
  };
}

// GET /api/reports/company-health
router.get('/', async (req, res) => {
  try {
    const data = await buildData(req.tenantId);
    res.json(data);
  } catch (error) {
    console.error('Error building company health data:', error);
    res.status(500).json({ error: 'Failed to build company health data' });
  }
});

// POST /api/reports/company-health/pdf-download
// Body: { narrative?, rolling12? } — optional AI narrative + rolling12 chart data
router.post('/pdf-download', async (req, res) => {
  try {
    const narrative     = req.body?.narrative     ?? null;
    const rolling12     = req.body?.rolling12     ?? null;
    const pmWorkload    = req.body?.pmWorkload    ?? null;
    const backlogAnalysis = req.body?.backlogAnalysis ?? null;
    const data = await buildData(req.tenantId);
    const pdfBuffer = await generateCompanyHealthPdfBuffer(data, narrative, rolling12, pmWorkload, backlogAnalysis);
    const dateStr = data.as_of
      ? new Date(data.as_of).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Company-Health-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating company health PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// POST /api/reports/company-health/narrative
router.post('/narrative', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI narrative unavailable — ANTHROPIC_API_KEY not set' });
  }

  const { kpis, backlog_by_market, market_breakdown, opps_by_stage, dept_breakdown, labor_forecast, rolling12, pmWorkload, cashFlowSummary, backlogAnalysis } = req.body;

  const fmt$ = (n) => {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${Math.round(v)}`;
  };
  const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

  const topMarkets = (backlog_by_market || []).slice(0, 3).map(m => `${m.market} (${fmt$(m.backlog)})`).join(', ');
  const topStages = (opps_by_stage || []).filter(s => s.count > 0).map(s => `${s.stage_name}: ${s.count} opps ${fmt$(s.total_value)}`).join('; ');
  const topDepts = (dept_breakdown || []).slice(0, 5).map(d => `${d.department_number ? d.department_number + ' ' : ''}${d.group_name}: ${fmt$(d.backlog)} backlog, ${fmtPct(d.gm_pct)} GM`).join('; ');
  const topMarketsFull = (market_breakdown || []).slice(0, 5).map(m => `${m.market}: ${fmt$(m.backlog)} backlog, ${fmt$(m.gross_profit)} GP, ${fmtPct(m.gm_pct)} GM`).join('; ');
  const laborH6 = labor_forecast?.horizons?.h6 ?? 0;
  const laborH12 = labor_forecast?.horizons?.h12 ?? 0;
  const laborH18 = labor_forecast?.horizons?.h18 ?? 0;
  const topTrades = (labor_forecast?.by_trade || []).slice(0, 4).map(t => `${t.trade}: ${t.h6}/${t.h12}/${t.h18}`).join(', ');

  // Rolling 12 totals
  const r12Secured = rolling12 ? Object.values(rolling12.secured || {}).reduce((s, v) => s + (Number(v) || 0), 0) : null;
  const r12Awarded = rolling12 ? Object.values(rolling12.awarded || {}).reduce((s, v) => s + (Number(v) || 0), 0) : null;
  const r12Pursuits = rolling12 ? Object.values(rolling12.pursuits || {}).reduce((s, v) => s + (Number(v) || 0), 0) : null;

  // PM workload
  const pmOverloaded = pmWorkload?.attention?.overloaded?.length ?? 0;
  const pmSideways = pmWorkload?.attention?.sideways?.length ?? 0;
  const pmTotal = pmWorkload?.pms?.length ?? 0;

  const backlogGmPct = kpis?.backlog_gm_pct != null ? fmtPct(kpis.backlog_gm_pct) : 'N/A';
  const cfOver15 = kpis?.over15_count > 0
    ? `${kpis.cf_positive_over15_count} of ${kpis.over15_count} (${Math.round(kpis.cf_positive_over15_count / kpis.over15_count * 100)}%)`
    : 'N/A';
  const avgPctCfPlus = kpis?.projects_that_turned_positive > 0
    ? `${Number(kpis.avg_pct_at_first_positive).toFixed(0)}% (${kpis.projects_that_turned_positive} jobs historically)`
    : 'N/A';
  const baGmPct = backlogAnalysis?.totalBacklogRevenue > 0
    ? fmtPct(backlogAnalysis.totalBacklogGM / backlogAnalysis.totalBacklogRevenue * 100)
    : 'N/A';

  const dataText = `Company Health Data — Tweet Garot Mechanical

KPIs:
- Active Projects: ${kpis?.active_projects}
- Total Backlog: ${fmt$(kpis?.total_backlog)}
- Backlog 6-Month Projection: ${fmt$(kpis?.backlog_6mo)}
- Backlog 12-Month Projection: ${fmt$(kpis?.backlog_12mo)}
- Total Contract Value (snapshot): ${fmt$(kpis?.total_contract_value)}
- Total Gross Profit: ${fmt$(kpis?.total_gross_profit)}
- Avg GM%: ${fmtPct(kpis?.avg_gm_pct)}
- GM in Backlog: ${backlogGmPct}
- Total Cash Flow: ${fmt$(kpis?.total_cash_flow)}
- Open Receivables: ${fmt$(kpis?.total_open_receivables)}
- Projects Positive CF: ${cashFlowSummary?.positiveCfCount} of ${cashFlowSummary?.totalProjects}
- CF+ Jobs >15% Complete: ${cfOver15}
- Avg % Complete at First CF+: ${avgPctCfPlus}
- Pipeline Total Value: ${fmt$(kpis?.total_pipeline_value)}
- Weighted Pipeline: ${fmt$(kpis?.weighted_pipeline)}
- Total Opportunities: ${kpis?.total_opps_count}

Backlog by Market: ${topMarkets || 'N/A'}

Pipeline by Stage (total value per stage — includes work already contracted in Vista): ${topStages || 'N/A'}
NOTE: The Awarded/Won stage totals above include opportunities already entered into Vista as jobs. They are NOT all "uncontracted." The only figure for work that is awarded-but-NOT-yet-contracted in Vista is "Sold Not Contracted" in the Backlog Analysis section below.

Rolling 12-Month Revenue:
- Secured: ${r12Secured != null ? fmt$(r12Secured) : 'N/A'}
- Awarded (won pursuits): ${r12Awarded != null ? fmt$(r12Awarded) : 'N/A'}
- Pursuits (weighted): ${r12Pursuits != null ? fmt$(r12Pursuits) : 'N/A'}

Cash Flow Summary:
- Total Cash Flow: ${fmt$(cashFlowSummary?.totalCashFlow)}
- Open Receivables: ${fmt$(cashFlowSummary?.totalReceivables)}
- Projects Positive CF: ${cashFlowSummary?.positiveCfCount} of ${cashFlowSummary?.totalProjects}
- CF+ Jobs >15% Complete: ${cfOver15}

PM Workload: ${pmTotal} PMs tracked — ${pmOverloaded} overloaded, ${pmSideways} at risk, ${pmTotal - pmOverloaded - pmSideways} healthy/available

Department Breakdown: ${topDepts || 'N/A'}

Market Breakdown: ${topMarketsFull || 'N/A'}

Backlog Analysis (FY${backlogAnalysis?.currentFY || ''}):
- Current FY Revenue in Backlog: ${backlogAnalysis ? fmt$(backlogAnalysis.currentFYRevenue) : 'N/A'}
- Future FY Revenue in Backlog: ${backlogAnalysis ? fmt$(backlogAnalysis.futureFYRevenue) : 'N/A'}
- Total Backlog GM$: ${backlogAnalysis ? fmt$(backlogAnalysis.totalBacklogGM) : 'N/A'}
- Backlog GM%: ${baGmPct}
- SGA Coverage: ${backlogAnalysis?.sgaMonthsCovered != null ? `${backlogAnalysis.sgaMonthsCovered.toFixed(1)} months (${fmt$(backlogAnalysis.monthlySgAndA)}/mo)` : 'N/A'}
- Sold Not Contracted (awarded, not in Vista): ${backlogAnalysis ? `${fmt$(backlogAnalysis.backlogSoldNotContracted)} (${backlogAnalysis.awardedNotInVistaCount} opps)` : 'N/A'}
- High Potential Backlog: ${backlogAnalysis ? `${fmt$(backlogAnalysis.highPotentialBacklog)} (${backlogAnalysis.highPotentialCount} opps)` : 'N/A'}

Labor Forecast (peak headcount by horizon):
- 0-6 months: ${laborH6} workers
- 6-12 months: ${laborH12} workers
- 12-18 months: ${laborH18} workers
- By trade (6mo/12mo/18mo): ${topTrades || 'N/A'}
`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      system: `You are Titan, an AI analyst for Tweet Garot Mechanical, a commercial HVAC and plumbing contractor. Generate an executive Company Health narrative. Return ONLY a valid JSON object (no markdown, no extra text) with these exact keys:
- "overview": 2-3 paragraph executive summary of overall company health, leading with the most important insight
- "backlog": 1-2 sentences assessing backlog health, coverage ratio, and forecast
- "pipeline": 1-2 sentences on pipeline strength, stage concentration, and near-term opportunities
- "financial": 1-2 sentences on financial health (GM%, GM in backlog, cash flow position, receivables, the CF+ at >15% completion rate, and the average % complete when projects first turn cash-flow positive)
- "backlogAnalysis": 1-2 sentences on the FY backlog analysis — current/future FY revenue coverage, backlog GM%, SGA coverage months, and the pipeline of sold-not-contracted and high-potential work
- "pmWorkload": 1-2 sentences on PM capacity and any overload signals
- "labor": 1-2 sentences on labor demand and workforce forecast by trade

CRITICAL: Every dollar amount, percentage, and count you write MUST come directly from the data provided. Do NOT calculate, estimate, combine, or extrapolate numbers. If a number is not explicitly in the data, do not include it. Use the exact figures as given — do not round differently or substitute related figures.
CRITICAL: Do NOT describe the Pipeline by Stage "Awarded" or "Won" totals as "uncontracted," "not yet contracted," or "pending contract." Those totals include work already contracted in Vista. The ONLY correct figure for awarded-but-not-yet-contracted work is the "Sold Not Contracted" value in the Backlog Analysis section (e.g. $12.2M / 5 opps). Use that figure when discussing uncontracted awarded work.
Speak as a trusted advisor. Flag risks clearly.`,
      messages: [{ role: 'user', content: dataText }],
    });

    const text = response.content[0].text.trim();
    // Strip markdown code fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const narrative = JSON.parse(clean);
    res.json({ narrative, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error generating company health narrative:', error);
    res.status(500).json({ error: 'Failed to generate narrative', detail: error.message });
  }
});

module.exports = router;
