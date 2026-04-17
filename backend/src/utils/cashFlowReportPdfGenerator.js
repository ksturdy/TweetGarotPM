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
  if (filters.team) filterLabels.push(`Team: ${filters.team}`);
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
  <!-- Header -->
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
