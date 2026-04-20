/**
 * Generate HTML for Cash Flow Report PDF (server-side, Puppeteer)
 */

const fmtCurrency = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtCurrencyShort = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtPercent = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Math.round(Number(v) * 100)}%`;
};

/**
 * Build per-PM aggregated stats from project rows
 */
function buildPmStats(projects, metrics) {
  const pmMap = {};

  // Build lookup: project_id → percent_complete when first went CF+
  const pctAtPositiveMap = {};
  if (metrics && metrics.per_project) {
    metrics.per_project.forEach(pp => {
      pctAtPositiveMap[pp.project_id] = pp.percent_complete_at_positive;
    });
  }

  projects.forEach(p => {
    const name = p.manager_name || 'Unassigned';
    if (!pmMap[name]) {
      pmMap[name] = {
        name,
        projects: [],
        contractValue: 0,
        earnedRevenue: 0,
        billedAmount: 0,
        receivedAmount: 0,
        openReceivables: 0,
        cashFlow: 0,
        backlog: 0,
        positiveCfCount: 0,
        jobsOver15: 0,
        jobsOver15Positive: 0,
      };
    }
    const pm = pmMap[name];
    pm.projects.push(p);
    pm.contractValue += Number(p.contract_value) || 0;
    pm.earnedRevenue += Number(p.earned_revenue) || 0;
    pm.billedAmount += Number(p.billed_amount) || 0;
    pm.receivedAmount += Number(p.received_amount) || 0;
    pm.openReceivables += Number(p.open_receivables) || 0;
    pm.cashFlow += Number(p.cash_flow) || 0;
    pm.backlog += Number(p.backlog) || 0;

    const cf = Number(p.cash_flow) || 0;
    const pct = Number(p.percent_complete) || 0;
    if (cf > 0) pm.positiveCfCount++;
    if (pct > 0.15) {
      pm.jobsOver15++;
      if (cf > 0) pm.jobsOver15Positive++;
    }
  });

  // Compute weighted averages and per-PM avg % at CF+ for each PM
  Object.values(pmMap).forEach(pm => {
    const totalCV = pm.contractValue;
    const gmNum = pm.projects.reduce((s, p) => {
      const cv = Number(p.contract_value) || 0;
      const gm = Number(p.gross_profit_percent);
      if (!cv || isNaN(gm)) return s;
      return s + cv * gm;
    }, 0);
    pm.avgGm = totalCV > 0 ? gmNum / totalCV : 0;

    const pctNum = pm.projects.reduce((s, p) => {
      const cv = Number(p.contract_value) || 0;
      const pct = Number(p.percent_complete);
      if (!cv || isNaN(pct)) return s;
      return s + cv * pct;
    }, 0);
    const pctDen = pm.projects.reduce((s, p) => {
      const cv = Number(p.contract_value) || 0;
      const pct = Number(p.percent_complete);
      if (!cv || isNaN(pct)) return s;
      return s + cv;
    }, 0);
    pm.avgPctComplete = pctDen > 0 ? pctNum / pctDen : 0;

    // Per-PM: CF+ >15% comp
    pm.over15Pct = pm.jobsOver15 > 0
      ? Math.round((pm.jobsOver15Positive / pm.jobsOver15) * 100)
      : 0;

    // Per-PM: avg % complete at first positive cash flow
    const positiveEntries = pm.projects
      .filter(p => pctAtPositiveMap[p.id] !== undefined)
      .map(p => pctAtPositiveMap[p.id]);
    pm.avgPctAtPositive = positiveEntries.length > 0
      ? positiveEntries.reduce((s, v) => s + v, 0) / positiveEntries.length
      : 0;
    pm.projectsTurnedPositive = positiveEntries.length;
  });

  // Sort by worst cash flow first
  return Object.values(pmMap).sort((a, b) => a.cashFlow - b.cashFlow);
}

/**
 * Generate the cover page HTML with team totals and per-PM breakdown
 */
function generateCoverPageHtml(projects, filters, scheduleName, metrics) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Team totals
  const totals = {
    contractValue: 0, earnedRevenue: 0, billedAmount: 0, receivedAmount: 0,
    openReceivables: 0, cashFlow: 0, backlog: 0,
  };
  let positiveCashFlowCount = 0;
  let jobsOver15 = 0;
  let jobsOver15Positive = 0;

  projects.forEach(p => {
    totals.contractValue += Number(p.contract_value) || 0;
    totals.earnedRevenue += Number(p.earned_revenue) || 0;
    totals.billedAmount += Number(p.billed_amount) || 0;
    totals.receivedAmount += Number(p.received_amount) || 0;
    totals.openReceivables += Number(p.open_receivables) || 0;
    totals.cashFlow += Number(p.cash_flow) || 0;
    totals.backlog += Number(p.backlog) || 0;
    const cf = Number(p.cash_flow) || 0;
    const pct = Number(p.percent_complete) || 0;
    if (cf > 0) positiveCashFlowCount++;
    if (pct > 0.15) {
      jobsOver15++;
      if (cf > 0) jobsOver15Positive++;
    }
  });

  const positivePct = projects.length > 0 ? Math.round((positiveCashFlowCount / projects.length) * 100) : 0;
  const over15Pct = jobsOver15 > 0 ? Math.round((jobsOver15Positive / jobsOver15) * 100) : 0;
  const avgPctPositiveDisplay = metrics ? Math.round((metrics.avg_pct_at_first_positive || 0) * 100) : 0;
  const projectsTurnedPositiveCount = metrics ? (metrics.projects_that_turned_positive || 0) : 0;

  // Filter labels
  const filterLabels = [];
  if (filters.status && filters.status !== 'all') filterLabels.push(`Status: ${filters.status}`);
  if (filters.pm && filters.pm !== 'all') filterLabels.push(`PM: ${filters.pm}`);
  if (filters.department && filters.department !== 'all') filterLabels.push(`Dept: ${filters.department}`);
  if (filters.market && filters.market !== 'all') filterLabels.push(`Market: ${filters.market}`);
  if (filters.teamName) filterLabels.push(`Team: ${filters.teamName}`);
  else if (filters.team) filterLabels.push(`Team: ${filters.team}`);
  if (filters.search) filterLabels.push(`Search: "${filters.search}"`);
  const filterStr = filterLabels.length > 0 ? `Filters: ${filterLabels.join('  |  ')}` : '';

  // Per-PM stats
  const pmStats = buildPmStats(projects, metrics);

  // Determine worst cash flow for bar scaling
  const maxAbsCf = Math.max(...pmStats.map(pm => Math.abs(pm.cashFlow)), 1);

  // KPI card helper (larger for cover page)
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px 14px; min-width: 0;">
      <div style="font-size: 7pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.04em;">${label}</div>
      <div style="font-size: 14pt; font-weight: 700; color: ${valueColor}; white-space: nowrap; margin-top: 2px;">${value}</div>
    </div>`;

  // PM scorecard rows
  const fs = '8.5pt';
  const cp = '6px 7px';
  const pmRows = pmStats.map((pm, i) => {
    const cf = pm.cashFlow;
    const cfColor = cf > 0 ? '#059669' : cf < 0 ? '#dc2626' : '#64748b';
    const posCfPct = pm.projects.length > 0 ? Math.round((pm.positiveCfCount / pm.projects.length) * 100) : 0;
    const barWidth = Math.round((Math.abs(cf) / maxAbsCf) * 100);
    const barColor = cf >= 0 ? '#059669' : '#dc2626';
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const o15Pct = pm.over15Pct;
    const avgCfPct = Math.round(pm.avgPctAtPositive * 100);

    return `
      <tr style="background: ${bgColor};">
        <td style="padding: ${cp}; font-size: ${fs}; font-weight: 600; color: #1e293b; white-space: nowrap;">${pm.name}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center; color: #334155;">${pm.projects.length}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right; font-weight: 500;">${fmtCurrencyShort(pm.contractValue)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.earnedRevenue)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.billedAmount)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.receivedAmount)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right; color: ${Number(pm.openReceivables) > 0 ? '#d97706' : '#1f2937'};">${fmtCurrencyShort(pm.openReceivables)}</td>
        <td style="padding: 6px 5px; font-size: ${fs}; text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
            <div style="width: 50px; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; flex-shrink: 0;">
              <div style="height: 100%; width: ${barWidth}%; background: ${barColor}; border-radius: 4px; ${cf < 0 ? 'margin-left: auto;' : ''}"></div>
            </div>
            <span style="font-weight: 700; color: ${cfColor}; white-space: nowrap; min-width: 60px; text-align: right;">${fmtCurrencyShort(cf)}</span>
          </div>
        </td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center;">
          <span style="padding: 1px 6px; border-radius: 9999px; font-weight: 600; font-size: 7.5pt;
            background: ${posCfPct >= 50 ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)'};
            color: ${posCfPct >= 50 ? '#059669' : '#dc2626'};">
            ${pm.positiveCfCount}/${pm.projects.length} (${posCfPct}%)
          </span>
        </td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center;">
          <span style="padding: 1px 6px; border-radius: 9999px; font-weight: 600; font-size: 7.5pt;
            background: ${o15Pct >= 60 ? 'rgba(5,150,105,0.1)' : o15Pct >= 40 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)'};
            color: ${o15Pct >= 60 ? '#059669' : o15Pct >= 40 ? '#d97706' : '#dc2626'};">
            ${pm.jobsOver15Positive}/${pm.jobsOver15} (${o15Pct}%)
          </span>
        </td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: center; color: #7c3aed; font-weight: 600;">${avgCfPct > 0 ? `${avgCfPct}%` : '-'}
          ${pm.projectsTurnedPositive > 0 ? `<div style="font-size: 6.5pt; color: #94a3b8; font-weight: 400;">(${pm.projectsTurnedPositive} jobs)</div>` : ''}
        </td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right; font-weight: 600; color: ${pm.avgGm > 0 ? '#059669' : pm.avgGm < 0 ? '#dc2626' : '#64748b'};">${fmtPercent(pm.avgGm)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtPercent(pm.avgPctComplete)}</td>
        <td style="padding: ${cp}; font-size: ${fs}; text-align: right;">${fmtCurrencyShort(pm.backlog)}</td>
      </tr>`;
  }).join('');

  // Team totals weighted averages
  const totalCV = totals.contractValue;
  const gmNumerator = projects.reduce((s, p) => {
    const cv = Number(p.contract_value) || 0;
    const gm = Number(p.gross_profit_percent);
    if (!cv || isNaN(gm)) return s;
    return s + cv * gm;
  }, 0);
  const avgGm = totalCV > 0 ? gmNumerator / totalCV : 0;
  const pctNumerator = projects.reduce((s, p) => {
    const cv = Number(p.contract_value) || 0;
    const pct = Number(p.percent_complete);
    if (!cv || isNaN(pct)) return s;
    return s + cv * pct;
  }, 0);
  const pctDenominator = projects.reduce((s, p) => {
    const cv = Number(p.contract_value) || 0;
    const pct = Number(p.percent_complete);
    if (!cv || isNaN(pct)) return s;
    return s + cv;
  }, 0);
  const avgPctComplete = pctDenominator > 0 ? pctNumerator / pctDenominator : 0;

  return `
  <!-- COVER PAGE -->
  <div style="page-break-after: always;">
    <!-- Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px; border-bottom: 3px solid #002356; padding-bottom: 10px;">
      <div>
        <div style="font-size: 22pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">CASH FLOW REPORT</div>
        ${scheduleName ? `<div style="font-size: 11pt; font-weight: 600; color: #475569; margin-top: 2px;">${scheduleName}</div>` : ''}
        <div style="font-size: 10pt; color: #6b7280; margin-top: 2px;">Generated ${dateLabel}</div>
        ${filterStr ? `<div style="font-size: 8.5pt; color: #6b7280; margin-top: 2px;">${filterStr}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 9pt; color: #6b7280;">${projects.length} project${projects.length !== 1 ? 's' : ''}</div>
        <div style="font-size: 8pt; color: #94a3b8;">${pmStats.length} project manager${pmStats.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <!-- Section: Team Summary -->
    <div style="margin-bottom: 16px;">
      <div style="font-size: 10pt; font-weight: 700; color: #002356; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;">
        Team Summary
      </div>

      <!-- KPI Row 1: Financial totals -->
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        ${kpiCard('Projects', String(projects.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
        ${kpiCard('Contract Value', fmtCurrencyShort(totals.contractValue), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
        ${kpiCard('Earned Revenue', fmtCurrencyShort(totals.earnedRevenue), '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
        ${kpiCard('Total Billed', fmtCurrencyShort(totals.billedAmount), '#fffbeb', '#fde68a', '#92400e', '#d97706')}
        ${kpiCard('Total Received', fmtCurrencyShort(totals.receivedAmount), '#f0fdf4', '#bbf7d0', '#166534', '#059669')}
      </div>

      <!-- KPI Row 2: Cash flow metrics -->
      <div style="display: flex; gap: 8px;">
        ${kpiCard('Open Receivables', fmtCurrencyShort(totals.openReceivables), '#fff7ed', '#fed7aa', '#9a3412', '#ea580c')}
        ${kpiCard('Net Cash Flow', fmtCurrencyShort(totals.cashFlow),
          totals.cashFlow >= 0 ? '#f0fdf4' : '#fef2f2',
          totals.cashFlow >= 0 ? '#bbf7d0' : '#fecaca',
          totals.cashFlow >= 0 ? '#166534' : '#991b1b',
          totals.cashFlow >= 0 ? '#059669' : '#dc2626')}
        ${kpiCard('Positive CF', `${positiveCashFlowCount}/${projects.length} (${positivePct}%)`,
          positivePct >= 50 ? '#ecfeff' : '#fff7ed',
          positivePct >= 50 ? '#a5f3fc' : '#fed7aa',
          positivePct >= 50 ? '#155e75' : '#9a3412',
          positivePct >= 50 ? '#0891b2' : '#ea580c')}
        ${kpiCard('CF+ >15% Comp', `${jobsOver15Positive}/${jobsOver15} (${over15Pct}%)`,
          over15Pct >= 60 ? '#f0fdf4' : over15Pct >= 40 ? '#fffbeb' : '#fef2f2',
          over15Pct >= 60 ? '#bbf7d0' : over15Pct >= 40 ? '#fde68a' : '#fecaca',
          over15Pct >= 60 ? '#166534' : over15Pct >= 40 ? '#92400e' : '#991b1b',
          over15Pct >= 60 ? '#059669' : over15Pct >= 40 ? '#d97706' : '#e11d48')}
        ${kpiCard('Avg % at CF+', `${avgPctPositiveDisplay}% (${projectsTurnedPositiveCount} jobs)`, '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
      </div>
    </div>

    <!-- Section: PM Breakdown -->
    <div>
      <div style="font-size: 10pt; font-weight: 700; color: #002356; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; padding-left: 2px;">
        Project Manager Breakdown
        <span style="font-size: 8pt; font-weight: 400; color: #94a3b8; text-transform: none; letter-spacing: normal; margin-left: 8px;">Sorted by cash flow (worst first)</span>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em;">PM</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">Jobs</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Contract</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Earned</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Billed</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Received</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Open AR</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Cash Flow</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">Positive CF</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">CF+ &gt;15%</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.05em;">Avg % at CF+</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">GM%</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">% Comp</th>
            <th style="background: #002356; color: white; font-size: 7.5pt; font-weight: 600; padding: 7px 10px; text-align: right; text-transform: uppercase; letter-spacing: 0.05em;">Backlog</th>
          </tr>
        </thead>
        <tbody>
          ${pmRows}
        </tbody>
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
            <td style="padding: 8px 10px; font-size: 9pt; font-weight: 700; color: #334155;">Team Totals</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: center; font-weight: 700;">${projects.length}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.contractValue)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.earnedRevenue)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.billedAmount)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.receivedAmount)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700; color: #d97706;">${fmtCurrencyShort(totals.openReceivables)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700; color: ${totals.cashFlow >= 0 ? '#059669' : '#dc2626'};">${fmtCurrencyShort(totals.cashFlow)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: center; font-weight: 700;">
              <span style="color: ${positivePct >= 50 ? '#059669' : '#dc2626'};">${positiveCashFlowCount}/${projects.length} (${positivePct}%)</span>
            </td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: center; font-weight: 700;">
              <span style="color: ${over15Pct >= 60 ? '#059669' : over15Pct >= 40 ? '#d97706' : '#dc2626'};">${jobsOver15Positive}/${jobsOver15} (${over15Pct}%)</span>
            </td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: center; font-weight: 700; color: #7c3aed;">${avgPctPositiveDisplay > 0 ? `${avgPctPositiveDisplay}%` : '-'}
              ${projectsTurnedPositiveCount > 0 ? `<div style="font-size: 7pt; color: #94a3b8; font-weight: 400;">(${projectsTurnedPositiveCount} jobs)</div>` : ''}
            </td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700; color: ${avgGm > 0 ? '#059669' : avgGm < 0 ? '#dc2626' : '#334155'};">${fmtPercent(avgGm)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtPercent(avgPctComplete)}</td>
            <td style="padding: 8px 10px; font-size: 9pt; text-align: right; font-weight: 700;">${fmtCurrencyShort(totals.backlog)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>`;
}

function generateCashFlowReportPdfHtml(projects, filters = {}, scheduleName = null, metrics = null) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Compute totals & KPI metrics
  const totals = {
    contractValue: 0, earnedRevenue: 0, billedAmount: 0, receivedAmount: 0,
    openReceivables: 0, cashFlow: 0, backlog: 0,
  };

  let positiveCashFlowCount = 0;
  let jobsOver15 = 0;
  let jobsOver15Positive = 0;

  projects.forEach(p => {
    totals.contractValue += Number(p.contract_value) || 0;
    totals.earnedRevenue += Number(p.earned_revenue) || 0;
    totals.billedAmount += Number(p.billed_amount) || 0;
    totals.receivedAmount += Number(p.received_amount) || 0;
    totals.openReceivables += Number(p.open_receivables) || 0;
    totals.cashFlow += Number(p.cash_flow) || 0;
    totals.backlog += Number(p.backlog) || 0;

    const cf = Number(p.cash_flow) || 0;
    const pct = Number(p.percent_complete) || 0;
    if (cf > 0) positiveCashFlowCount++;
    if (pct > 0.15) {
      jobsOver15++;
      if (cf > 0) jobsOver15Positive++;
    }
  });

  // Weighted averages for footer
  const totalCV = totals.contractValue;
  const gmNumerator = projects.reduce((s, p) => {
    const cv = Number(p.contract_value) || 0;
    const gm = Number(p.gross_profit_percent);
    if (!cv || isNaN(gm)) return s;
    return s + cv * gm;
  }, 0);
  const avgGm = totalCV > 0 ? gmNumerator / totalCV : 0;

  const pctNumerator = projects.reduce((s, p) => {
    const cv = Number(p.contract_value) || 0;
    const pct = Number(p.percent_complete);
    if (!cv || isNaN(pct)) return s;
    return s + cv * pct;
  }, 0);
  const pctDenominator = projects.reduce((s, p) => {
    const cv = Number(p.contract_value) || 0;
    const pct = Number(p.percent_complete);
    if (!cv || isNaN(pct)) return s;
    return s + cv;
  }, 0);
  const avgPctComplete = pctDenominator > 0 ? pctNumerator / pctDenominator : 0;

  const positivePct = projects.length > 0 ? Math.round((positiveCashFlowCount / projects.length) * 100) : 0;
  const over15Pct = jobsOver15 > 0 ? Math.round((jobsOver15Positive / jobsOver15) * 100) : 0;

  // Snapshot-based: avg % complete when projects first went cash-flow positive
  const avgPctPositiveDisplay = metrics ? Math.round((metrics.avg_pct_at_first_positive || 0) * 100) : 0;
  const projectsTurnedPositiveCount = metrics ? (metrics.projects_that_turned_positive || 0) : 0;

  // Active filter labels
  const filterLabels = [];
  if (filters.status && filters.status !== 'all') filterLabels.push(`Status: ${filters.status}`);
  if (filters.pm && filters.pm !== 'all') filterLabels.push(`PM: ${filters.pm}`);
  if (filters.department && filters.department !== 'all') filterLabels.push(`Dept: ${filters.department}`);
  if (filters.market && filters.market !== 'all') filterLabels.push(`Market: ${filters.market}`);
  if (filters.teamName) filterLabels.push(`Team: ${filters.teamName}`);
  else if (filters.team) filterLabels.push(`Team: ${filters.team}`);
  if (filters.search) filterLabels.push(`Search: "${filters.search}"`);

  const filterStr = filterLabels.length > 0
    ? `Filters: ${filterLabels.join('  |  ')}`
    : '';

  const rows = projects.map((p, i) => {
    const cf = Number(p.cash_flow) || 0;
    const gm = Number(p.gross_profit_percent);
    const pct = Number(p.percent_complete) || 0;
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="background: ${bgColor};">
        <td style="padding: 4px 6px; font-size: 7.5pt; color: #475569;">${p.number || ''}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt;">
          <div style="font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${p.name || ''}</div>
        </td>
        <td style="padding: 4px 6px; font-size: 7pt; color: #64748b;">${p.manager_name || '-'}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right; font-weight: 500;">${fmtCurrency(p.contract_value)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.earned_revenue)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.billed_amount)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.received_amount)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right; color: ${Number(p.open_receivables) > 0 ? '#d97706' : '#1f2937'};">${fmtCurrency(p.open_receivables)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right; font-weight: 600; color: ${cf > 0 ? '#059669' : cf < 0 ? '#dc2626' : '#64748b'};">${fmtCurrency(p.cash_flow)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${pct ? `${Math.round(pct * 100)}%` : '-'}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right; font-weight: 600; color: ${!isNaN(gm) ? (gm > 0 ? '#059669' : gm < 0 ? '#dc2626' : '#64748b') : '#94a3b8'};">${fmtPercent(p.gross_profit_percent)}</td>
        <td style="padding: 4px 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(p.backlog)}</td>
        <td style="padding: 4px 6px; font-size: 7pt;">
          <span style="padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 6.5pt;
            background: ${p.status === 'Open' ? 'rgba(16,185,129,0.12)' : p.status === 'Soft-Closed' ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.12)'};
            color: ${p.status === 'Open' ? '#059669' : p.status === 'Soft-Closed' ? '#d97706' : '#6b7280'};">
            ${p.status || '-'}
          </span>
        </td>
      </tr>`;
  }).join('');

  // KPI card helper
  const kpiCard = (label, value, bgColor, borderColor, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 6px 10px; min-width: 0;">
      <div style="font-size: 6.5pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap;">${label}</div>
      <div style="font-size: 11pt; font-weight: 700; color: ${valueColor}; white-space: nowrap;">${value}</div>
    </div>`;

  // Generate cover page (only when multiple PMs present)
  const uniquePMs = new Set(projects.map(p => p.manager_name || 'Unassigned'));
  const coverHtml = uniquePMs.size > 1
    ? generateCoverPageHtml(projects, filters, scheduleName, metrics)
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: landscape Letter; margin: 0.4in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 6px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; }
    th.right { text-align: right; }
  </style>
</head>
<body>
  ${coverHtml}

  <!-- Detail pages header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 3px solid #002356; padding-bottom: 8px;">
    <div>
      <div style="font-size: 18pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">CASH FLOW REPORT</div>
      ${scheduleName ? `<div style="font-size: 10pt; font-weight: 600; color: #475569; margin-top: 1px;">${scheduleName}</div>` : ''}
      <div style="font-size: 9pt; color: #6b7280;">Generated ${dateLabel}</div>
      ${filterStr ? `<div style="font-size: 8pt; color: #6b7280; margin-top: 2px;">${filterStr}</div>` : ''}
    </div>
    <div style="text-align: right; font-size: 8pt; color: #6b7280;">
      ${projects.length} project${projects.length !== 1 ? 's' : ''}<br>
      <span style="font-size: 7pt; color: #94a3b8;">Sorted by Cash Flow (worst first)</span>
    </div>
  </div>

  <!-- KPI Summary Row 1: Financial totals -->
  <div style="display: flex; gap: 6px; margin-bottom: 6px;">
    ${kpiCard('Projects', String(projects.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Contract Value', fmtCurrencyShort(totals.contractValue), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Earned Revenue', fmtCurrencyShort(totals.earnedRevenue), '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
    ${kpiCard('Total Billed', fmtCurrencyShort(totals.billedAmount), '#fffbeb', '#fde68a', '#92400e', '#d97706')}
    ${kpiCard('Total Received', fmtCurrencyShort(totals.receivedAmount), '#f0fdf4', '#bbf7d0', '#166534', '#059669')}
  </div>

  <!-- KPI Summary Row 2: Cash flow metrics -->
  <div style="display: flex; gap: 6px; margin-bottom: 10px;">
    ${kpiCard('Open Receivables', fmtCurrencyShort(totals.openReceivables), '#fff7ed', '#fed7aa', '#9a3412', '#ea580c')}
    ${kpiCard('Net Cash Flow', fmtCurrencyShort(totals.cashFlow),
      totals.cashFlow >= 0 ? '#f0fdf4' : '#fef2f2',
      totals.cashFlow >= 0 ? '#bbf7d0' : '#fecaca',
      totals.cashFlow >= 0 ? '#166534' : '#991b1b',
      totals.cashFlow >= 0 ? '#059669' : '#dc2626')}
    ${kpiCard(`Positive CF`, `${positiveCashFlowCount}/${projects.length} (${positivePct}%)`,
      positivePct >= 50 ? '#ecfeff' : '#fff7ed',
      positivePct >= 50 ? '#a5f3fc' : '#fed7aa',
      positivePct >= 50 ? '#155e75' : '#9a3412',
      positivePct >= 50 ? '#0891b2' : '#ea580c')}
    ${kpiCard(`CF+ >15% Comp`, `${jobsOver15Positive}/${jobsOver15} (${over15Pct}%)`,
      over15Pct >= 60 ? '#f0fdf4' : over15Pct >= 40 ? '#fffbeb' : '#fef2f2',
      over15Pct >= 60 ? '#bbf7d0' : over15Pct >= 40 ? '#fde68a' : '#fecaca',
      over15Pct >= 60 ? '#166534' : over15Pct >= 40 ? '#92400e' : '#991b1b',
      over15Pct >= 60 ? '#059669' : over15Pct >= 40 ? '#d97706' : '#e11d48')}
    ${kpiCard('Avg % at CF+', `${avgPctPositiveDisplay}% (${projectsTurnedPositiveCount} jobs)`, '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th style="width: 4.5%;">#</th>
        <th style="width: 16%;">Project</th>
        <th style="width: 8%;">PM</th>
        <th class="right" style="width: 9%;">Contract</th>
        <th class="right" style="width: 8%;">Earned</th>
        <th class="right" style="width: 7.5%;">Billed</th>
        <th class="right" style="width: 7.5%;">Received</th>
        <th class="right" style="width: 7%;">Open AR</th>
        <th class="right" style="width: 8%;">Cash Flow</th>
        <th class="right" style="width: 5.5%;">% Comp</th>
        <th class="right" style="width: 5%;">GM%</th>
        <th class="right" style="width: 7%;">Backlog</th>
        <th style="width: 5.5%;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
        <td colspan="3" style="padding: 6px; font-size: 7.5pt; text-align: right; color: #334155;">Totals:</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.contractValue)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.earnedRevenue)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.billedAmount)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.receivedAmount)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right; color: #d97706;">${fmtCurrency(totals.openReceivables)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right; font-weight: 700; color: ${totals.cashFlow >= 0 ? '#059669' : '#dc2626'};">${fmtCurrency(totals.cashFlow)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtPercent(avgPctComplete)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right; color: ${avgGm > 0 ? '#059669' : avgGm < 0 ? '#dc2626' : '#334155'};">${fmtPercent(avgGm)}</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right;">${fmtCurrency(totals.backlog)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

module.exports = { generateCashFlowReportPdfHtml };
