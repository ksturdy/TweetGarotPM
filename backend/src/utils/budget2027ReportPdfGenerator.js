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

  const maxStack = Math.max(...months.map(m => Math.max(m.sec + m.awd, m.pur)), 1);
  const niceMax = Math.ceil(maxStack / 1e6) * 1e6 || Math.ceil(maxStack / 1e5) * 1e5 || 1;

  const barW = Math.floor(cW / months.length) - 4;
  const gap = Math.floor((cW - barW * months.length) / (months.length + 1));

  function yPos(v) { return padT + cH - (v / niceMax) * cH; }
  function barH(v) { return (v / niceMax) * cH; }

  const TICKS = 5;
  let gridLines = '';
  let axes = '';
  for (let i = 0; i <= TICKS; i++) {
    const v = (niceMax / TICKS) * i;
    const y = yPos(v);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`;
    axes += `<text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-size="8" fill="#94A3B8">${fmtMoneyShort(v)}</text>`;
  }

  let bars = '';
  months.forEach((m, i) => {
    const x = padL + gap + i * (barW + gap);
    const secH = barH(m.sec);
    const awdH = barH(m.awd);
    const purH = barH(m.pur);
    const combinedH = secH + awdH;

    // Committed stack (secured + awarded)
    if (awdH > 0) bars += `<rect x="${x}" y="${yPos(m.awd)}" width="${barW}" height="${awdH}" fill="#10B981" rx="1"/>`;
    if (secH > 0) bars += `<rect x="${x}" y="${yPos(m.sec + m.awd)}" width="${barW}" height="${secH}" fill="#2563EB" rx="1"/>`;

    // Pursuits — side by side, slightly narrower
    const purW = Math.max(2, Math.floor(barW * 0.45));
    const purX = x + barW - purW;
    if (purH > 0) bars += `<rect x="${purX}" y="${yPos(m.pur)}" width="${purW}" height="${purH}" fill="#F59E0B" opacity="0.85" rx="1"/>`;

    // Month label
    bars += `<text x="${x + barW / 2}" y="${padT + cH + 14}" text-anchor="middle" font-size="8" fill="#64748B">${esc(m.label)}</text>`;
  });

  const legend = `
    <circle cx="${padL + 12}" cy="${padT + cH + 34}" r="5" fill="#2563EB"/>
    <text x="${padL + 20}" y="${padT + cH + 38}" font-size="8" fill="#475569">Secured</text>
    <circle cx="${padL + 80}" cy="${padT + cH + 34}" r="5" fill="#10B981"/>
    <text x="${padL + 88}" y="${padT + cH + 38}" font-size="8" fill="#475569">Awarded</text>
    <circle cx="${padL + 152}" cy="${padT + cH + 34}" r="5" fill="#F59E0B"/>
    <text x="${padL + 160}" y="${padT + cH + 38}" font-size="8" fill="#475569">Weighted Pursuits</text>`;

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

  const sum = (obj) => columns.reduce((s, c) => s + (obj[c.key] || 0), 0);
  const secTotal = sum(secured);
  const awdTotal = sum(awarded);
  const purTotal = sum(pursuits);
  const combinedTotal = secTotal + awdTotal;

  const chartSvg = buildChartSvg(data);

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
    <th style="padding:6px 8px;text-align:right;color:#fff;font-size:9px;white-space:nowrap;border-bottom:2px solid #0f172a;border-left:2px solid #334155">2027 Total</th>
  </tr></thead>`;

  const summaryBody = `<tbody>
    ${summaryRow('Secured Revenue', secured, '#EFF6FF', '#1D4ED8')}
    ${summaryRow('Awarded', awarded, '#ECFDF5', '#065F46')}
    ${summaryRow('Total  (Secured + Awarded)', Object.fromEntries(columns.map(c => [c.key, (secured[c.key] || 0) + (awarded[c.key] || 0)])), '#1E293B', '#FFFFFF', true)}
    <tr><td colspan="${columns.length + 2}" style="height:6px;background:#f8fafc"></td></tr>
    ${summaryRow('Weighted Pursuits', pursuits, '#FFFBEB', '#92400E')}
  </tbody>`;

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
<h1>2027 Budget Forecast</h1>
<div class="subtitle">January – December 2027 &nbsp;·&nbsp; Generated ${esc(genDate)} &nbsp;·&nbsp; ${esc(deptLabel)}</div>

<div class="kpi-strip">
  <div class="kpi">
    <div class="kpi-label">2027 Secured</div>
    <div class="kpi-value" style="color:#2563EB">${esc(fmtMoney(secTotal))}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">2027 Awarded</div>
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
     ...columns.map(c => c.label), '2027 Total'],
    secRows,
    '#1E3A5F'
  )}
</div>

<!-- ── Page 3: Awarded ───────────────────────────────────────────────────── -->
<div class="section-break">
  ${detailTable(
    `Awarded Opportunities — Detail (${awarded_projects.length} opportunities)`,
    ['Opportunity', 'Client', 'Full Value',
     ...columns.map(c => c.label), '2027 Total'],
    awdRows,
    '#065F46'
  )}
</div>

<!-- ── Page 4: Pursuits ──────────────────────────────────────────────────── -->
<div class="section-break">
  ${detailTable(
    `Weighted Pursuits — Detail (${pursuit_projects.length} opportunities)`,
    ['Opportunity', 'Client', 'Stage', 'Prob%', 'Full Value', 'Weighted',
     ...columns.map(c => c.label), '2027 Total'],
    purRows,
    '#92400E'
  )}
</div>

</body>
</html>`;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function generateBudget2027PdfBuffer(data, filters = {}) {
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

module.exports = { generateBudget2027PdfBuffer };
