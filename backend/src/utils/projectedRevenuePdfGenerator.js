/**
 * HTML for Projected Revenue PDF (server-side, Puppeteer).
 * Mirrors the table view of frontend/src/pages/projects/ProjectedRevenue.tsx.
 */

function fmtCurrency(v) {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '-';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtCurrencyShort(v) {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '-';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
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
  if (filters.market) out.push(`Market: ${filters.market}`);
  if (filters.pm) out.push(`PM: ${filters.pm}`);
  if (filters.teamName) out.push(`Team: ${filters.teamName}`);
  if (filters.search) out.push(`Search: "${filters.search}"`);
  if (Array.isArray(filters.projects) && filters.projects.length > 0) out.push(`Projects: ${filters.projects.length} selected`);
  return out;
}

function generateProjectedRevenuePdfHtml(reportData, filters, scheduleName) {
  const { projections, columns, columnTotals, grandTotal } = reportData;
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const filterStr = buildFilterLabels(filters).join('  |  ');

  const colWidth = `${Math.max(50 / columns.length, 3.5)}%`;
  const monthHeaders = columns.map(c =>
    `<th class="right" style="width: ${colWidth}; font-size: 6.5pt; ${c.isYear ? 'background: #1e3a8a;' : ''}">${escapeHtml(c.label)}</th>`
  ).join('');

  const rows = projections.map((p, i) => {
    const c = p.contract;
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const monthCells = columns.map(col => {
      const v = p.monthlyRevenue.get(col.key) || 0;
      return `<td style="padding: 3px 5px; font-size: 7pt; text-align: right; color: ${v > 0 ? '#1e293b' : '#cbd5e1'}; ${col.isYear ? 'background: #f8fafc; font-weight: 600;' : ''}">${fmtCurrencyShort(v)}</td>`;
    }).join('');

    const status = c.status || '-';
    const statusBg = status.toLowerCase().includes('open') ? 'rgba(16,185,129,0.12)'
      : status.toLowerCase().includes('soft') ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.12)';
    const statusColor = status.toLowerCase().includes('open') ? '#059669'
      : status.toLowerCase().includes('soft') ? '#d97706' : '#6b7280';

    return `<tr style="background: ${bg};">
      <td style="padding: 4px 6px; font-size: 7pt; color: #475569; white-space: nowrap;">${escapeHtml(c.contract_number || '')}</td>
      <td style="padding: 4px 6px; font-size: 7pt;">
        <div style="font-weight: 600; color: #1e293b; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.description || c.customer_name || '')}</div>
      </td>
      <td style="padding: 4px 6px; font-size: 6.75pt; color: #64748b; white-space: nowrap;">${escapeHtml(c.project_manager_name || '-')}</td>
      <td style="padding: 4px 6px; font-size: 6.5pt;">
        <span style="padding: 2px 7px; border-radius: 9999px; font-weight: 600; background: ${statusBg}; color: ${statusColor};">${escapeHtml(status)}</span>
      </td>
      <td style="padding: 4px 6px; font-size: 7pt; text-align: right;">${(p.pctComplete || 0).toFixed(0)}%</td>
      <td style="padding: 4px 6px; font-size: 7pt; text-align: right; font-weight: 700; color: #002356;">${fmtCurrencyShort(c.backlog)}</td>
      ${monthCells}
    </tr>`;
  }).join('');

  const totalCells = columns.map(c => {
    const v = columnTotals.get(c.key) || 0;
    return `<td style="padding: 6px; font-size: 7pt; text-align: right; ${c.isYear ? 'background: #e2e8f0;' : ''}">${fmtCurrencyShort(v)}</td>`;
  }).join('');

  const kpiCard = (label, value, bg, border, labelColor, valueColor) => `
    <div style="flex: 1; background: ${bg}; border: 1px solid ${border}; border-radius: 6px; padding: 6px 10px; min-width: 0;">
      <div style="font-size: 6.5pt; color: ${labelColor}; font-weight: 600; text-transform: uppercase; white-space: nowrap;">${label}</div>
      <div style="font-size: 11pt; font-weight: 700; color: ${valueColor}; white-space: nowrap;">${value}</div>
    </div>`;

  // Distinct PMs and contract-amount totals for context
  const uniquePMs = new Set(projections.map(p => p.contract.project_manager_name || 'Unassigned'));
  const totalContractValue = projections.reduce((s, p) => {
    const v = Number(p.contract.contract_amount) || Number(p.contract.projected_revenue) || 0;
    return s + v;
  }, 0);
  const totalEarned = projections.reduce((s, p) => s + (Number(p.contract.earned_revenue) || 0), 0);

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
      <div style="font-size: 18pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">REVENUE FORECAST</div>
      ${scheduleName ? `<div style="font-size: 10pt; font-weight: 600; color: #475569; margin-top: 1px;">${escapeHtml(scheduleName)}</div>` : ''}
      <div style="font-size: 9pt; color: #6b7280;">Generated ${dateLabel}</div>
      ${filterStr ? `<div style="font-size: 8pt; color: #6b7280; margin-top: 2px;">Filters: ${escapeHtml(filterStr)}</div>` : ''}
    </div>
    <div style="text-align: right; font-size: 8pt; color: #6b7280;">
      ${projections.length} project${projections.length !== 1 ? 's' : ''}<br>
      <span style="font-size: 7pt; color: #94a3b8;">Sorted by backlog (desc)</span>
    </div>
  </div>

  <div style="display: flex; gap: 6px; margin-bottom: 10px;">
    ${kpiCard('Projects', String(projections.length), '#f0f9ff', '#bae6fd', '#0369a1', '#002356')}
    ${kpiCard('Total Backlog', fmtCurrencyShort(grandTotal), '#f5f3ff', '#ddd6fe', '#6d28d9', '#7c3aed')}
    ${kpiCard('Contract Value', fmtCurrencyShort(totalContractValue), '#fffbeb', '#fde68a', '#92400e', '#d97706')}
    ${kpiCard('Earned Revenue', fmtCurrencyShort(totalEarned), '#f0fdf4', '#bbf7d0', '#166534', '#059669')}
    ${kpiCard('PMs', String(uniquePMs.size), '#ecfeff', '#a5f3fc', '#155e75', '#0891b2')}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 7%;">Contract</th>
        <th style="width: 18%;">Description</th>
        <th style="width: 9%;">PM</th>
        <th style="width: 5.5%;">Status</th>
        <th class="right" style="width: 4%;">% Comp</th>
        <th class="right" style="width: 6.5%;">Backlog</th>
        ${monthHeaders}
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="20" style="padding: 20px; text-align: center; color: #94a3b8; font-size: 9pt;">No projects match the selected filters.</td></tr>'}</tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: 700; border-top: 2px solid #cbd5e1;">
        <td colspan="5" style="padding: 6px; font-size: 7.5pt; text-align: right; color: #334155;">Totals:</td>
        <td style="padding: 6px; font-size: 7.5pt; text-align: right; color: #002356;">${fmtCurrencyShort(grandTotal)}</td>
        ${totalCells}
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

module.exports = { generateProjectedRevenuePdfHtml };
