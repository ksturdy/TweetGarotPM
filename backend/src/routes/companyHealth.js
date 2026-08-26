const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const ProjectAssignment = require('../models/ProjectAssignment');
const VistaData = require('../models/VistaData');
const { calcBacklogSnapshot } = require('../utils/backlogFitCalculator');
const { generateCompanyHealthPdfBuffer } = require('../utils/companyHealthPdfGenerator');
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
    laborByMonthResult,
    laborByTradeResult,
    laborByGroupResult,
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

    // 7. Department / market breakdown
    db.query(`
      SELECT
        COALESCE(d.name, COALESCE(p.market, 'Other')) as group_name,
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
      LEFT JOIN departments d ON d.id = p.department_id AND d.tenant_id = $1
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      LEFT JOIN project_snapshots ps ON ps.project_id = p.id AND ps.tenant_id = $1
        AND ps.snapshot_date = (SELECT MAX(snapshot_date) FROM project_snapshots WHERE tenant_id = $1)
      WHERE p.tenant_id = $1 AND p.status NOT IN ('completed','cancelled','Hard-Closed')
      GROUP BY COALESCE(d.name, COALESCE(p.market, 'Other'))
      ORDER BY backlog DESC LIMIT 15
    `, [tenantId]),

    // 8. Labor summary (current)
    ProjectAssignment.summary(tenantId),

    // 9. Vista contracts for backlog 6/12mo projection
    VistaData.getAllContracts({ status: '' }, tenantId),

    // 10. Labor headcount by month (18 months)
    db.query(`
      WITH months AS (SELECT generate_series(0, 17) as n)
      SELECT
        TO_CHAR(date_trunc('month', CURRENT_DATE) + (n || ' months')::interval, 'YYYY-MM') as month_key,
        TO_CHAR(date_trunc('month', CURRENT_DATE) + (n || ' months')::interval, 'Mon ''YY') as month_label,
        n::int as month_offset,
        COUNT(DISTINCT pa.employee_id)::int as total_headcount
      FROM months m
      LEFT JOIN project_assignments pa ON
        pa.tenant_id = $1
        AND COALESCE(pa.status, '') NOT IN ('cancelled')
        AND pa.start_date <= (date_trunc('month', CURRENT_DATE) + ((n+1) || ' months')::interval - INTERVAL '1 day')::date
        AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= (date_trunc('month', CURRENT_DATE) + (n || ' months')::interval)::date
      GROUP BY m.n
      ORDER BY m.n
    `, [tenantId]),

    // 11. Labor by trade at 6/12/18 months
    db.query(`
      SELECT trade, h6, h12, h18 FROM (
        SELECT
          COALESCE(NULLIF(TRIM(COALESCE(e.trade, pa.trade)), ''), 'Unassigned') as trade,
          COUNT(DISTINCT pa.employee_id) FILTER (
            WHERE pa.start_date <= CURRENT_DATE + INTERVAL '6 months'
            AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE
          )::int as h6,
          COUNT(DISTINCT pa.employee_id) FILTER (
            WHERE pa.start_date <= CURRENT_DATE + INTERVAL '12 months'
            AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE + INTERVAL '6 months'
          )::int as h12,
          COUNT(DISTINCT pa.employee_id) FILTER (
            WHERE pa.start_date <= CURRENT_DATE + INTERVAL '18 months'
            AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE + INTERVAL '12 months'
          )::int as h18
        FROM project_assignments pa
        LEFT JOIN employees e ON e.id = pa.employee_id AND e.tenant_id = $1
        WHERE pa.tenant_id = $1
          AND COALESCE(pa.status, '') NOT IN ('cancelled')
          AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE
          AND pa.start_date <= CURRENT_DATE + INTERVAL '18 months'
        GROUP BY COALESCE(NULLIF(TRIM(COALESCE(e.trade, pa.trade)), ''), 'Unassigned')
        HAVING (
          COUNT(DISTINCT pa.employee_id) FILTER (WHERE pa.start_date <= CURRENT_DATE + INTERVAL '6 months' AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE) +
          COUNT(DISTINCT pa.employee_id) FILTER (WHERE pa.start_date <= CURRENT_DATE + INTERVAL '12 months' AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE + INTERVAL '6 months') +
          COUNT(DISTINCT pa.employee_id) FILTER (WHERE pa.start_date <= CURRENT_DATE + INTERVAL '18 months' AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE + INTERVAL '12 months')
        ) > 0
      ) sub
      ORDER BY h6 DESC NULLS LAST
      LIMIT 20
    `, [tenantId]),

    // 12. Labor by employee group (shop/field breakdown) at 6/12/18 months
    db.query(`
      SELECT
        COALESCE(NULLIF(TRIM(e.employee_group), ''), 'Other') as emp_group,
        COUNT(DISTINCT pa.employee_id) FILTER (
          WHERE pa.start_date <= CURRENT_DATE + INTERVAL '6 months'
          AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE
        )::int as h6,
        COUNT(DISTINCT pa.employee_id) FILTER (
          WHERE pa.start_date <= CURRENT_DATE + INTERVAL '12 months'
          AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE + INTERVAL '6 months'
        )::int as h12,
        COUNT(DISTINCT pa.employee_id) FILTER (
          WHERE pa.start_date <= CURRENT_DATE + INTERVAL '18 months'
          AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE + INTERVAL '12 months'
        )::int as h18
      FROM project_assignments pa
      LEFT JOIN employees e ON e.id = pa.employee_id AND e.tenant_id = $1
      WHERE pa.tenant_id = $1
        AND COALESCE(pa.status, '') NOT IN ('cancelled')
        AND COALESCE(pa.end_date, CURRENT_DATE + INTERVAL '18 months') >= CURRENT_DATE
        AND pa.start_date <= CURRENT_DATE + INTERVAL '18 months'
      GROUP BY emp_group
      HAVING COUNT(DISTINCT pa.employee_id) > 0
      ORDER BY h6 DESC NULLS LAST
      LIMIT 15
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

  // Compute labor summary horizons from by-month data
  const byMonth = laborByMonthResult.rows;
  const h6Headcount = byMonth.filter(r => r.month_offset < 6).reduce((max, r) => Math.max(max, r.total_headcount), 0);
  const h12Headcount = byMonth.filter(r => r.month_offset >= 6 && r.month_offset < 12).reduce((max, r) => Math.max(max, r.total_headcount), 0);
  const h18Headcount = byMonth.filter(r => r.month_offset >= 12).reduce((max, r) => Math.max(max, r.total_headcount), 0);

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
      total_pipeline_value: oppsTotalValue,
      weighted_pipeline: oppsWeightedValue,
      total_opps_count: oppsTotalCount,
    },
    backlog_by_market: backlogByMarketResult.rows,
    opps_by_stage: oppsByStageResult.rows,
    opps_by_market: oppsByMarketResult.rows,
    project_status_dist: projectStatusResult.rows,
    dept_breakdown: deptBreakdownResult.rows,
    labor_summary: laborSummary,
    labor_forecast: {
      by_month: byMonth,
      by_trade: laborByTradeResult.rows,
      by_group: laborByGroupResult.rows,
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

// GET /api/reports/company-health/pdf-download
router.get('/pdf-download', async (req, res) => {
  try {
    const data = await buildData(req.tenantId);
    const pdfBuffer = await generateCompanyHealthPdfBuffer(data);
    const dateStr = data.as_of
      ? new Date(data.as_of + 'T12:00:00').toISOString().split('T')[0]
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

  const { kpis, backlog_by_market, opps_by_stage, dept_breakdown, labor_forecast, rolling12, pmWorkload, cashFlowSummary } = req.body;

  const fmt$ = (n) => {
    const v = Number(n) || 0;
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
    return `$${Math.round(v)}`;
  };
  const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

  const topMarkets = (backlog_by_market || []).slice(0, 3).map(m => `${m.market} (${fmt$(m.backlog)})`).join(', ');
  const topStages = (opps_by_stage || []).filter(s => s.count > 0).map(s => `${s.stage_name}: ${s.count} opps ${fmt$(s.total_value)}`).join('; ');
  const topDepts = (dept_breakdown || []).slice(0, 5).map(d => `${d.group_name}: ${fmt$(d.backlog)} backlog, ${fmtPct(d.gm_pct)} GM`).join('; ');
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

  const dataText = `Company Health Data — Tweet Garot Mechanical

KPIs:
- Active Projects: ${kpis?.active_projects}
- Total Backlog: ${fmt$(kpis?.total_backlog)}
- Backlog 6-Month Projection: ${fmt$(kpis?.backlog_6mo)}
- Backlog 12-Month Projection: ${fmt$(kpis?.backlog_12mo)}
- Total Contract Value (snapshot): ${fmt$(kpis?.total_contract_value)}
- Total Gross Profit: ${fmt$(kpis?.total_gross_profit)}
- Avg GM%: ${fmtPct(kpis?.avg_gm_pct)}
- Total Cash Flow: ${fmt$(kpis?.total_cash_flow)}
- Pipeline Total Value: ${fmt$(kpis?.total_pipeline_value)}
- Weighted Pipeline: ${fmt$(kpis?.weighted_pipeline)}
- Total Opportunities: ${kpis?.total_opps_count}

Backlog by Market: ${topMarkets || 'N/A'}

Pipeline by Stage: ${topStages || 'N/A'}

Rolling 12-Month Revenue:
- Secured: ${r12Secured != null ? fmt$(r12Secured) : 'N/A'}
- Awarded (won pursuits): ${r12Awarded != null ? fmt$(r12Awarded) : 'N/A'}
- Pursuits (weighted): ${r12Pursuits != null ? fmt$(r12Pursuits) : 'N/A'}

Cash Flow Summary:
- Total Cash Flow: ${fmt$(cashFlowSummary?.totalCashFlow)}
- Open Receivables: ${fmt$(cashFlowSummary?.totalReceivables)}
- Projects Positive CF: ${cashFlowSummary?.positiveCfCount} of ${cashFlowSummary?.totalProjects}

PM Workload: ${pmTotal} PMs tracked — ${pmOverloaded} overloaded, ${pmSideways} at risk, ${pmTotal - pmOverloaded - pmSideways} healthy/available

Department Breakdown: ${topDepts || 'N/A'}

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
- "financial": 1-2 sentences on financial health (GM%, cash flow position, receivables)
- "pmWorkload": 1-2 sentences on PM capacity and any overload signals
- "labor": 1-2 sentences on labor demand and workforce forecast

Be specific with numbers from the data. Speak as a trusted advisor, not a data reader. Flag risks clearly.`,
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
