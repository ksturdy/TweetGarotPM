/**
 * PDF generator for the Rolling 12-Month Revenue Forecast.
 * Renders an HTML page with SVG charts via Puppeteer.
 *
 * Layout (landscape A4):
 *   Page 1 – KPI strip + stacked bar chart + summary table
 *   Page 2 – Secured projects detail
 *   Page 3 – Awarded opportunities detail
 *   Page 4 – Weighted pursuits detail
 */

const { launchBrowser } = require('./launchBrowser');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtMoneyShort(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

// ── SVG stacked bar chart ────────────────────────────────────────────────────

function buildChartSvg(data) {
  const { columns, secured, awarded, pursuits } = data;
  const W = 940, H = 270;
  const padL = 62, padR = 16, padT = 12, padB = 58;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  const months = columns.map(c => ({
    label: c.label,
    sec: secured[c.key] || 0,
    awd: awarded[c.key] || 0,
    pur: pursuits[c.key] || 0,
  }));

  const maxVal = Math.max(
    ...months.map(m => Math.max(m.sec + m.awd, m.pur)),
    1
  );

  // Nice round ceiling for Y axis
  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const yMax = Math.ceil(maxVal / mag) * mag;

  // Y-axis grid lines
  const gridCount = 5;
  let gridLines = '';
  for (let i = 0; i <= gridCount; i++) {
    const frac = i / gridCount;
    const y = padT + cH * (1 - frac);
    const val = yMax * frac;
    gridLines += `
      <line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"
            stroke="${i === 0 ? '#94a3b8' : '#e2e8f0'}" stroke-width="${i === 0 ? 1 : 0.5}"/>
      <text x="${padL - 5}" y="${(y + 3).toFixed(1)}" font-size="8" fill="#64748b"
            text-anchor="end">${esc(fmtMoneyShort(val))}</text>`;
  }

  // Bars
  const n = months.length;
  const groupW = cW / n;
  const groupPad = groupW * 0.12;
  const innerW = groupW - groupPad * 2;
  const barW = innerW * 0.48;
  const pursuitBarW = innerW * 0.44;
  const barGap = innerW - barW - pursuitBarW;

  let bars = '';
  months.forEach((m, i) => {
    const gx = padL + i * groupW + groupPad;
    const secH = (m.sec / yMax) * cH;
    const awdH = (m.awd / yMax) * cH;
    const purH = (m.pur / yMax) * cH;
    const baseY = padT + cH;

    // Stacked bar: secured (bottom) + awarded (top)
    if (m.sec > 0) bars += `<rect x="${gx.toFixed(1)}" y="${(baseY - secH).toFixed(1)}" width="${barW.toFixed(1)}" height="${secH.toFixed(1)}" fill="#2563EB" rx="1.5"/>`;
    if (m.awd > 0) bars += `<rect x="${gx.toFixed(1)}" y="${(baseY - secH - awdH).toFixed(1)}" width="${barW.toFixed(1)}" height="${awdH.toFixed(1)}" fill="#10B981" rx="1.5"/>`;

    // Pursuits bar (separate)
    const px = gx + barW + barGap;
    if (m.pur > 0) bars += `<rect x="${px.toFixed(1)}" y="${(baseY - purH).toFixed(1)}" width="${pursuitBarW.toFixed(1)}" height="${purH.toFixed(1)}" fill="#F59E0B" rx="1.5"/>`;

    // Month label
    const lx = gx + (barW + barGap + pursuitBarW) / 2;
    bars += `<text x="${lx.toFixed(1)}" y="${(padT + cH + 13).toFixed(1)}" font-size="7.5" fill="#64748b" text-anchor="middle">${esc(m.label)}</text>`;
  });

  // Axes
  const axes = `
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#94a3b8" stroke-width="1"/>
    <line x1="${padL}" y1="${padT + cH}" x2="${W - padR}" y2="${padT + cH}" stroke="#94a3b8" stroke-width="1"/>`;

  // Legend
  const ly = padT + cH + 30;
  const legend = `
    <rect x="${padL}" y="${ly}" width="11" height="11" fill="#2563EB" rx="2"/>
    <text x="${padL + 15}" y="${ly + 8.5}" font-size="8.5" fill="#1e293b">Secured (Vista)</text>
    <rect x="${padL + 108}" y="${ly}" width="11" height="11" fill="#10B981" rx="2"/>
    <text x="${padL + 123}" y="${ly + 8.5}" font-size="8.5" fill="#1e293b">Awarded</text>
    <rect x="${padL + 190}" y="${ly}" width="11" height="11" fill="#F59E0B" rx="2"/>
    <text x="${padL + 205}" y="${ly + 8.5}" font-size="8.5" fill="#1e293b">Weighted Pursuits</text>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${gridLines}${axes}${bars}${legend}
  </svg>`;
}

// ── HTML template ────────────────────────────────────────────────────────────

function buildHtml(data, filters) {
  const { columns, secured, awarded, pursuits, secured_projects, awarded_projects, pursuit_projects } = data;
  const filterParts = [];
  if ((filters.departments || []).length) filterParts.push(`Dept: ${filters.departments.join(', ')}`);
  if ((filters.teamNames || []).length) filterParts.push(`Team: ${filters.teamNames.join(', ')}`);
  const deptLabel = filterParts.length ? filterParts.join('  ·  ') : 'All Departments / Teams';
  const genDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Aggregate totals
  const sum = (obj) => columns.reduce((s, c) => s + (obj[c.key] || 0), 0);
  const secTotal = sum(secured);
  const awdTotal = sum(awarded);
  const purTotal = sum(pursuits);
  const combinedTotal = secTotal + awdTotal;

  const chartSvg = buildChartSvg(data);

  // ── Summary table rows ──────────────────────────────────────────────────────
  function summaryRow(label, byMonth, bg, color, bold = false) {
    const vals = columns.map(c => fmtMoney(byMonth[c.key] || 0));
    const total = fmtMoney(sum(byMonth));
    const fw = bold ? '700' : '500';
    return `<tr style="background:${bg}">
      <td style="padding:4px 8px;font-weight:${fw};color:${color};white-space:nowrap;border-bottom:1px solid #e2e8f0">${esc(label)}</td>
      ${vals.map(v => `<td style="padding:4px 6px;text-align:right;font-weight:${fw};color:${color};font-variant-numeric:tabular-nums;white-space:nowrap;border-bottom:1px solid #e2e8f0">${esc(v)}</td>`).join('')}
      <td style="padding:4px 6px;text-align:right;font-weight:700;color:${color};font-variant-numeric:tabular-nums;white-space:nowrap;border-bottom:1px solid #e2e8f0;border-left:2px solid #cbd5e1">${esc(total)}</td>
    </tr>`;
  }

  const summaryHdr = `<thead><tr style="background:#1E3A5F">
    <th style="padding:6px 8px;text-align:left;color:#fff;font-size:9px;white-space:nowrap;border-bottom:2px solid #0f172a">Revenue Category</th>
    ${columns.map(c => `<th style="padding:6px 4px;text-align:right;color:#fff;font-size:9px;white-space:nowrap;border-bottom:2px solid #0f172a">${esc(c.label)}</th>`).join('')}
    <th style="padding:6px 8px;text-align:right;color:#fff;font-size:9px;white-space:nowrap;border-bottom:2px solid #0f172a;border-left:2px solid #334155">12-Mo Total</th>
  </tr></thead>`;

  const summaryBody = `<tbody>
    ${summaryRow('Secured Revenue', secured, '#EFF6FF', '#1D4ED8')}
    ${summaryRow('Awarded', awarded, '#ECFDF5', '#065F46')}
    ${summaryRow('Total  (Secured + Awarded)', Object.fromEntries(columns.map(c => [c.key, (secured[c.key] || 0) + (awarded[c.key] || 0)])), '#1E293B', '#FFFFFF', true)}
    <tr><td colspan="${columns.length + 2}" style="height:6px;background:#f8fafc"></td></tr>
    ${summaryRow('Weighted Pursuits', pursuits, '#FFFBEB', '#92400E')}
  </tbody>`;

  // ── Detail table builder ────────────────────────────────────────────────────
  function detailTable(title, headerCells, rows, accentColor) {
    if (!rows.length) return `<p style="color:#94a3b8;font-size:10px;font-style:italic">No ${title.toLowerCase()} in this period.</p>`;
    return `
      <h2 style="margin:0 0 8px 0;font-size:12px;color:${accentColor}">${esc(title)}</h2>
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:8.5px">
        <thead><tr style="background:${accentColor}">
          ${headerCells.map((h, i) => `<th style="padding:5px ${i < 3 ? '8px' : '5px'};text-align:${i < 3 ? 'left' : 'right'};color:#fff;white-space:nowrap;font-size:8px">${esc(h)}</th>`).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>`;
  }

  // Secured detail rows
  const secRows = secured_projects.map((p, idx) => {
    const vals = columns.map(c => fmtMoney(p.monthly[c.key] || 0));
    const bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="background:${bg}">
      <td style="padding:3px 8px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${esc(p.contract_number)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.description)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${esc(p.project_manager_name)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;white-space:nowrap;text-align:center">${esc(p.department_code)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;white-space:nowrap">${esc(fmtMoney(p.backlog))}</td>
      <td style="padding:3px 4px;border-bottom:1px solid #f1f5f9;text-align:center">${p.pct_complete}%</td>
      ${vals.map(v => `<td style="padding:3px 4px;border-bottom:1px solid #f1f5f9;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${esc(v)}</td>`).join('')}
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;white-space:nowrap;border-left:1px solid #cbd5e1">${esc(fmtMoney(p.total))}</td>
    </tr>`;
  }).join('');

  // Awarded detail rows
  const awdRows = awarded_projects.map((p, idx) => {
    const vals = columns.map(c => fmtMoney(p.monthly[c.key] || 0));
    const bg = idx % 2 === 0 ? '#fff' : '#f0fdf4';
    return `<tr style="background:${bg}">
      <td style="padding:3px 8px;border-bottom:1px solid #f1f5f9;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${esc(p.client)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;white-space:nowrap">${esc(fmtMoney(p.estimated_value))}</td>
      ${vals.map(v => `<td style="padding:3px 4px;border-bottom:1px solid #f1f5f9;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${esc(v)}</td>`).join('')}
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;white-space:nowrap;border-left:1px solid #cbd5e1">${esc(fmtMoney(p.total))}</td>
    </tr>`;
  }).join('');

  // Pursuits detail rows
  const purRows = pursuit_projects.map((p, idx) => {
    const vals = columns.map(c => fmtMoney(p.monthly[c.key] || 0));
    const bg = idx % 2 === 0 ? '#fff' : '#fffbeb';
    return `<tr style="background:${bg}">
      <td style="padding:3px 8px;border-bottom:1px solid #f1f5f9;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${esc(p.client)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:center">${esc(p.stage_name)}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:center">${p.probability_pct}%</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap">${esc(fmtMoney(p.estimated_value))}</td>
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;white-space:nowrap">${esc(fmtMoney(p.weighted_value))}</td>
      ${vals.map(v => `<td style="padding:3px 4px;border-bottom:1px solid #f1f5f9;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap">${esc(v)}</td>`).join('')}
      <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;white-space:nowrap;border-left:1px solid #cbd5e1">${esc(fmtMoney(p.total))}</td>
    </tr>`;
  }).join('');

  const monthCols = columns.length;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 9px; color: #1e293b; margin: 0; }
  h1 { margin: 0 0 2px 0; font-size: 16px; color: #1e293b; }
  .subtitle { font-size: 9px; color: #64748b; margin-bottom: 10px; }
  .kpi-strip { display: flex; gap: 16px; margin-bottom: 12px; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; }
  .kpi-label { font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
  .kpi-value { font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .section-break { page-break-before: always; padding-top: 4px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 0; }
</style>
</head>
<body>

<!-- ── Page 1: Summary ──────────────────────────────────────────────────── -->
<h1>Rolling 12-Month Revenue Forecast</h1>
<div class="subtitle">Generated ${esc(genDate)} &nbsp;·&nbsp; ${esc(deptLabel)}</div>

<div class="kpi-strip">
  <div class="kpi">
    <div class="kpi-label">12-Mo Secured</div>
    <div class="kpi-value" style="color:#2563EB">${esc(fmtMoney(secTotal))}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">12-Mo Awarded</div>
    <div class="kpi-value" style="color:#10B981">${esc(fmtMoney(awdTotal))}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Total (Secured + Awarded)</div>
    <div class="kpi-value" style="color:#1E293B">${esc(fmtMoney(combinedTotal))}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Weighted Pursuits</div>
    <div class="kpi-value" style="color:#B45309">${esc(fmtMoney(purTotal))}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Secured Projects</div>
    <div class="kpi-value" style="color:#475569">${secured_projects.length}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Awarded Opps</div>
    <div class="kpi-value" style="color:#475569">${awarded_projects.length}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Active Pursuits</div>
    <div class="kpi-value" style="color:#475569">${pursuit_projects.length}</div>
  </div>
</div>

<!-- Chart -->
<div style="margin-bottom:14px">${chartSvg}</div>

<!-- Summary table -->
<table style="font-size:9px">
  ${summaryHdr}
  ${summaryBody}
</table>

<!-- ── Page 2: Secured ───────────────────────────────────────────────────── -->
<div class="section-break">
  ${detailTable(
    `Secured Revenue — Project Detail (${secured_projects.length} projects)`,
    ['Contract #', 'Description', 'Project Manager', 'Dept', 'Backlog', '%',
     ...columns.map(c => c.label), 'Total'],
    secRows,
    '#1E3A5F'
  )}
</div>

<!-- ── Page 3: Awarded ───────────────────────────────────────────────────── -->
<div class="section-break">
  ${detailTable(
    `Awarded Opportunities — Detail (${awarded_projects.length} opportunities)`,
    ['Opportunity', 'Client', 'Full Value',
     ...columns.map(c => c.label), 'Total'],
    awdRows,
    '#065F46'
  )}
</div>

<!-- ── Page 4: Pursuits ──────────────────────────────────────────────────── -->
<div class="section-break">
  ${detailTable(
    `Weighted Pursuits — Detail (${pursuit_projects.length} opportunities)`,
    ['Opportunity', 'Client', 'Stage', 'Prob%', 'Full Value', 'Weighted',
     ...columns.map(c => c.label), 'Total'],
    purRows,
    '#92400E'
  )}
</div>

</body>
</html>`;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function generateRolling12PdfBuffer(data, filters = {}) {
  const html = buildHtml(data, filters);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
    });
    return buffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateRolling12PdfBuffer };
