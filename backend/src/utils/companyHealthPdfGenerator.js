/**
 * Company Health Report — PDF generator (Puppeteer + inline SVG charts)
 * Portrait Letter. Page 1: header, KPIs, narrative, backlog chart.
 * Page 2: pipeline chart, dept table.
 */

const { launchBrowser } = require('./launchBrowser');

// ── Formatters ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtM(v) {
  const n = parseFloat(v);
  if (!Number.isFinite(n) || n === 0) return '$0';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtPct(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '—';
}

function fmtInt(v) {
  return Math.round(parseFloat(v) || 0).toString();
}

// ── Horizontal bar SVG ────────────────────────────────────────────────────────

function buildHorizBarSvg(rows, { W = 680, barH = 20, gap = 6, padL = 160, padR = 80, padT = 10, labelColor = '#1e293b', palette } = {}) {
  if (!rows || rows.length === 0) return '';
  const PALETTE = ['#1a2b4a', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#6366f1', '#0f766e'];
  const maxVal = Math.max(...rows.map(r => r.value), 1);
  const chartW = W - padL - padR;
  const H = padT + rows.length * (barH + gap) + 10;

  let svgRows = '';
  rows.forEach((r, i) => {
    const bw = Math.max((r.value / maxVal) * chartW, 1);
    const y = padT + i * (barH + gap);
    const color = (palette && palette[i]) || PALETTE[i % PALETTE.length];
    svgRows += `
      <text x="${padL - 6}" y="${y + barH * 0.68}" font-size="8.5" fill="${labelColor}" text-anchor="end" dominant-baseline="auto">${esc(r.label)}</text>
      <rect x="${padL}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" fill="${color}" rx="3"/>
      <text x="${(padL + bw + 5).toFixed(1)}" y="${y + barH * 0.68}" font-size="8" fill="#475569" dominant-baseline="auto">${esc(fmtM(r.value))}</text>`;
  });

  // Axis line
  svgRows += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - 4}" stroke="#cbd5e1" stroke-width="0.75"/>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">${svgRows}</svg>`;
}

// ── Narrative builder ─────────────────────────────────────────────────────────

function buildNarrative(data) {
  const { kpis, backlog_by_market, opps_by_stage, dept_breakdown, labor_summary, as_of } = data;

  const dateLabel = as_of
    ? new Date(as_of + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'the current period';

  const gmHealth = parseFloat(kpis.avg_gm_pct) >= 20 ? 'healthy'
    : parseFloat(kpis.avg_gm_pct) >= 12 ? 'acceptable' : 'below target';

  const backlog6mo = parseFloat(kpis.backlog_6mo) || 0;
  const totalBacklog = parseFloat(kpis.total_backlog) || 0;
  const coverageRatio = totalBacklog > 0 ? backlog6mo / totalBacklog : 0;
  const backlogHealth = coverageRatio >= 0.6 ? 'strong' : coverageRatio >= 0.35 ? 'moderate' : 'limited';

  const topMarket = backlog_by_market?.[0];
  const topMarketPct = topMarket && totalBacklog > 0
    ? ((parseFloat(topMarket.backlog) / totalBacklog) * 100).toFixed(0)
    : null;

  const laborAssigned = parseInt(labor_summary?.currently_assigned || '0') || 0;
  const laborTotal = parseInt(labor_summary?.total_employees || '0') || 0;
  const laborUtilPct = laborTotal > 0 ? Math.round((laborAssigned / laborTotal) * 100) : 0;
  const unfilledRoles = parseInt(labor_summary?.unfilled_roles || '0') || 0;

  const topStages = (opps_by_stage || [])
    .filter(s => parseFloat(s.total_value) > 0)
    .slice(0, 2)
    .map(s => s.stage_name);

  const sentences = [
    `As of ${dateLabel}, the company carries <strong>${fmtM(kpis.total_backlog)}</strong> in active backlog across <strong>${fmtInt(kpis.active_projects)} open projects</strong>, with an average gross margin of <strong>${fmtPct(kpis.avg_gm_pct)}</strong> — a ${gmHealth} return profile.`,

    `The 6-month backlog projection stands at <strong>${fmtM(kpis.backlog_6mo)}</strong>, reflecting <strong>${backlogHealth}</strong> near-term work coverage.` +
    (topMarket
      ? ` Backlog is most concentrated in <strong>${esc(topMarket.market)}</strong>${topMarketPct ? ` (${topMarketPct}% of total)` : ''}.`
      : ''),

    `The sales pipeline holds <strong>${fmtInt(kpis.total_opps_count)} active opportunities</strong> totaling <strong>${fmtM(kpis.total_pipeline_value)}</strong> in estimated value, with a probability-weighted pipeline of <strong>${fmtM(kpis.weighted_pipeline)}</strong>.` +
    (topStages.length > 0 ? ` Most pipeline activity sits in ${topStages.map(s => `<em>${esc(s)}</em>`).join(' and ')}.` : ''),

    laborTotal > 0
      ? `On labor, <strong>${laborAssigned} of ${laborTotal} employees (${laborUtilPct}%)</strong> are currently assigned to active projects.` +
        (unfilledRoles > 0
          ? ` <strong>${unfilledRoles} unfilled role${unfilledRoles !== 1 ? 's' : ''}</strong> require${unfilledRoles === 1 ? 's' : ''} attention.`
          : ' No unfilled roles are currently open.')
      : '',
  ].filter(Boolean);

  return sentences;
}

// ── Main HTML builder ─────────────────────────────────────────────────────────

function generateCompanyHealthHtml(data) {
  const { kpis, backlog_by_market, opps_by_stage, dept_breakdown, as_of } = data;

  const dateLabel = as_of
    ? new Date(as_of + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const narrative = buildNarrative(data);

  // ── SVG: Backlog by market ──────────────────────────────────────────────────
  const backlogRows = (backlog_by_market || [])
    .filter(r => parseFloat(r.backlog) > 0)
    .slice(0, 10)
    .map(r => ({ label: r.market, value: parseFloat(r.backlog) }));

  const backlogSvg = buildHorizBarSvg(backlogRows, { W: 680, barH: 18, gap: 5 });

  // ── SVG: Pipeline by stage ──────────────────────────────────────────────────
  const stageRows = (opps_by_stage || [])
    .filter(r => parseFloat(r.total_value) > 0)
    .map(r => ({
      label: r.stage_name,
      value: parseFloat(r.total_value),
      color: r.stage_color || undefined,
    }));

  const stageSvg = buildHorizBarSvg(stageRows, {
    W: 680,
    barH: 18,
    gap: 5,
    palette: stageRows.map(r => r.color),
  });

  // ── KPI tile helper ─────────────────────────────────────────────────────────
  const kpiTile = (label, value, sub, accent) => `
    <div style="flex:1;min-width:0;background:#fff;border:1px solid #e2e8f0;border-top:3px solid ${accent};border-radius:8px;padding:10px 12px;">
      <div style="font-size:7.5px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:16px;font-weight:700;color:#1e293b;line-height:1.1">${esc(value)}</div>
      ${sub ? `<div style="font-size:7.5px;color:#94a3b8;margin-top:2px">${esc(sub)}</div>` : ''}
    </div>`;

  // ── Dept table ──────────────────────────────────────────────────────────────
  const deptRows = (dept_breakdown || []).map((row, i) => {
    const gmColor = parseFloat(row.gm_pct) >= 20 ? '#059669' : parseFloat(row.gm_pct) >= 10 ? '#d97706' : '#dc2626';
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:5px 8px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9">${esc(row.group_name)}</td>
      <td style="padding:5px 6px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${fmtInt(row.project_count)}</td>
      <td style="padding:5px 6px;text-align:right;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9">${fmtM(row.backlog)}</td>
      <td style="padding:5px 6px;text-align:right;font-weight:700;color:${gmColor};border-bottom:1px solid #f1f5f9">${fmtPct(row.gm_pct)}</td>
      <td style="padding:5px 6px;text-align:right;color:${parseFloat(row.gross_profit) < 0 ? '#dc2626' : '#1e293b'};border-bottom:1px solid #f1f5f9">${fmtM(row.gross_profit)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; }
  .page-break { break-before: page; page-break-before: always; }
  h2.section-title {
    font-size: 11px; font-weight: 700; color: #1e293b;
    margin: 0 0 4px 0; padding-bottom: 4px; border-bottom: 1.5px solid #e2e8f0;
  }
  .section-sub { font-size: 8px; color: #64748b; margin-bottom: 10px; }
  .chart-wrap { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
</style>
</head>
<body>

<!-- ══ PAGE 1 ══════════════════════════════════════════════════════════════ -->

<!-- Header -->
<div style="background:linear-gradient(135deg,#1a2b4a 0%,#2d4a7a 100%);border-radius:8px;padding:14px 20px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em">Company Health Report</div>
    <div style="font-size:9px;color:#93c5fd;margin-top:3px">Backlog · Pipeline · Labor · Revenue Forecast</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:8px;color:#93c5fd">Snapshot Date</div>
    <div style="font-size:11px;font-weight:700;color:#fff">${esc(dateLabel)}</div>
  </div>
</div>

<!-- KPI Strip -->
<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:nowrap">
  ${kpiTile('Current Backlog', fmtM(kpis.total_backlog), `${fmtPct(kpis.avg_gm_pct)} avg GM`, '#1a2b4a')}
  ${kpiTile('Backlog 6 Mo Out', fmtM(kpis.backlog_6mo), `${fmtM(kpis.backlog_12mo)} at 12 mo`, '#3b82f6')}
  ${kpiTile('Pipeline Value', fmtM(kpis.total_pipeline_value), `${fmtInt(kpis.total_opps_count)} opportunities`, '#f97316')}
  ${kpiTile('Weighted Pipeline', fmtM(kpis.weighted_pipeline), 'probability-adjusted', '#10b981')}
  ${kpiTile('Active Projects', fmtInt(kpis.active_projects), fmtM(kpis.total_contract_value) + ' contract value', '#8b5cf6')}
  ${kpiTile('Avg Gross Margin', fmtPct(kpis.avg_gm_pct), fmtM(kpis.total_gross_profit) + ' GP$', '#14b8a6')}
</div>

<!-- Narrative -->
<div style="background:#fafbff;border:1px solid #dde4f0;border-left:4px solid #1a2b4a;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:16px">
  <div style="font-size:8.5px;font-weight:700;color:#1a2b4a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Executive Summary</div>
  ${narrative.map(s => `<p style="font-size:9.5px;color:#334155;line-height:1.55;margin-bottom:5px">${s}</p>`).join('')}
</div>

<!-- Backlog by Market -->
${backlogSvg ? `
<div class="chart-wrap" style="margin-bottom:14px">
  <h2 class="section-title">Backlog by Market</h2>
  <div class="section-sub">Active project backlog remaining by market segment</div>
  ${backlogSvg}
</div>` : ''}

<!-- ══ PAGE 2 ══════════════════════════════════════════════════════════════ -->
<div class="page-break"></div>

<!-- Header strip (page 2) -->
<div style="background:#f1f5f9;border-radius:6px;padding:8px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid #1a2b4a">
  <span style="font-size:11px;font-weight:700;color:#1a2b4a">Company Health Report</span>
  <span style="font-size:8px;color:#64748b">${esc(dateLabel)}</span>
</div>

<!-- Pipeline by Stage -->
${stageSvg ? `
<div class="chart-wrap" style="margin-bottom:14px">
  <h2 class="section-title">Pipeline by Stage</h2>
  <div class="section-sub">Total opportunity value per pipeline stage (active opportunities with value > $0)</div>
  ${stageSvg}
</div>` : ''}

<!-- Department / Market Breakdown -->
${deptRows ? `
<div style="margin-bottom:14px">
  <h2 class="section-title">Department / Market Breakdown</h2>
  <div class="section-sub">Active project backlog, margin, and gross profit by department or market</div>
  <table style="width:100%;border-collapse:collapse;font-size:8.5px">
    <thead>
      <tr style="background:#1a2b4a">
        <th style="padding:6px 8px;text-align:left;color:#fff;font-size:8px">Department / Market</th>
        <th style="padding:6px 6px;text-align:right;color:#fff;font-size:8px">Projects</th>
        <th style="padding:6px 6px;text-align:right;color:#fff;font-size:8px">Backlog</th>
        <th style="padding:6px 6px;text-align:right;color:#fff;font-size:8px">GM%</th>
        <th style="padding:6px 6px;text-align:right;color:#fff;font-size:8px">Gross Profit</th>
      </tr>
    </thead>
    <tbody>${deptRows}</tbody>
  </table>
</div>` : ''}

<!-- Footer -->
<div style="margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:7.5px;color:#94a3b8">
  <span>Titan PM &mdash; Confidential</span>
  <span>Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
</div>

</body>
</html>`;
}

// ── PDF buffer export ─────────────────────────────────────────────────────────

async function generateCompanyHealthPdfBuffer(data) {
  const html = generateCompanyHealthHtml(data);
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generateCompanyHealthPdfBuffer };
