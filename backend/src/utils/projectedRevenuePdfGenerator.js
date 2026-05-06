/**
 * HTML for Projected Revenue PDF (server-side, Puppeteer).
 * Mirrors the table view of frontend/src/pages/projects/ProjectedRevenue.tsx
 * AND its on-screen Graph view, including:
 *   1) Projected revenue by month (next 36 months) bar chart
 *   2) Projected revenue by year (4 vertical bars)
 *   3) Total backlog by department (horizontal bars)
 *   4) Total backlog by project manager — top 10 (horizontal bars)
 *   5) Projected revenue by quarter (12 quarter cards)
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

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatYYYYMM(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

// ─── Chart builders (SVG strings) ─────────────────────────────────────────

/**
 * Chart 1: 36-month bar chart of projected revenue.
 * Mirrors the on-screen "Projected Revenue by Month (Next 36 Months)".
 */
function buildMonthlyChartSvg(projections, departmentFilter) {
  const W = 940;
  const H = 260;
  const padL = 50;
  const padR = 12;
  const padT = 8;
  const padB = 50;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const cBottom = padT + cH;

  const now = startOfMonth(new Date());
  const monthlyData = [];
  let maxValue = 0;

  // Show $115M annual budget overlay only when filter is exactly "10-30"
  const showBudget = Array.isArray(departmentFilter)
    && departmentFilter.length === 1
    && departmentFilter[0] === '10-30';
  const monthlyBudget = 115000000 / 12;

  for (let i = 0; i < 36; i++) {
    const monthDate = addMonths(now, i);
    const key = formatYYYYMM(monthDate);
    let total = 0;
    projections.forEach(p => {
      total += p.monthlyRevenue.get(key) || 0;
    });
    const monthAbbr = monthDate.toLocaleDateString('en-US', { month: 'short' });
    monthlyData.push({ key, value: total, monthAbbr, isYearStart: monthDate.getMonth() === 0 });
    if (total > maxValue) maxValue = total;
  }
  if (showBudget && monthlyBudget > maxValue) maxValue = monthlyBudget;
  if (maxValue === 0) maxValue = 1;

  const barCount = 36;
  const barGap = cW / barCount;
  const barW = barGap * 0.78;

  // Y-axis labels (top, mid, zero)
  const yLabels = `
    <text x="${padL - 6}" y="${padT + 8}" font-size="8" fill="#64748b" text-anchor="end">${escapeHtml(fmtCurrencyShort(maxValue))}</text>
    <text x="${padL - 6}" y="${padT + cH / 2 + 3}" font-size="8" fill="#64748b" text-anchor="end">${escapeHtml(fmtCurrencyShort(maxValue / 2))}</text>
    <text x="${padL - 6}" y="${cBottom + 3}" font-size="8" fill="#64748b" text-anchor="end">$0</text>`;

  // Grid lines
  const grid = `
    <line x1="${padL}" y1="${padT}" x2="${padL + cW}" y2="${padT}" stroke="#e2e8f0" stroke-dasharray="2,2"/>
    <line x1="${padL}" y1="${padT + cH / 2}" x2="${padL + cW}" y2="${padT + cH / 2}" stroke="#e2e8f0" stroke-dasharray="2,2"/>
    <line x1="${padL}" y1="${cBottom}" x2="${padL + cW}" y2="${cBottom}" stroke="#cbd5e1"/>`;

  // Year boundaries
  const yearBoundaries = [];
  monthlyData.forEach((d, i) => {
    if (d.isYearStart) yearBoundaries.push({ index: i, year: d.key.substring(0, 4) });
  });
  let yearLines = '';
  yearBoundaries.forEach(yb => {
    const xPos = padL + yb.index * barGap;
    yearLines += `<line x1="${xPos}" y1="${padT}" x2="${xPos}" y2="${cBottom + 4}" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="3,2"/>`;
  });

  // Bars
  let bars = '';
  let monthLabels = '';
  monthlyData.forEach((d, i) => {
    const xPos = padL + i * barGap + (barGap - barW) / 2;
    const barH = (d.value / maxValue) * cH;
    const isOver = showBudget && d.value > monthlyBudget;
    const isUnder = showBudget && d.value < monthlyBudget && d.value > 0;
    const fill = isOver ? '#ef4444' : isUnder ? '#10b981' : (d.isYearStart ? '#1e40af' : '#3b82f6');

    if (showBudget) {
      const budgetH = (monthlyBudget / maxValue) * cH;
      bars += `<rect x="${xPos}" y="${cBottom - budgetH}" width="${barW}" height="${budgetH}" fill="#fef3c7"/>`;
    }
    if (barH > 0.4) {
      bars += `<rect x="${xPos}" y="${cBottom - barH}" width="${barW}" height="${barH}" fill="${fill}"/>`;
    }

    if (i % 3 === 0) {
      monthLabels += `<text x="${xPos + barW / 2}" y="${cBottom + 14}" font-size="8" fill="#64748b" text-anchor="middle">${escapeHtml(d.monthAbbr)}</text>`;
    }
  });

  // Year labels
  let yearLabels = '';
  yearBoundaries.forEach((yb, idx) => {
    const xStart = yb.index;
    const next = yearBoundaries[idx + 1];
    const xEnd = next ? next.index : 36;
    const xCenter = padL + ((xStart + xEnd) / 2) * barGap;
    yearLabels += `<text x="${xCenter}" y="${cBottom + 32}" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">${yb.year}</text>`;
  });
  if (yearBoundaries.length > 0 && yearBoundaries[0].index > 0) {
    const xCenter = padL + (yearBoundaries[0].index / 2) * barGap;
    yearLabels += `<text x="${xCenter}" y="${cBottom + 32}" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">${monthlyData[0].key.substring(0, 4)}</text>`;
  }

  // Budget reference line (drawn over bars)
  let budgetLine = '';
  if (showBudget) {
    const yBudget = cBottom - (monthlyBudget / maxValue) * cH;
    budgetLine = `<line x1="${padL}" y1="${yBudget}" x2="${padL + cW}" y2="${yBudget}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6,3"/>`;
  }

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${yLabels}
      ${grid}
      ${yearLines}
      ${bars}
      ${budgetLine}
      ${monthLabels}
      ${yearLabels}
    </svg>`;
}

/**
 * Chart 2: 4 vertical bars — Projected Revenue by Year (current + next 3).
 */
function buildYearlyChartSvg(projections) {
  const W = 940;
  const H = 200;
  const padT = 30;
  const padB = 30;
  const cH = H - padT - padB;

  const now = startOfMonth(new Date());
  const currentYear = now.getFullYear();
  const yearTotals = [];
  let maxVal = 0;

  for (let y = 0; y < 4; y++) {
    const year = currentYear + y;
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(year, m, 1);
      if (monthDate >= now) {
        const key = formatYYYYMM(monthDate);
        projections.forEach(p => {
          total += p.monthlyRevenue.get(key) || 0;
        });
      }
    }
    yearTotals.push({ year, total });
    if (total > maxVal) maxVal = total;
  }
  if (maxVal === 0) maxVal = 1;

  const colors = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'];
  const barCount = yearTotals.length;
  const slotW = W / barCount;
  const barW = slotW * 0.5;

  let bars = '';
  yearTotals.forEach((yt, i) => {
    const xCenter = i * slotW + slotW / 2;
    const xLeft = xCenter - barW / 2;
    const barH = (yt.total / maxVal) * cH;
    const yTop = padT + cH - barH;
    bars += `<text x="${xCenter}" y="${yTop - 4}" font-size="10" font-weight="600" fill="#1e293b" text-anchor="middle">${escapeHtml(fmtCurrencyShort(yt.total))}</text>`;
    bars += `<rect x="${xLeft}" y="${yTop}" width="${barW}" height="${Math.max(barH, 1)}" fill="${colors[i]}" rx="3"/>`;
    bars += `<text x="${xCenter}" y="${padT + cH + 18}" font-size="10" font-weight="500" fill="#475569" text-anchor="middle">${yt.year}</text>`;
  });

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/**
 * Chart 3: Horizontal bars — Total Backlog by Department.
 */
function buildDepartmentChartSvg(projections) {
  const deptTotals = {};
  projections.forEach(p => {
    const dept = p.contract.department_code || 'Unknown';
    deptTotals[dept] = (deptTotals[dept] || 0) + parseNum(p.contract.backlog);
  });

  const sorted = Object.entries(deptTotals).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return '<div style="font-size: 8pt; color: #94a3b8;">No data</div>';

  const maxVal = sorted[0][1] || 1;

  // Render as a 2-column grid of small horizontal bars
  const items = sorted.map(([dept, total]) => {
    const pct = (total / maxVal) * 100;
    return `
      <div style="flex: 1 1 calc(33% - 8px); min-width: 220px; max-width: 320px;">
        <div style="display: flex; justify-content: space-between; font-size: 8pt; margin-bottom: 3px;">
          <span style="font-weight: 600; color: #1e293b;">${escapeHtml(dept)}</span>
          <span style="color: #64748b;">${escapeHtml(fmtCurrencyShort(total))}</span>
        </div>
        <div style="background: #e2e8f0; border-radius: 3px; height: 9px; overflow: hidden;">
          <div style="width: ${pct}%; background: #3b82f6; height: 100%; border-radius: 3px;"></div>
        </div>
      </div>`;
  }).join('');

  return `<div style="display: flex; flex-wrap: wrap; gap: 12px;">${items}</div>`;
}

/**
 * Chart 4: Horizontal bars — Total Backlog by Project Manager (top 10).
 */
function buildPmChartSvg(projections) {
  const pmTotals = {};
  projections.forEach(p => {
    const pm = p.contract.project_manager_name || 'Unassigned';
    pmTotals[pm] = (pmTotals[pm] || 0) + parseNum(p.contract.backlog);
  });

  const sorted = Object.entries(pmTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (sorted.length === 0) return '<div style="font-size: 8pt; color: #94a3b8;">No data</div>';

  const maxVal = sorted[0][1] || 1;

  const rows = sorted.map(([pm, total]) => {
    const pct = (total / maxVal) * 100;
    return `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <div style="width: 130px; font-size: 7.5pt; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(pm)}</div>
        <div style="flex: 1; background: #e2e8f0; border-radius: 3px; height: 14px; overflow: hidden; position: relative;">
          <div style="width: ${pct}%; background: #10b981; height: 100%; border-radius: 3px; display: flex; align-items: center; padding-left: 6px; box-sizing: border-box;">
            <span style="font-size: 7pt; color: #fff; font-weight: 600;">${escapeHtml(fmtCurrencyShort(total))}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  return `<div>${rows}</div>`;
}

/**
 * Chart 5: 12 quarterly cards — Projected Revenue by Quarter.
 */
function buildQuarterlyCards(projections) {
  const now = startOfMonth(new Date());
  const quarters = [];
  for (let q = 0; q < 12; q++) {
    const startMonth = q * 3;
    let total = 0;
    for (let m = 0; m < 3; m++) {
      const monthDate = addMonths(now, startMonth + m);
      const key = formatYYYYMM(monthDate);
      projections.forEach(p => {
        total += p.monthlyRevenue.get(key) || 0;
      });
    }
    const qStart = addMonths(now, startMonth);
    const year = qStart.getFullYear();
    const qNum = Math.floor(qStart.getMonth() / 3) + 1;
    quarters.push({ label: `Q${qNum} ${year}`, total });
  }

  const cards = quarters.map(q => `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 4px; text-align: center;">
      <div style="font-size: 7pt; color: #64748b;">${escapeHtml(q.label)}</div>
      <div style="font-size: 10pt; font-weight: 700; color: #1e293b; margin-top: 2px;">${escapeHtml(fmtCurrencyShort(q.total))}</div>
    </div>
  `).join('');

  return `<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;">${cards}</div>`;
}

// ─── Main HTML builder ─────────────────────────────────────────

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

  // Charts
  const monthlyChart = buildMonthlyChartSvg(projections, filters.departments);
  const yearlyChart = buildYearlyChartSvg(projections);
  const deptChart = buildDepartmentChartSvg(projections);
  const pmChart = buildPmChartSvg(projections);
  const quarterCards = buildQuarterlyCards(projections);

  const showBudget = Array.isArray(filters.departments)
    && filters.departments.length === 1
    && filters.departments[0] === '10-30';

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
    .chart-section { margin-bottom: 14px; }
    .chart-title { font-size: 10pt; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
    .chart-subtitle { font-size: 7.5pt; font-weight: 400; color: #64748b; margin-left: 8px; }
    .page-break { page-break-before: always; }
    .two-col { display: flex; gap: 16px; }
    .two-col > div { flex: 1; min-width: 0; }
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

  <div class="chart-section">
    <div class="chart-title">
      Projected Revenue by Month (Next 36 Months)
      ${showBudget ? '<span class="chart-subtitle">vs. $115M Annual Budget</span>' : ''}
    </div>
    ${monthlyChart}
    ${showBudget ? `
      <div style="display: flex; gap: 14px; font-size: 7pt; color: #64748b; margin-top: 4px; flex-wrap: wrap;">
        <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 2px;"></span>Budget ($9.58M/mo)</span>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 2px;"></span>Under Budget</span>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 2px;"></span>Over Budget</span>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block; width: 14px; height: 2px; background: #f59e0b;"></span>Budget Line</span>
      </div>` : ''}
  </div>

  <div class="page-break"></div>

  <div class="chart-section">
    <div class="chart-title">Projected Revenue by Year</div>
    ${yearlyChart}
  </div>

  <div class="chart-section">
    <div class="chart-title">Projected Revenue by Quarter</div>
    ${quarterCards}
  </div>

  <div class="page-break"></div>

  <div class="chart-section">
    <div class="chart-title">Total Backlog by Department</div>
    ${deptChart}
  </div>

  <div class="chart-section">
    <div class="chart-title">Total Backlog by Project Manager (Top 10)</div>
    ${pmChart}
  </div>

  <div class="page-break"></div>

  <div style="margin-bottom: 8px;">
    <div style="font-size: 11pt; font-weight: 700; color: #1e293b;">Project Detail</div>
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
