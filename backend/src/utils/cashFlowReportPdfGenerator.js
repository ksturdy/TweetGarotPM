/**
 * Generate HTML for Cash Flow Report PDF (server-side, Puppeteer)
 */

const fmtCurrency = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtPercent = (v) => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Math.round(Number(v) * 100)}%`;
};

function generateCashFlowReportPdfHtml(projects, filters = {}) {
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Compute totals
  const totals = {
    contractValue: 0, earnedRevenue: 0, billedAmount: 0, receivedAmount: 0,
    openReceivables: 0, cashFlow: 0, backlog: 0,
    weightedRevenue: 0, weightedGm: 0, totalProjectedRevenue: 0,
  };

  projects.forEach(p => {
    totals.contractValue += Number(p.contract_value) || 0;
    totals.earnedRevenue += Number(p.earned_revenue) || 0;
    totals.billedAmount += Number(p.billed_amount) || 0;
    totals.receivedAmount += Number(p.received_amount) || 0;
    totals.openReceivables += Number(p.open_receivables) || 0;
    totals.cashFlow += Number(p.cash_flow) || 0;
    totals.backlog += Number(p.backlog) || 0;
    const rev = Number(p.projected_revenue) || 0;
    totals.totalProjectedRevenue += rev;
    totals.weightedRevenue += (Number(p.earned_revenue) || 0);
    totals.weightedGm += (Number(p.gross_profit_percent) || 0) * rev;
  });

  const avgPctComplete = totals.totalProjectedRevenue > 0
    ? totals.weightedRevenue / totals.totalProjectedRevenue
    : 0;
  const avgGm = totals.totalProjectedRevenue > 0
    ? totals.weightedGm / totals.totalProjectedRevenue
    : 0;

  // Active filter labels
  const filterLabels = [];
  if (filters.status && filters.status !== 'all') filterLabels.push(`Status: ${filters.status}`);
  if (filters.pm && filters.pm !== 'all') filterLabels.push(`PM: ${filters.pm}`);
  if (filters.department && filters.department !== 'all') filterLabels.push(`Dept: ${filters.department}`);
  if (filters.market && filters.market !== 'all') filterLabels.push(`Market: ${filters.market}`);
  if (filters.search) filterLabels.push(`Search: "${filters.search}"`);

  const filterStr = filterLabels.length > 0
    ? `<div style="font-size: 8pt; color: #6b7280; margin-top: 2px;">Filters: ${filterLabels.join(' | ')}</div>`
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
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 3px solid #002356; padding-bottom: 8px;">
    <div>
      <div style="font-size: 18pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">CASH FLOW REPORT</div>
      <div style="font-size: 9pt; color: #6b7280;">Generated ${dateLabel}</div>
      ${filterStr}
    </div>
    <div style="text-align: right; font-size: 8pt; color: #6b7280;">
      ${projects.length} project${projects.length !== 1 ? 's' : ''}
    </div>
  </div>

  <!-- KPI Summary -->
  <div style="display: flex; gap: 8px; margin-bottom: 12px;">
    <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px;">
      <div style="font-size: 7pt; color: #0369a1; font-weight: 600; text-transform: uppercase;">Contract Value</div>
      <div style="font-size: 12pt; font-weight: 700; color: #002356;">${fmtCurrency(totals.contractValue)}</div>
    </div>
    <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px;">
      <div style="font-size: 7pt; color: #0369a1; font-weight: 600; text-transform: uppercase;">Total Billed</div>
      <div style="font-size: 12pt; font-weight: 700; color: #002356;">${fmtCurrency(totals.billedAmount)}</div>
    </div>
    <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px;">
      <div style="font-size: 7pt; color: #0369a1; font-weight: 600; text-transform: uppercase;">Total Received</div>
      <div style="font-size: 12pt; font-weight: 700; color: #002356;">${fmtCurrency(totals.receivedAmount)}</div>
    </div>
    <div style="flex: 1; background: ${totals.cashFlow >= 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${totals.cashFlow >= 0 ? '#bbf7d0' : '#fecaca'}; border-radius: 6px; padding: 8px 12px;">
      <div style="font-size: 7pt; color: ${totals.cashFlow >= 0 ? '#166534' : '#991b1b'}; font-weight: 600; text-transform: uppercase;">Net Cash Flow</div>
      <div style="font-size: 12pt; font-weight: 700; color: ${totals.cashFlow >= 0 ? '#059669' : '#dc2626'};">${fmtCurrency(totals.cashFlow)}</div>
    </div>
    <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px;">
      <div style="font-size: 7pt; color: #0369a1; font-weight: 600; text-transform: uppercase;">Backlog</div>
      <div style="font-size: 12pt; font-weight: 700; color: #002356;">${fmtCurrency(totals.backlog)}</div>
    </div>
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
