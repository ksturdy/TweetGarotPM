/**
 * Company Health Report — PDF generator (Puppeteer + inline SVG charts)
 * Portrait Letter, 3 pages.
 * Page 1: header, KPIs, narrative, backlog by market
 * Page 2: financial health tiles, pipeline by stage, GM% trend
 * Page 3: labor forecast, department breakdown, market breakdown
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
  if (Math.abs(n) >= 1e6) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e3).toFixed(0)}K`;
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

function buildHorizBarSvg(rows, { W = 680, barH = 18, gap = 5, padL = 150, padR = 70, padT = 8, palette } = {}) {
  if (!rows || rows.length === 0) return '';
  const PALETTE = ['#1a2b4a', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#6366f1', '#0f766e'];
  const maxVal = Math.max(...rows.map(r => r.value), 1);
  const chartW = W - padL - padR;
  const H = padT + rows.length * (barH + gap) + 10;

  let svgRows = '';
  rows.forEach((r, i) => {
    const bw = Math.max((r.value / maxVal) * chartW, 2);
    const y = padT + i * (barH + gap);
    const color = (palette && palette[i]) || PALETTE[i % PALETTE.length];
    svgRows += `
      <text x="${padL - 6}" y="${y + barH * 0.68}" font-size="8" fill="#334155" text-anchor="end">${esc(r.label)}</text>
      <rect x="${padL}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" fill="${color}" rx="3"/>
      <text x="${(padL + bw + 5).toFixed(1)}" y="${y + barH * 0.68}" font-size="7.5" fill="#475569">${esc(fmtM(r.value))}</text>`;
  });
  svgRows += `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - 4}" stroke="#cbd5e1" stroke-width="0.75"/>`;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">${svgRows}</svg>`;
}

// ── GM% Trend line SVG ────────────────────────────────────────────────────────

function buildGmTrendSvg(gmTrend, backlogGmPct, { W = 680, H = 130, padL = 42, padR = 16, padT = 12, padB = 30 } = {}) {
  if (!gmTrend || gmTrend.length === 0) return '';

  const historical = gmTrend.map(r => ({ label: r.month_label, value: parseFloat(r.gm_pct) }));
  const now = new Date();
  const futureLabels = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    futureLabels.push(d.toLocaleString('en-US', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2));
  }

  const allValues = historical.map(p => p.value);
  if (backlogGmPct != null) allValues.push(parseFloat(backlogGmPct));
  const minV = Math.max(0, Math.min(...allValues) - 3);
  const maxV = Math.max(...allValues) + 3;

  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const totalPts = historical.length + futureLabels.length;
  const xStep = chartW / Math.max(totalPts - 1, 1);

  const toX = i => padL + i * xStep;
  const toY = v => padT + chartH - ((v - minV) / (maxV - minV)) * chartH;

  // Y-axis gridlines
  const yTicks = 4;
  let grid = '';
  for (let i = 0; i <= yTicks; i++) {
    const v = minV + (maxV - minV) * (i / yTicks);
    const y = toY(v);
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="0.75"/>`;
    grid += `<text x="${padL - 4}" y="${(y + 3).toFixed(1)}" font-size="7" fill="#94a3b8" text-anchor="end">${v.toFixed(1)}%</text>`;
  }

  // Historical line + area
  const histCoords = historical.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`);
  const histPath = histCoords.join(' L ');
  const areaPath = `M ${histCoords[0]} L ${histCoords.join(' L ')} L ${toX(historical.length - 1).toFixed(1)},${(padT + chartH).toFixed(1)} L ${toX(0).toFixed(1)},${(padT + chartH).toFixed(1)} Z`;

  // Projected dashed line from last historical point
  let projLine = '';
  if (backlogGmPct != null && historical.length > 0) {
    const lastIdx = historical.length - 1;
    const projCoords = [
      `${toX(lastIdx).toFixed(1)},${toY(historical[lastIdx].value).toFixed(1)}`,
      ...futureLabels.map((_, i) => `${toX(lastIdx + 1 + i).toFixed(1)},${toY(parseFloat(backlogGmPct)).toFixed(1)}`),
    ];
    projLine = `<polyline points="${projCoords.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    // Projected dots
    projLine += futureLabels.map((_, i) =>
      `<circle cx="${toX(lastIdx + 1 + i).toFixed(1)}" cy="${toY(parseFloat(backlogGmPct)).toFixed(1)}" r="2.5" fill="#3b82f6"/>`
    ).join('');
  }

  // Historical dots
  const histDots = historical.map((p, i) =>
    `<circle cx="${toX(i).toFixed(1)}" cy="${toY(p.value).toFixed(1)}" r="3" fill="#10b981"/>`
  ).join('');

  // X-axis labels (every label)
  const allLabels = [...historical.map(p => p.label), ...futureLabels];
  const xLabels = allLabels.map((lbl, i) =>
    `<text x="${toX(i).toFixed(1)}" y="${(padT + chartH + 14).toFixed(1)}" font-size="7" fill="${i < historical.length ? '#475569' : '#94a3b8'}" text-anchor="middle">${esc(lbl)}</text>`
  ).join('');

  // Legend
  const legend = `
    <rect x="${padL}" y="${H - 10}" width="8" height="4" fill="#10b981" rx="1"/>
    <text x="${padL + 11}" y="${H - 7}" font-size="7" fill="#475569">Actual GM%</text>
    <line x1="${padL + 75}" y1="${H - 8}" x2="${padL + 85}" y2="${H - 8}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="3,2"/>
    <text x="${padL + 88}" y="${H - 7}" font-size="7" fill="#475569">Projected (Backlog GM%)</text>`;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    ${grid}
    <path d="${areaPath}" fill="rgba(16,185,129,0.06)"/>
    <polyline points="${histCoords.join(' ')}" fill="none" stroke="#10b981" stroke-width="2"/>
    ${projLine}
    ${histDots}
    ${xLabels}
    ${legend}
  </svg>`;
}

// ── Narrative builder ─────────────────────────────────────────────────────────

function buildNarrative(data) {
  const { kpis, backlog_by_market, opps_by_stage, labor_summary, as_of } = data;

  const dateLabel = as_of
    ? new Date(as_of).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'the current period';

  const gmHealth = parseFloat(kpis.avg_gm_pct) >= 20 ? 'healthy'
    : parseFloat(kpis.avg_gm_pct) >= 12 ? 'acceptable' : 'below target';

  const backlog6mo = parseFloat(kpis.backlog_6mo) || 0;
  const totalBacklog = parseFloat(kpis.total_backlog) || 0;
  const coverageRatio = totalBacklog > 0 ? backlog6mo / totalBacklog : 0;
  const backlogHealth = coverageRatio >= 0.6 ? 'strong' : coverageRatio >= 0.35 ? 'moderate' : 'limited';

  const topMarket = backlog_by_market?.[0];
  const topMarketPct = topMarket && totalBacklog > 0
    ? ((parseFloat(topMarket.backlog) / totalBacklog) * 100).toFixed(0) : null;

  const laborAssigned = parseInt(labor_summary?.currently_assigned || '0') || 0;
  const laborTotal = parseInt(labor_summary?.total_employees || '0') || 0;
  const laborUtilPct = laborTotal > 0 ? Math.round((laborAssigned / laborTotal) * 100) : 0;
  const unfilledRoles = parseInt(labor_summary?.unfilled_roles || '0') || 0;

  const topStages = (opps_by_stage || [])
    .filter(s => parseFloat(s.total_value) > 0).slice(0, 2).map(s => s.stage_name);

  const cfRate = kpis.active_linked_count > 0
    ? Math.round((kpis.positive_cf_count / kpis.active_linked_count) * 100) : null;
  const over15Rate = kpis.over15_count > 0
    ? Math.round((kpis.cf_positive_over15_count / kpis.over15_count) * 100) : null;

  const sentences = [
    `As of ${dateLabel}, the company carries <strong>${fmtM(kpis.total_backlog)}</strong> in active backlog across <strong>${fmtInt(kpis.active_projects)} open projects</strong>, with an average gross margin of <strong>${fmtPct(kpis.avg_gm_pct)}</strong> — a ${gmHealth} return profile. GM in backlog stands at <strong>${fmtPct(kpis.backlog_gm_pct)}</strong>.`,

    `The 6-month backlog projection stands at <strong>${fmtM(kpis.backlog_6mo)}</strong>, reflecting <strong>${backlogHealth}</strong> near-term work coverage.` +
    (topMarket ? ` Backlog is most concentrated in <strong>${esc(topMarket.market)}</strong>${topMarketPct ? ` (${topMarketPct}% of total)` : ''}.` : ''),

    `The sales pipeline holds <strong>${fmtInt(kpis.total_opps_count)} active opportunities</strong> totaling <strong>${fmtM(kpis.total_pipeline_value)}</strong>, with a probability-weighted value of <strong>${fmtM(kpis.weighted_pipeline)}</strong>.` +
    (topStages.length > 0 ? ` Most activity sits in ${topStages.map(s => `<em>${esc(s)}</em>`).join(' and ')}.` : ''),

    `Cash flow totals <strong>${fmtM(kpis.total_cash_flow)}</strong> with <strong>${fmtM(kpis.total_open_receivables)}</strong> in open receivables.` +
    (cfRate != null ? ` <strong>${kpis.positive_cf_count} of ${kpis.active_linked_count} (${cfRate}%)</strong> active projects are cash-flow positive.` : '') +
    (over15Rate != null ? ` Of projects beyond 15% completion, <strong>${over15Rate}%</strong> are CF+.` : '') +
    (kpis.projects_that_turned_positive > 0 ? ` Projects first turn positive at an average of <strong>${fmtPct(kpis.avg_pct_at_first_positive)}</strong> completion (${kpis.projects_that_turned_positive} jobs historically).` : ''),

    laborTotal > 0
      ? `On labor, <strong>${laborAssigned} of ${laborTotal} employees (${laborUtilPct}%)</strong> are currently assigned.` +
        (unfilledRoles > 0 ? ` <strong>${unfilledRoles} unfilled role${unfilledRoles !== 1 ? 's' : ''}</strong> require attention.` : ' No unfilled roles are currently open.')
      : '',
  ].filter(Boolean);

  return sentences;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const pageHeaderStrip = (dateLabel) => `
  <div style="background:#f1f5f9;border-radius:6px;padding:7px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid #1a2b4a">
    <span style="font-size:10px;font-weight:700;color:#1a2b4a">Company Health Report</span>
    <span style="font-size:7.5px;color:#64748b">${esc(dateLabel)}</span>
  </div>`;

const footer = `
  <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:7px;color:#94a3b8">
    <span>Titan PM &mdash; Confidential</span>
    <span>Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
  </div>`;

// ── Main HTML builder ─────────────────────────────────────────────────────────

function generateCompanyHealthHtml(data) {
  const { kpis, backlog_by_market, opps_by_stage, dept_breakdown, market_breakdown, gm_trend, labor_summary, labor_forecast, as_of } = data;

  const dateLabel = as_of
    ? new Date(as_of).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const narrative = buildNarrative(data);

  // ── KPI tile helper ─────────────────────────────────────────────────────────
  const kpiTile = (label, value, sub, accent) => `
    <div style="flex:1;min-width:0;background:#fff;border:1px solid #e2e8f0;border-top:3px solid ${accent};border-radius:8px;padding:9px 11px;">
      <div style="font-size:7px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px">${esc(label)}</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;line-height:1.1">${esc(value)}</div>
      ${sub ? `<div style="font-size:7px;color:#94a3b8;margin-top:2px">${esc(sub)}</div>` : ''}
    </div>`;

  // ── Financial health tile helper ────────────────────────────────────────────
  const finTile = (label, value, sub, accent) => `
    <div style="background:#f8fafc;border-radius:7px;padding:9px 10px;border-left:3px solid ${accent};">
      <div style="font-size:6.5px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px">${esc(label)}</div>
      <div style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.1">${esc(value)}</div>
      ${sub ? `<div style="font-size:6.5px;color:#94a3b8;margin-top:2px">${esc(sub)}</div>` : ''}
    </div>`;

  // ── SVG: Backlog by market ──────────────────────────────────────────────────
  const backlogRows = (backlog_by_market || [])
    .filter(r => parseFloat(r.backlog) > 0).slice(0, 10)
    .map(r => ({ label: r.market, value: parseFloat(r.backlog) }));
  const backlogSvg = buildHorizBarSvg(backlogRows, { W: 680, barH: 17, gap: 4 });

  // ── SVG: Pipeline by stage ──────────────────────────────────────────────────
  const stageRows = (opps_by_stage || [])
    .filter(r => parseFloat(r.total_value) > 0)
    .map(r => ({ label: r.stage_name, value: parseFloat(r.total_value), color: r.stage_color }));
  const stageSvg = buildHorizBarSvg(stageRows, {
    W: 360, barH: 17, gap: 4, padL: 120, padR: 60,
    palette: stageRows.map(r => r.color),
  });

  // ── SVG: GM% Trend ─────────────────────────────────────────────────────────
  const gmTrendSvg = buildGmTrendSvg(gm_trend || [], kpis.backlog_gm_pct, { W: 300, H: 130 });

  // ── Financial health tiles ──────────────────────────────────────────────────
  const cfOver15Val = kpis.over15_count > 0
    ? `${kpis.cf_positive_over15_count}/${kpis.over15_count} (${Math.round(kpis.cf_positive_over15_count / kpis.over15_count * 100)}%)`
    : '—';
  const avgPctVal = kpis.projects_that_turned_positive > 0
    ? fmtPct(kpis.avg_pct_at_first_positive) : '—';
  const avgPctSub = kpis.projects_that_turned_positive > 0
    ? `${kpis.projects_that_turned_positive} jobs historically` : undefined;
  const cfAccent = kpis.total_cash_flow >= 0 ? '#10b981' : '#ef4444';

  // ── Dept table ──────────────────────────────────────────────────────────────
  const deptRows = (dept_breakdown || []).map((row, i) => {
    const gmColor = parseFloat(row.gm_pct) >= 20 ? '#059669' : parseFloat(row.gm_pct) >= 10 ? '#d97706' : '#dc2626';
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:4px 6px;color:#64748b;font-size:7.5px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${esc(row.department_number || '—')}</td>
      <td style="padding:4px 6px;font-weight:600;color:#1e293b;font-size:7.5px;border-bottom:1px solid #f1f5f9">${esc(row.group_name)}</td>
      <td style="padding:4px 5px;text-align:right;color:#475569;font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtInt(row.project_count)}</td>
      <td style="padding:4px 5px;text-align:right;font-weight:600;font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtM(row.backlog)}</td>
      <td style="padding:4px 5px;text-align:right;font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtM(row.gross_profit)}</td>
      <td style="padding:4px 5px;text-align:right;font-weight:700;color:${gmColor};font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtPct(row.gm_pct)}</td>
    </tr>`;
  }).join('');

  // ── Market table ────────────────────────────────────────────────────────────
  const marketRows = (market_breakdown || []).map((row, i) => {
    const gmColor = parseFloat(row.gm_pct) >= 20 ? '#059669' : parseFloat(row.gm_pct) >= 10 ? '#d97706' : '#dc2626';
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:4px 6px;font-weight:600;color:#1e293b;font-size:7.5px;border-bottom:1px solid #f1f5f9">${esc(row.market)}</td>
      <td style="padding:4px 5px;text-align:right;color:#475569;font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtInt(row.project_count)}</td>
      <td style="padding:4px 5px;text-align:right;font-weight:600;font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtM(row.backlog)}</td>
      <td style="padding:4px 5px;text-align:right;font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtM(row.gross_profit)}</td>
      <td style="padding:4px 5px;text-align:right;font-weight:700;color:${gmColor};font-size:7.5px;border-bottom:1px solid #f1f5f9">${fmtPct(row.gm_pct)}</td>
    </tr>`;
  }).join('');

  // ── Labor stats ─────────────────────────────────────────────────────────────
  const laborStatTile = (label, value) => `
    <div style="flex:1;min-width:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:7px 9px;text-align:center">
      <div style="font-size:6.5px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:2px">${esc(label)}</div>
      <div style="font-size:13px;font-weight:700;color:#1e293b">${esc(value)}</div>
    </div>`;

  const horizons = labor_forecast?.horizons || { h6: 0, h12: 0, h18: 0 };
  const byTrade = (labor_forecast?.by_trade || []);

  const tableHeader = (cols, thStyle = '') => `<tr style="background:#1a2b4a">${cols.map(c =>
    `<th style="padding:5px 6px;color:#fff;font-size:7.5px;font-weight:600;${c.right ? 'text-align:right;' : ''}${thStyle}">${esc(c.label)}</th>`
  ).join('')}</tr>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; }
  .page-break { break-before: page; page-break-before: always; }
  h2.section-title { font-size: 10px; font-weight: 700; color: #1e293b; margin: 0 0 3px 0; padding-bottom: 4px; border-bottom: 1.5px solid #e2e8f0; }
  .section-sub { font-size: 7.5px; color: #64748b; margin-bottom: 8px; }
  .chart-wrap { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 13px; }
</style>
</head>
<body>

<!-- ══ PAGE 1: Header · KPIs · Narrative · Backlog ══════════════════════════ -->

<div style="background:linear-gradient(135deg,#1a2b4a 0%,#2d4a7a 100%);border-radius:8px;padding:14px 20px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em">Company Health Report</div>
    <div style="font-size:8.5px;color:#93c5fd;margin-top:3px">Backlog · Pipeline · Financial Health · Labor · Breakdown</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:7.5px;color:#93c5fd">Snapshot Date</div>
    <div style="font-size:11px;font-weight:700;color:#fff">${esc(dateLabel)}</div>
  </div>
</div>

<!-- Top KPI strip -->
<div style="display:flex;gap:7px;margin-bottom:12px">
  ${kpiTile('Active Projects', fmtInt(kpis.active_projects), `${fmtM(kpis.total_contract_value)} contract value`, '#1a2b4a')}
  ${kpiTile('Total Backlog', fmtM(kpis.total_backlog), `6mo: ${fmtM(kpis.backlog_6mo)}`, '#f97316')}
  ${kpiTile('Avg Gross Margin', fmtPct(kpis.avg_gm_pct), `GP: ${fmtM(kpis.total_gross_profit)}`, '#10b981')}
  ${kpiTile('Cash Flow', fmtM(kpis.total_cash_flow), `Receivables: ${fmtM(kpis.total_open_receivables)}`, kpis.total_cash_flow >= 0 ? '#10b981' : '#ef4444')}
  ${kpiTile('Pipeline', fmtM(kpis.total_pipeline_value), `${fmtInt(kpis.total_opps_count)} opps · wtd ${fmtM(kpis.weighted_pipeline)}`, '#3b82f6')}
  ${kpiTile('GM in Backlog', fmtPct(kpis.backlog_gm_pct), `${fmtInt(kpis.active_projects)} active projects`, '#8b5cf6')}
</div>

<!-- Narrative -->
<div style="background:#fafbff;border:1px solid #dde4f0;border-left:4px solid #1a2b4a;border-radius:0 8px 8px 0;padding:11px 15px;margin-bottom:14px">
  <div style="font-size:8px;font-weight:700;color:#1a2b4a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Executive Summary</div>
  ${narrative.map(s => `<p style="font-size:9px;color:#334155;line-height:1.55;margin-bottom:4px">${s}</p>`).join('')}
</div>

<!-- Backlog by Market -->
${backlogSvg ? `
<div class="chart-wrap" style="margin-bottom:0">
  <h2 class="section-title">Backlog by Market</h2>
  <div class="section-sub">Active project backlog remaining by market segment</div>
  ${backlogSvg}
</div>` : ''}
${footer}

<!-- ══ PAGE 2: Financial Health · Pipeline · GM% Trend ══════════════════════ -->
<div class="page-break"></div>
${pageHeaderStrip(dateLabel)}

<!-- Financial Health tiles -->
<div style="margin-bottom:12px">
  <h2 class="section-title">Financial Health</h2>
  <div class="section-sub">Cash flow and margin metrics — Open &amp; Soft-Closed projects only</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px">
    ${finTile('Net Cash Flow', fmtM(kpis.total_cash_flow), undefined, cfAccent)}
    ${finTile('Open Receivables', fmtM(kpis.total_open_receivables), undefined, '#f97316')}
    ${finTile('Avg Gross Margin', fmtPct(kpis.avg_gm_pct), `GP: ${fmtM(kpis.total_gross_profit)}`, '#10b981')}
    ${finTile('GM in Backlog', fmtPct(kpis.backlog_gm_pct), undefined, '#8b5cf6')}
    ${finTile('Projects w/ Positive CF', `${kpis.positive_cf_count} / ${kpis.active_linked_count}`, undefined, '#3b82f6')}
    ${finTile('CF+ Jobs >15% Complete', cfOver15Val, undefined, '#f59e0b')}
    ${finTile('Avg % Comp at CF+', avgPctVal, avgPctSub, '#1a2b4a')}
  </div>
</div>

<!-- Pipeline + GM% Trend side by side -->
<div style="display:flex;gap:12px;margin-bottom:0">
  ${stageSvg ? `
  <div class="chart-wrap" style="flex:1.2">
    <h2 class="section-title">Pipeline by Stage</h2>
    <div class="section-sub">Opportunity value per pipeline stage</div>
    ${stageSvg}
  </div>` : ''}
  ${gmTrendSvg ? `
  <div class="chart-wrap" style="flex:1">
    <h2 class="section-title">GM% Trend</h2>
    <div class="section-sub">Weighted GM% — last 6 months + backlog projection</div>
    ${gmTrendSvg}
  </div>` : ''}
</div>
${footer}

<!-- ══ PAGE 3: Labor · Department · Market ══════════════════════════════════ -->
<div class="page-break"></div>
${pageHeaderStrip(dateLabel)}

<!-- Labor Forecast -->
<div style="margin-bottom:12px">
  <h2 class="section-title">Labor Forecast</h2>
  <div class="section-sub">Current headcount status and 18-month Vista-based outlook by trade</div>
  <div style="display:flex;gap:7px;margin-bottom:8px">
    ${laborStatTile('Total Employees', labor_summary?.total_employees || '—')}
    ${laborStatTile('Currently Assigned', labor_summary?.currently_assigned || '—')}
    ${laborStatTile('Upcoming Assignments', labor_summary?.upcoming_assignments || '—')}
    ${laborStatTile('Ending in 2 Wks', labor_summary?.ending_within_two_weeks || '—')}
    ${laborStatTile('Unfilled Roles', labor_summary?.unfilled_roles || '—')}
    ${laborStatTile('Peak 0–6 Mo', `${horizons.h6} workers`)}
    ${laborStatTile('Peak 6–12 Mo', `${horizons.h12} workers`)}
    ${laborStatTile('Peak 12–18 Mo', `${horizons.h18} workers`)}
  </div>
  ${byTrade.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;font-size:8px;max-width:420px">
    <thead>${tableHeader([
      { label: 'Trade' }, { label: '0–6 Mo Peak', right: true },
      { label: '6–12 Mo Peak', right: true }, { label: '12–18 Mo Peak', right: true }
    ])}</thead>
    <tbody>${byTrade.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:4px 6px;font-weight:600;color:#1e293b;font-size:8px;border-bottom:1px solid #f1f5f9">${esc(t.trade)}</td>
        <td style="padding:4px 6px;text-align:right;font-size:8px;border-bottom:1px solid #f1f5f9">${t.h6}</td>
        <td style="padding:4px 6px;text-align:right;font-size:8px;border-bottom:1px solid #f1f5f9">${t.h12}</td>
        <td style="padding:4px 6px;text-align:right;font-size:8px;border-bottom:1px solid #f1f5f9">${t.h18}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}
</div>

<!-- Department + Market side by side -->
<div style="display:flex;gap:12px">
  <!-- Department Breakdown -->
  <div style="flex:1.2">
    <h2 class="section-title">Department Breakdown</h2>
    <div class="section-sub">Active projects by department</div>
    ${deptRows ? `
    <table style="width:100%;border-collapse:collapse;font-size:7.5px">
      <thead>${tableHeader([
        { label: 'Dept #' }, { label: 'Department Name' },
        { label: 'Projects', right: true }, { label: 'Backlog', right: true },
        { label: 'Gross Profit', right: true }, { label: 'GM%', right: true }
      ])}</thead>
      <tbody>${deptRows}</tbody>
    </table>` : '<div style="color:#94a3b8;font-size:8px">No data</div>'}
  </div>

  <!-- Market Breakdown -->
  <div style="flex:1">
    <h2 class="section-title">Market Breakdown</h2>
    <div class="section-sub">Active projects by market segment</div>
    ${marketRows ? `
    <table style="width:100%;border-collapse:collapse;font-size:7.5px">
      <thead>${tableHeader([
        { label: 'Market' }, { label: 'Projects', right: true },
        { label: 'Backlog', right: true }, { label: 'Gross Profit', right: true },
        { label: 'GM%', right: true }
      ])}</thead>
      <tbody>${marketRows}</tbody>
    </table>` : '<div style="color:#94a3b8;font-size:8px">No data</div>'}
  </div>
</div>
${footer}

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
