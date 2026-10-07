/**
 * HTML for Labor Forecast PDF (server-side, Puppeteer).
 * Matches the layout of the in-app jsPDF export from LaborForecast.tsx:
 *   Page 1: title, KPI bar, 3 charts, Trade Summary table
 *   Page 2: Project Detail table (headcount per month, not hours)
 */

const { LOCATION_GROUPS } = require('../constants/locationGroups');

const TRADE_LABEL = { pf: 'PF', sm: 'SM', pl: 'PL' };
const TRADE_FULL  = { pf: 'Pipefitter', sm: 'Sheet Metal', pl: 'Plumber' };
const TRADE_COLOR = { pf: '#3b82f6', sm: '#10b981', pl: '#f59e0b' };

function fmtHours(v) {
  if (!v || v === 0) return '-';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtHC(hc) {
  if (!hc || hc < 0.05) return '-';
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

function fmtMonthKey(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
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
  if (filters.locationFilter && filters.locationFilter !== 'both') {
    out.push(filters.locationFilter === 'shop' ? 'Shop Only' : 'Field Only');
  }
  if (Array.isArray(filters.tradeFilter) && filters.tradeFilter.length < 3) {
    out.push(`Trades: ${filters.tradeFilter.map(t => TRADE_FULL[t] || t).join(', ')}`);
  }
  return out;
}

// ─── Chart 1: Stacked headcount by month ──────────────────────────────────

function buildHeadcountChartSvg(columns, headcountTotals, activeTrades) {
  const W = 940; const H = 250;
  const padL = 36; const padR = 12; const padT = 8; const padB = 30;
  const cW = W - padL - padR; const cH = H - padT - padB; const cBottom = padT + cH;

  const data = columns.map(col => {
    const hc = headcountTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
    return { label: fmtMonthKey(col.key), pfHC: hc.pf, smHC: hc.sm, plHC: hc.pl, totalHC: hc.total };
  });

  let maxHC = Math.max(...data.map(d => d.totalHC), 0);
  maxHC = Math.ceil(maxHC / 5) * 5 || 10;

  const barCount = data.length || 1;
  const barGap = cW / barCount;
  const barW = Math.min(barGap * 0.75, 28);
  const labelEvery = barCount <= 12 ? 1 : barCount <= 18 ? 2 : 3;

  let gridLines = '';
  for (let i = 0; i <= 5; i++) {
    const yVal = (maxHC / 5) * i;
    const yPos = cBottom - (i / 5) * cH;
    gridLines += `<line x1="${padL}" y1="${yPos}" x2="${padL + cW}" y2="${yPos}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    gridLines += `<text x="${padL - 4}" y="${yPos + 3}" font-size="8" fill="#64748b" text-anchor="end">${yVal.toFixed(0)}</text>`;
  }

  let bars = ''; let labels = '';
  data.forEach((d, i) => {
    const bx = padL + i * barGap + (barGap - barW) / 2;
    const plBarH = (d.plHC / maxHC) * cH;
    const smBarH = (d.smHC / maxHC) * cH;
    const pfBarH = (d.pfHC / maxHC) * cH;
    if (activeTrades.has('pl') && plBarH > 0.5) bars += `<rect x="${bx}" y="${cBottom - plBarH}" width="${barW}" height="${plBarH}" fill="${TRADE_COLOR.pl}"/>`;
    if (activeTrades.has('sm') && smBarH > 0.5) bars += `<rect x="${bx}" y="${cBottom - plBarH - smBarH}" width="${barW}" height="${smBarH}" fill="${TRADE_COLOR.sm}"/>`;
    if (activeTrades.has('pf') && pfBarH > 0.5) bars += `<rect x="${bx}" y="${cBottom - plBarH - smBarH - pfBarH}" width="${barW}" height="${pfBarH}" fill="${TRADE_COLOR.pf}"/>`;
    if (i % labelEvery === 0) labels += `<text x="${bx + barW / 2}" y="${cBottom + 12}" font-size="7.5" fill="#64748b" text-anchor="middle">${escapeHtml(d.label)}</text>`;
  });

  let legend = ''; let lx = padL;
  ['pf', 'sm', 'pl'].filter(k => activeTrades.has(k)).forEach(k => {
    legend += `<rect x="${lx}" y="0" width="11" height="9" fill="${TRADE_COLOR[k]}"/>`;
    legend += `<text x="${lx + 14}" y="8" font-size="8" fill="#475569">${TRADE_FULL[k]}</text>`;
    lx += 90;
  });

  return `<svg width="100%" viewBox="0 0 ${W} ${H + 22}" xmlns="http://www.w3.org/2000/svg">
    <text x="${padL - 4}" y="6" font-size="7" fill="#94a3b8" text-anchor="end">People</text>
    ${gridLines}${bars}${labels}
    <g transform="translate(0, ${H + 4})">${legend}</g>
  </svg>`;
}

// ─── Chart 2: Total remaining hours by trade ───────────────────────────────

function buildTradeBarsSvg(grandTotalsByTrade, grandHCMonths, activeTrades) {
  const trades = ['pf', 'sm', 'pl'].filter(k => activeTrades.has(k));
  if (trades.length === 0) return '';
  const W = 940; const rowH = 24;
  const H = trades.length * rowH + 8;
  const labelW = 80; const valueW = 240; const trackX = labelW + 10;
  const trackW = W - labelW - valueW - 20;
  const maxHrs = Math.max(...trades.map(k => grandTotalsByTrade[k] || 0), 1);
  let rows = '';
  trades.forEach((k, i) => {
    const hrs = grandTotalsByTrade[k] || 0;
    const bw = (hrs / maxHrs) * trackW;
    const y = i * rowH + 4;
    const personMonths = (grandHCMonths[k] || 0).toFixed(0);
    rows += `<text x="${labelW}" y="${y + 13}" font-size="10" font-weight="700" fill="${TRADE_COLOR[k]}" text-anchor="end">${TRADE_FULL[k]}</text>`;
    rows += `<rect x="${trackX}" y="${y + 4}" width="${trackW}" height="12" fill="#e2e8f0" rx="2"/>`;
    rows += `<rect x="${trackX}" y="${y + 4}" width="${Math.max(bw, 2)}" height="12" fill="${TRADE_COLOR[k]}" rx="2"/>`;
    rows += `<text x="${W - 8}" y="${y + 13}" font-size="9" fill="#1e293b" text-anchor="end">${fmtHours(hrs)} hrs (${personMonths} person-months)</text>`;
  });
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${rows}</svg>`;
}

// ─── Chart 3: 8 quarterly cards ───────────────────────────────────────────

function buildQuarterlyCards(projections, activeTrades) {
  const qNow = startOfMonth(new Date());
  const quarters = [];
  for (let q = 0; q < 8; q++) {
    const sm = q * 3;
    let total = 0;
    for (let m = 0; m < 3; m++) {
      const key = formatYYYYMM(addMonths(qNow, sm + m));
      projections.forEach(p => {
        const hc = p.monthlyHC.get(key);
        if (!hc) return;
        if (activeTrades.has('pf')) total += hc.pf;
        if (activeTrades.has('sm')) total += hc.sm;
        if (activeTrades.has('pl')) total += hc.pl;
      });
    }
    const avgHC = total / 3;
    const qStart = addMonths(qNow, sm);
    const qNum = Math.floor(qStart.getMonth() / 3) + 1;
    quarters.push({ label: `Q${qNum} ${qStart.getFullYear()}`, avgHC });
  }
  const cards = quarters.map(q => `
    <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 4px;text-align:center;min-width:0;">
      <div style="font-size:7pt;color:#64748b;">${escapeHtml(q.label)}</div>
      <div style="font-size:13pt;font-weight:700;color:#1e293b;margin:2px 0;">${q.avgHC > 0.05 ? q.avgHC.toFixed(1) : '-'}</div>
      <div style="font-size:6pt;color:#94a3b8;">avg people</div>
    </div>`).join('');
  return `<div style="display:flex;gap:4px;">${cards}</div>`;
}

// ─── Trade Summary table ───────────────────────────────────────────────────

function buildTradeSummaryTable(columns, headcountTotals, grandTotalsByTrade, tf) {
  const activeTrades = ['pf', 'sm', 'pl'].filter(k => tf.has(k));
  const thStyle = 'padding:5px 6px;font-size:7pt;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:white;background:#002356;';
  const tdStyle = 'padding:4px 6px;font-size:7.5pt;text-align:right;';

  const monthThs = columns.map(c =>
    `<th style="${thStyle}text-align:right;">${escapeHtml(fmtMonthKey(c.key))}</th>`
  ).join('');

  const tradeRows = activeTrades.map((k, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const monthTds = columns.map(c => {
      const hc = headcountTotals.get(c.key) || {};
      return `<td style="${tdStyle}">${fmtHC(hc[k] || 0)}</td>`;
    }).join('');
    return `<tr style="background:${bg};">
      <td style="padding:4px 6px;font-size:7.5pt;font-weight:700;color:${TRADE_COLOR[k]};">${TRADE_FULL[k]}</td>
      <td style="${tdStyle}font-weight:600;">${fmtHours(grandTotalsByTrade[k] || 0)}</td>
      ${monthTds}
    </tr>`;
  }).join('');

  const filteredGrandTotal = activeTrades.reduce((s, k) => s + (grandTotalsByTrade[k] || 0), 0);
  const totalMonthTds = columns.map(c => {
    const hc = headcountTotals.get(c.key) || {};
    const total = activeTrades.reduce((s, k) => s + (hc[k] || 0), 0);
    return `<td style="${tdStyle}font-weight:700;">${fmtHC(total)}</td>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;margin-top:4px;">
    <thead>
      <tr>
        <th style="${thStyle}text-align:left;">Trade</th>
        <th style="${thStyle}text-align:right;">Remaining Hours</th>
        ${monthThs}
      </tr>
    </thead>
    <tbody>
      ${tradeRows}
      <tr style="background:#f1f5f9;border-top:2px solid #cbd5e1;">
        <td style="padding:4px 6px;font-size:7.5pt;font-weight:700;color:#1e293b;">TOTAL</td>
        <td style="${tdStyle}font-weight:700;color:#002356;">${fmtHours(filteredGrandTotal)}</td>
        ${totalMonthTds}
      </tr>
    </tbody>
  </table>`;
}

// ─── Project Detail table ─────────────────────────────────────────────────

function buildProjectDetailTable(projections, columns, tf, activeTrades) {
  const thStyle = 'padding:5px 6px;font-size:6.5pt;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:white;background:#002356;text-align:right;';
  const thLeft  = thStyle.replace('text-align:right;', 'text-align:left;');

  const tradeThCols = activeTrades.map(k =>
    `<th style="${thStyle}">${TRADE_LABEL[k]}</th>`
  ).join('');

  const mPct = Math.max(50 / columns.length, 3);
  const monthThs = columns.map(c =>
    `<th style="${thStyle}width:${mPct}%;font-size:6pt;">${escapeHtml(fmtMonthKey(c.key))}</th>`
  ).join('');

  const rows = projections.map((p, i) => {
    const c = p.contract;
    const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';

    const tradeTds = activeTrades.map(k => {
      const t = p.tradeHours.find(t => t.key === k);
      return `<td style="padding:3px 5px;font-size:6.5pt;text-align:right;">${fmtHours(t ? t.remaining : 0)}</td>`;
    }).join('');

    const monthTds = columns.map(col => {
      const hc = p.monthlyHC.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
      const val = activeTrades.reduce((s, k) => s + (hc[k] || 0), 0);
      return `<td style="padding:3px 5px;font-size:6.5pt;text-align:right;color:${val > 0.05 ? '#1e293b' : '#cbd5e1'};">${fmtHC(val)}</td>`;
    }).join('');

    const filteredTotal = p.tradeHours.reduce((s, t) => s + (tf.has(t.key) ? t.remaining : 0), 0);

    return `<tr style="background:${bg};">
      <td style="padding:3px 5px;font-size:6.5pt;color:#475569;white-space:nowrap;">${escapeHtml(c.contract_number || '')}</td>
      <td style="padding:3px 5px;font-size:6.5pt;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        <span style="font-weight:600;color:#1e293b;">${escapeHtml(c.description || c.customer_name || '')}</span>
      </td>
      <td style="padding:3px 5px;font-size:6pt;color:#64748b;white-space:nowrap;">${escapeHtml(c.project_manager_name || '-')}</td>
      <td style="padding:3px 5px;font-size:6.5pt;text-align:center;color:#475569;">${escapeHtml(c.department_code || '-')}</td>
      <td style="padding:3px 5px;font-size:6.5pt;text-align:right;font-weight:700;color:#002356;">${fmtHours(filteredTotal)}</td>
      ${tradeTds}
      <td style="padding:3px 5px;font-size:6.5pt;text-align:right;">${(p.pctComplete || 0).toFixed(0)}%</td>
      <td style="padding:3px 5px;font-size:6pt;text-align:center;white-space:nowrap;">${fmtDate(c.user_adjusted_start_date)}</td>
      <td style="padding:3px 5px;font-size:6pt;text-align:center;white-space:nowrap;">${fmtDate(c.user_adjusted_end_date)}</td>
      ${monthTds}
    </tr>`;
  }).join('');

  const filteredGrandTotal = projections.reduce((s, p) =>
    s + p.tradeHours.reduce((ts, t) => ts + (tf.has(t.key) ? t.remaining : 0), 0), 0);

  const emptyTradeTds = activeTrades.map(() => '<td></td>').join('');

  // Footer: total hours in rem col, monthly headcount totals
  // We don't have headcountTotals here, so sum from projections
  const footerMonthTds = columns.map(col => {
    let total = 0;
    projections.forEach(p => {
      const hc = p.monthlyHC.get(col.key) || {};
      activeTrades.forEach(k => { total += hc[k] || 0; });
    });
    return `<td style="padding:4px 5px;font-size:7pt;text-align:right;font-weight:700;color:#002356;">${fmtHC(total)}</td>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="${thLeft}width:6%;">Contract</th>
        <th style="${thLeft}width:14%;">Description</th>
        <th style="${thLeft}width:9%;">PM</th>
        <th style="${thLeft}width:5%;">Dept</th>
        <th style="${thStyle}width:5%;">Rem. Hrs</th>
        ${tradeThCols}
        <th style="${thStyle}width:4%;">% Comp</th>
        <th style="${thStyle}width:5%;">Start</th>
        <th style="${thStyle}width:5%;">End</th>
        ${monthThs}
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="30" style="padding:20px;text-align:center;color:#94a3b8;font-size:9pt;">No projects match the selected filters.</td></tr>'}</tbody>
    <tfoot>
      <tr style="background:#f1f5f9;border-top:2px solid #cbd5e1;">
        <td colspan="4" style="padding:5px 6px;font-size:7pt;text-align:right;color:#334155;font-weight:700;">Total Hours:</td>
        <td style="padding:5px 6px;font-size:7pt;text-align:right;font-weight:700;color:#002356;">${fmtHours(filteredGrandTotal)}</td>
        ${emptyTradeTds}
        <td></td><td></td><td></td>
        ${footerMonthTds}
      </tr>
    </tfoot>
  </table>`;
}

// ─── Main HTML builder ────────────────────────────────────────────────────

function generateLaborForecastPdfHtml(reportData, filters, scheduleName) {
  const { projections, columns, headcountTotals, grandTotalsByTrade, grandTotalHours, tradeFilter } = reportData;
  const tf = new Set(tradeFilter || ['pf', 'sm', 'pl']);
  const activeTrades = ['pf', 'sm', 'pl'].filter(k => tf.has(k));

  // Grand HC months per trade (sum across all columns)
  const grandHCMonths = { pf: 0, sm: 0, pl: 0, total: 0 };
  for (const hc of headcountTotals.values()) {
    grandHCMonths.pf += hc.pf; grandHCMonths.sm += hc.sm;
    grandHCMonths.pl += hc.pl; grandHCMonths.total += hc.total;
  }

  const peakHC = Math.max(...Array.from(headcountTotals.values()).map(hc => hc.total || 0), 0);
  const filteredGrandTotal = activeTrades.reduce((s, k) => s + (grandTotalsByTrade[k] || 0), 0);
  const filterLabels = buildFilterLabels(filters).join(' | ');
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // KPI last cell: trade breakdown
  const tradeKpiLabel = activeTrades.map(k => TRADE_LABEL[k]).join(' / ');
  const tradeKpiValue = activeTrades.map(k => fmtHours(grandTotalsByTrade[k] || 0)).join(' / ');

  const headcountChart  = buildHeadcountChartSvg(columns, headcountTotals, tf);
  const tradeBarsChart  = buildTradeBarsSvg(grandTotalsByTrade, grandHCMonths, tf);
  const quarterlyCards  = buildQuarterlyCards(projections, tf);
  const tradeSummary    = buildTradeSummaryTable(columns, headcountTotals, grandTotalsByTrade, tf);
  const projectDetail   = buildProjectDetailTable(projections, columns, tf, activeTrades);

  const kpiCell = (label, value) => `
    <div style="flex:1;text-align:center;padding:8px 12px;border-left:1px solid #e2e8f0;">
      <div style="font-size:7pt;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">${label}</div>
      <div style="font-size:12pt;font-weight:700;color:#1e293b;margin-top:2px;">${value}</div>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: landscape Letter; margin: 0.4in 0.4in 0.5in 0.4in; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; font-size: 8pt; color: #1e293b; }
    .page-break { page-break-before: always; }
    .chart-section { margin-bottom: 12px; }
    .chart-title { font-size: 10pt; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
    .page-footer { position: fixed; bottom: 0.15in; left: 0.4in; right: 0.4in; font-size: 7pt; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 3px; }
  </style>
</head>
<body>

  <!-- ── PAGE 1: Charts + Trade Summary ── -->
  <div>
    <div style="margin-bottom:10px;">
      <div style="font-size:20pt;font-weight:700;color:#1e293b;line-height:1.1;">Labor Forecast</div>
      ${scheduleName ? `<div style="font-size:10pt;color:#475569;margin-top:1px;">${escapeHtml(scheduleName)}</div>` : ''}
      ${filterLabels ? `<div style="font-size:8.5pt;color:#6b7280;margin-top:2px;">${escapeHtml(filterLabels)}</div>` : ''}
    </div>

    <!-- KPI bar -->
    <div style="display:flex;background:#f1f5f9;border-radius:4px;border:1px solid #e2e8f0;margin-bottom:14px;">
      <div style="flex:1;text-align:center;padding:8px 12px;">
        <div style="font-size:7pt;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Projects</div>
        <div style="font-size:12pt;font-weight:700;color:#1e293b;margin-top:2px;">${projections.length}</div>
      </div>
      ${kpiCell('Total Remaining', `${fmtHours(filteredGrandTotal || grandTotalHours)} hrs`)}
      ${kpiCell('Peak Headcount', `${peakHC.toFixed(1)} people`)}
      ${kpiCell(tradeKpiLabel, tradeKpiValue)}
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

    <div style="margin-top:14px;">
      <div class="chart-title">Trade Summary</div>
      ${tradeSummary}
    </div>
  </div>

  <!-- ── PAGE 2: Project Detail ── -->
  <div class="page-break">
    <div style="font-size:11pt;font-weight:700;color:#1e293b;margin-bottom:8px;">Project Detail</div>
    ${projectDetail}
  </div>

  <div class="page-footer">
    <span>Generated ${escapeHtml(dateLabel)}</span>
    <span>${projections.length} project${projections.length !== 1 ? 's' : ''} · Sorted by remaining hours (desc)</span>
  </div>

</body>
</html>`;
}

module.exports = { generateLaborForecastPdfHtml };
