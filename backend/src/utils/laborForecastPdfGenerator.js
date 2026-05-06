/**
 * HTML for Labor Forecast PDF (server-side, Puppeteer).
 * Mirrors the table view of frontend/src/pages/projects/LaborForecast.tsx.
 */

const { LOCATION_GROUPS } = require('../constants/locationGroups');

const TRADE_LABEL = { pf: 'PF', sm: 'SM', pl: 'PL' };

function fmtHours(v) {
  if (!v || v === 0) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtHeadcount(hours, hrsPerPerson) {
  if (!hours || hours === 0) return '-';
  const hc = hours / hrsPerPerson;
  if (hc < 0.1) return '-';
  return hc.toFixed(1);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFilterLabels(filters) {
  const out = [];
  if (filters.status && filters.status !== 'all') out.push(`Status: ${filters.status}`);
  if (Array.isArray(filters.departments) && filters.departments.length > 0) out.push(`Dept: ${filters.departments.join(', ')}`);
  if (Array.isArray(filters.locationGroups) && filters.locationGroups.length > 0) {
    const labels = filters.locationGroups.map(v => {
      const g = LOCATION_GROUPS.find(g => g.value === v);
      return g ? g.longLabel : v;
    });
    out.push(`Location: ${labels.join(', ')}`);
  }
  if (filters.market) out.push(`Market: ${filters.market}`);
  if (filters.pm) out.push(`PM: ${filters.pm}`);
  if (filters.teamName) out.push(`Team: ${filters.teamName}`);
  if (filters.search) out.push(`Search: "${filters.search}"`);
  if (Array.isArray(filters.projects) && filters.projects.length > 0) out.push(`Projects: ${filters.projects.length} selected`);
  if (filters.locationFilter && filters.locationFilter !== 'both') out.push(`Location: ${filters.locationFilter}`);
  if (Array.isArray(filters.tradeFilter) && filters.tradeFilter.length < 3) {
    out.push(`Trades: ${filters.tradeFilter.map(t => TRADE_LABEL[t] || t).join(', ')}`);
  }
  return out;
}

function generateLaborForecastPdfHtml(reportData, filters, scheduleName) {
  const { projections, columns, columnTotals, grandTotalsByTrade, grandTotalHours, tradeFilter } = reportData;
  const tf = new Set(tradeFilter || ['pf', 'sm', 'pl']);
  const hrsPerPerson = filters.hoursPerPersonPerMonth || 173;
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const filterStr = buildFilterLabels(filters).join('  |  ');

  // Find maximum column total to scale headcount alert color
  const maxColumnHours = Math.max(...Array.from(columnTotals.values()).map(t => t.total || 0), 1);

  const monthHeaders = columns.map(c =>
    `<th class="right" style="width: ${Math.max(50 / columns.length, 3.5)}%; font-size: 6.5pt;">${escapeHtml(c.label)}</th>`
  ).join('');

  // Footer column totals row (with headcount on second sub-row)
  const totalCells = columns.map(c => {
    const t = columnTotals.get(c.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
    const hc = fmtHeadcount(t.total, hrsPerPerson);
    const intensity = Math.min(1, t.total / maxColumnHours);
    const bg = intensity > 0.6 ? '#fef2f2' : intensity > 0.3 ? '#fffbeb' : 'transparent';
    return `<td style="padding: 4px 5px; font-size: 7pt; text-align: right; background: ${bg};">
      <div style="font-weight: 600; color: #1e293b;">${fmtHours(t.total)}</div>
      <div style="font-size: 6pt; color: #64748b;">${hc !== '-' ? hc + ' hc' : ''}</div>
    </td>`;
  }).join('');

  // Project rows
  const rows = projections.map((p, i) => {
    const c = p.contract;
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const monthCells = columns.map(col => {
      const h = p.monthlyHours.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
      const filtered = (tf.has('pf') ? h.pf : 0) + (tf.has('sm') ? h.sm : 0) + (tf.has('pl') ? h.pl : 0);
      return `<td style="padding: 3px 5px; font-size: 7pt; text-align: right; color: ${filtered > 0 ? '#1e293b' : '#cbd5e1'};">${fmtHours(filtered)}</td>`;
    }).join('');

    const filteredTotal = p.tradeHours.reduce((s, t) => s + (tf.has(t.key) ? t.remaining : 0), 0);

    return `<tr style="background: ${bg};">
      <td style="padding: 4px 6px; font-size: 7pt; color: #475569; white-space: nowrap;">${escapeHtml(c.contract_number || '')}</td>
      <td style="padding: 4px 6px; font-size: 7pt;">
        <div style="font-weight: 600; color: #1e293b; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.description || c.customer_name || '')}</div>
      </td>
      <td style="padding: 4px 6px; font-size: 6.75pt; color: #64748b; white-space: nowrap;">${escapeHtml(c.project_manager_name || '-')}</td>
      <td style="padding: 4px 6px; font-size: 7pt; text-align: right;">${(p.pctComplete || 0).toFixed(0)}%</td>
      <td style="padding: 4px 6px; font-size: 7pt; text-align: right; font-weight: 700; color: #002356;">${fmtHours(filteredTotal)}</td>
      ${monthCells}
    </tr>`;
  }).join('');

  const filteredGrandTotal = (tf.has('pf') ? grandTotalsByTrade.pf : 0)
    + (tf.has('sm') ? grandTotalsByTrade.sm : 0)
    + (tf.has('pl') ? grandTotalsByTrade.pl : 0);

  const kpiCard = (label, value, bg, border, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bg}; border: 1px solid ${border}; border-radius: 6px; padding: 6px 10px; min-width: 0;">
      <div style="font-size: 6.5pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap;">${label}</div>
      <div style="font-size: 11pt; font-weight: 700; color: ${valueColor}; white-space: nowrap;">${value}</div>
    </div>`;

  const tradeBreakdown = ['pf', 'sm', 'pl'].filter(k => tf.has(k)).map(k => {
    const hrs = grandTotalsByTrade[k];
    return `<div style="display: inline-block; padding: 3px 10px; margin-right: 6px; background: #f1f5f9; border-radius: 9999px; font-size: 7.5pt;">
      <span style="font-weight: 600; color: #475569;">${TRADE_LABEL[k]}:</span>
      <span style="margin-left: 6px; color: #1e293b; font-weight: 600;">${fmtHours(hrs)}</span>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: landscape Letter; margin: 0.4in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #002356; color: white; font-size: 7pt; font-weight: 600; padding: 6px; text-align: left; text-transform: uppercase; letter-spacing: 0.04em; }
    th.right { text-align: right; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-bottom: 3px solid #002356; padding-bottom: 8px;">
    <div>
      <div style="font-size: 18pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">LABOR FORECAST</div>
      ${scheduleName ? `<div style="font-size: 10pt; font-weight: 600; color: #475569; margin-top: 1px;">${escapeHtml(scheduleName)}</div>` : ''}
      <div style="font-size: 9pt; color: #6b7280;">Generated ${dateLabel}</div>
      ${filterStr ? `<div style="font-size: 8pt; color: #6b7280; margin-top: 2px;">Filters: ${escapeHtml(filterStr)}</div>` : ''}
    </div>
    <div style="text-align: right; font-size: 8pt; color: #6b7280;">
      ${projections.length} project${projections.length !== 1 ? 's' : ''}<br>
      <span style="font-size: 7pt; color: #94a3b8;">Sorted by remaining hours (desc)</span>
    </div>
  </div>

  <div style="display: flex; gap: 6px; margin-bottom: 6px;">
    ${kpiCard('Projects', String(projections.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Total Hours', fmtHours(filteredGrandTotal || grandTotalHours), '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
    ${kpiCard('Avg Headcount', fmtHeadcount(filteredGrandTotal || grandTotalHours, hrsPerPerson * (filters.timeHorizon || 12)), '#fffbeb', '#fde68a', '#92400e', '#d97706')}
    ${kpiCard('Horizon', `${filters.timeHorizon || 12} months`, '#f0fdf4', '#bbf7d0', '#166534', '#059669')}
  </div>

  <div style="margin-bottom: 8px; padding: 6px 8px; background: #f8fafc; border-radius: 4px; font-size: 7.5pt;">
    <span style="color: #475569; font-weight: 600;">By Trade:</span>
    <span style="margin-left: 8px;">${tradeBreakdown || '<span style="color: #94a3b8;">No trades selected</span>'}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 7%;">Contract</th>
        <th style="width: 18%;">Description</th>
        <th style="width: 10%;">PM</th>
        <th class="right" style="width: 4%;">% Comp</th>
        <th class="right" style="width: 6%;">Total Hrs</th>
        ${monthHeaders}
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="20" style="padding: 20px; text-align: center; color: #94a3b8; font-size: 9pt;">No projects match the selected filters.</td></tr>'}</tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
        <td colspan="4" style="padding: 6px; font-size: 7.5pt; text-align: right; color: #334155;">Total Hours:</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right; color: #002356;">${fmtHours(filteredGrandTotal || grandTotalHours)}</td>
        ${totalCells}
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

module.exports = { generateLaborForecastPdfHtml };
