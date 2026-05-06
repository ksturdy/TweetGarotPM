/**
 * HTML for Labor Forecast PDF (server-side, Puppeteer).
 * Mirrors the table view of frontend/src/pages/projects/LaborForecast.tsx,
 * including the three charts produced by its in-app Export PDF action:
 *   1) Stacked headcount-by-month bars (PF/SM/PL)
 *   2) Total remaining hours by trade (horizontal bars)
 *   3) Projected headcount by quarter (8 quarters)
 */

const { LOCATION_GROUPS } = require('../constants/locationGroups');

const TRADE_LABEL = { pf: 'PF', sm: 'SM', pl: 'PL' };
const TRADE_COLOR = { pf: '#3b82f6', sm: '#10b981', pl: '#f59e0b' };

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

// ─── Chart builders (SVG strings) ─────────────────────────────────────────

/**
 * Chart 1: Stacked bar chart of projected headcount by month (PF/SM/PL).
 */
function buildHeadcountChartSvg(columns, columnTotals, hrsPerPerson, activeTrades) {
  const W = 940;
  const H = 250;
  const padL = 36;
  const padR = 12;
  const padT = 8;
  const padB = 30;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const cBottom = padT + cH;

  const data = columns.map(col => {
    const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
    return {
      label: col.label,
      pfHC: ct.pf / hrsPerPerson,
      smHC: ct.sm / hrsPerPerson,
      plHC: ct.pl / hrsPerPerson,
      totalHC: ct.total / hrsPerPerson,
    };
  });

  let maxHC = Math.max(...data.map(d => d.totalHC), 0);
  maxHC = Math.ceil(maxHC / 5) * 5;
  if (maxHC === 0) maxHC = 10;

  const barCount = data.length || 1;
  const barGap = cW / barCount;
  const barW = Math.min(barGap * 0.75, 28);
  const labelEvery = barCount <= 12 ? 1 : barCount <= 18 ? 2 : 3;

  // Y-axis grid + labels
  let gridLines = '';
  for (let i = 0; i <= 5; i++) {
    const yVal = (maxHC / 5) * i;
    const yPos = cBottom - (i / 5) * cH;
    gridLines += `<line x1="${padL}" y1="${yPos}" x2="${padL + cW}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    gridLines += `<text x="${padL - 4}" y="${yPos + 3}" font-size="8" fill="#64748b" text-anchor="end">${yVal.toFixed(0)}</text>`;
  }

  // Stacked bars (order: PL bottom, SM mid, PF top — matches in-app PDF)
  let bars = '';
  let labels = '';
  data.forEach((d, i) => {
    const bx = padL + i * barGap + (barGap - barW) / 2;
    const plBarH = (d.plHC / maxHC) * cH;
    const smBarH = (d.smHC / maxHC) * cH;
    const pfBarH = (d.pfHC / maxHC) * cH;

    if (plBarH > 0.5) {
      bars += `<rect x="${bx}" y="${cBottom - plBarH}" width="${barW}" height="${plBarH}" fill="${TRADE_COLOR.pl}"/>`;
    }
    if (smBarH > 0.5) {
      bars += `<rect x="${bx}" y="${cBottom - plBarH - smBarH}" width="${barW}" height="${smBarH}" fill="${TRADE_COLOR.sm}"/>`;
    }
    if (pfBarH > 0.5) {
      bars += `<rect x="${bx}" y="${cBottom - plBarH - smBarH - pfBarH}" width="${barW}" height="${pfBarH}" fill="${TRADE_COLOR.pf}"/>`;
    }

    if (i % labelEvery === 0) {
      labels += `<text x="${bx + barW / 2}" y="${cBottom + 12}" font-size="7.5" fill="#64748b" text-anchor="middle">${escapeHtml(d.label)}</text>`;
    }
  });

  // Legend (only show active trades)
  let legend = '';
  let lx = padL;
  ['pf', 'sm', 'pl'].filter(k => activeTrades.has(k)).forEach(k => {
    legend += `<rect x="${lx}" y="0" width="11" height="9" fill="${TRADE_COLOR[k]}"/>`;
    legend += `<text x="${lx + 14}" y="8" font-size="8" fill="#475569">${TRADE_LABEL[k]}</text>`;
    lx += 50;
  });

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H + 22}" xmlns="http://www.w3.org/2000/svg">
      <text x="${padL - 4}" y="6" font-size="7" fill="#94a3b8" text-anchor="end">People</text>
      ${gridLines}
      ${bars}
      ${labels}
      <g transform="translate(0, ${H + 4})">${legend}</g>
    </svg>`;
}

/**
 * Chart 2: Horizontal bars — Total Remaining Hours by Trade.
 */
function buildTradeBarsSvg(grandTotalsByTrade, hrsPerPerson, activeTrades) {
  const trades = ['pf', 'sm', 'pl'].filter(k => activeTrades.has(k));
  if (trades.length === 0) return '';

  const W = 940;
  const rowH = 24;
  const H = trades.length * rowH + 8;
  const labelW = 50;
  const valueW = 220;
  const trackX = labelW + 10;
  const trackW = W - labelW - valueW - 20;

  const maxHrs = Math.max(...trades.map(k => grandTotalsByTrade[k] || 0), 1);

  let rows = '';
  trades.forEach((k, i) => {
    const hrs = grandTotalsByTrade[k] || 0;
    const bw = (hrs / maxHrs) * trackW;
    const y = i * rowH + 4;
    rows += `<text x="${labelW}" y="${y + 13}" font-size="10" font-weight="700" fill="${TRADE_COLOR[k]}" text-anchor="end">${TRADE_LABEL[k]}</text>`;
    rows += `<rect x="${trackX}" y="${y + 4}" width="${trackW}" height="12" fill="#e2e8f0" rx="2"/>`;
    rows += `<rect x="${trackX}" y="${y + 4}" width="${Math.max(bw, 2)}" height="12" fill="${TRADE_COLOR[k]}" rx="2"/>`;
    rows += `<text x="${W - 8}" y="${y + 13}" font-size="9" fill="#1e293b" text-anchor="end">${fmtHours(hrs)} hrs (${(hrs / hrsPerPerson).toFixed(0)} person-months)</text>`;
  });

  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

/**
 * Chart 3: 8 quarterly cards — Projected Headcount by Quarter (avg people).
 */
function buildQuarterlyCards(projections, hrsPerPerson, activeTrades) {
  const qNow = startOfMonth(new Date());
  const quarters = [];
  for (let q = 0; q < 8; q++) {
    const sm = q * 3;
    let total = 0;
    for (let m = 0; m < 3; m++) {
      const monthDate = addMonths(qNow, sm + m);
      const key = formatYYYYMM(monthDate);
      projections.forEach(p => {
        const h = p.monthlyHours.get(key);
        if (!h) return;
        if (activeTrades.has('pf')) total += h.pf;
        if (activeTrades.has('sm')) total += h.sm;
        if (activeTrades.has('pl')) total += h.pl;
      });
    }
    const avgHC = (total / 3) / hrsPerPerson;
    const qStart = addMonths(qNow, sm);
    const qNum = Math.floor(qStart.getMonth() / 3) + 1;
    quarters.push({ label: `Q${qNum} ${qStart.getFullYear()}`, avgHC });
  }

  const cards = quarters.map(q => `
    <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 4px; text-align: center; min-width: 0;">
      <div style="font-size: 7pt; color: #64748b;">${escapeHtml(q.label)}</div>
      <div style="font-size: 13pt; font-weight: 700; color: #1e293b; margin: 2px 0;">${q.avgHC > 0 ? q.avgHC.toFixed(1) : '-'}</div>
      <div style="font-size: 6pt; color: #94a3b8;">avg people</div>
    </div>
  `).join('');

  return `<div style="display: flex; gap: 4px;">${cards}</div>`;
}

// ─── Main HTML builder ─────────────────────────────────────────

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

  const headcountChart = buildHeadcountChartSvg(columns, columnTotals, hrsPerPerson, tf);
  const tradeBarsChart = buildTradeBarsSvg(grandTotalsByTrade, hrsPerPerson, tf);
  const quarterlyCards = buildQuarterlyCards(projections, hrsPerPerson, tf);

  const peakHC = Math.max(...Array.from(columnTotals.values()).map(h => h.total || 0), 0) / hrsPerPerson;

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
    .page-break { page-break-before: always; }
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
    ${kpiCard('Peak Headcount', `${peakHC.toFixed(1)} ppl`, '#fffbeb', '#fde68a', '#92400e', '#d97706')}
    ${kpiCard('Horizon', `${filters.timeHorizon || 12} months`, '#f0fdf4', '#bbf7d0', '#166534', '#059669')}
  </div>

  <div style="margin-bottom: 10px; padding: 6px 8px; background: #f8fafc; border-radius: 4px; font-size: 7.5pt;">
    <span style="color: #475569; font-weight: 600;">By Trade:</span>
    <span style="margin-left: 8px;">${tradeBreakdown || '<span style="color: #94a3b8;">No trades selected</span>'}</span>
  </div>

  <div class="chart-section">
    <div class="chart-title">Projected Headcount by Month</div>
    ${headcountChart}
  </div>

  <div class="chart-section">
    <div class="chart-title">Total Remaining Hours by Trade</div>
    ${tradeBarsChart}
  </div>

  <div class="chart-section">
    <div class="chart-title">Projected Headcount by Quarter</div>
    ${quarterlyCards}
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
