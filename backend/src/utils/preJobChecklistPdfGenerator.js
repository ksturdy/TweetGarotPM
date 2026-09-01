const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Handles both pg `date` strings ("2026-08-01") and Date objects
const toISODate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

const fmtDate = (iso) => {
  const s = toISODate(iso);
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmt$ = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3).toLocaleString('en-US')}K`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const MGMT_ROLES = [
  'Project Manager', 'Assistant PM', 'Project Coordinator',
  'Safety Manager', 'BIM Lead', 'BIM Manager', 'Project Engineer',
];

const TRADE_SEGMENT_KEY = { pf: '40', sm: '30', pl: '50' };
const FORECAST_TRADES = [
  { key: 'pf', label: 'Pipefitter',  color: '#3b82f6' },
  { key: 'sm', label: 'Sheet Metal', color: '#10b981' },
  { key: 'pl', label: 'Plumber',     color: '#f59e0b' },
];
const HPP = 160; // hours per person per month

// ── Contour multiplier (ported from frontend utils/contours.ts) ──────────────
function getContourMultipliers(months, contour) {
  const multipliers = [];
  for (let i = 0; i < months; i++) {
    const p = months > 1 ? i / (months - 1) : 0.5;
    let w;
    switch (contour) {
      case 'front':    w = 2 - p * 1.5; break;
      case 'back':     w = 0.5 + p * 1.5; break;
      case 'bell':     w = Math.exp(-Math.pow((p - 0.5) * 3, 2)) * 1.5 + 0.5; break;
      case 'turtle':   w = Math.exp(-Math.pow((p - 0.5) * 2, 2)) * 0.8 + 0.6; break;
      case 'double': {
        const p1 = Math.exp(-Math.pow((p - 0.25) * 5, 2));
        const p2 = Math.exp(-Math.pow((p - 0.75) * 5, 2));
        w = (p1 + p2) * 0.8 + 0.4; break;
      }
      case 'early':    w = Math.exp(-Math.pow((p - 0.2) * 4, 2)) * 1.8 + 0.2; break;
      case 'late':     w = Math.exp(-Math.pow((p - 0.8) * 4, 2)) * 1.8 + 0.2; break;
      case 'scurve':   w = Math.exp(-Math.pow((p - 0.5) * 2.5, 2)) * 1.2 + 0.4; break;
      case 'rampup':   w = 0.1 + p * 1.9; break;
      case 'rampdown': w = 2 - p * 1.9; break;
      case 'gradual':  w = Math.pow(Math.sin(p * Math.PI), 2) * 1.5 + 0.2; break;
      default:         w = 1; break;
    }
    multipliers.push(w);
  }
  const sum = multipliers.reduce((a, b) => a + b, 0);
  return multipliers.map(w => (w / sum) * months);
}

// ── Segment color map (matches CostTypeSchedule UI colors) ───────────────────
const SEG_COLOR = {
  '30':         '#3b82f6',
  '35':         '#60a5fa',
  '40':         '#06b6d4',
  '45':         '#22d3ee',
  '50':         '#38bdf8',
  '55':         '#7dd3fc',
  '70':         '#64748b',
  'bas':        '#8b5cf6',
  'material':   '#10b981',
  'subcontract':'#f59e0b',
  'rental':     '#a78bfa',
  'equipment':  '#f87171',
  'gc':         '#9ca3af',
};

const SEGMENT_ORDER = [
  { key: '30',         label: 'Sheet Metal Field', isLabor: true  },
  { key: '35',         label: 'Sheet Metal Shop',  isLabor: true  },
  { key: '40',         label: 'Pipefitter Field',  isLabor: true  },
  { key: '45',         label: 'Pipefitter Shop',   isLabor: true  },
  { key: '50',         label: 'Plumbing Field',    isLabor: true  },
  { key: '55',         label: 'Plumbing Shop',     isLabor: true  },
  { key: '70',         label: 'Overhead',          isLabor: true  },
  { key: 'bas',        label: 'BAS',               isLabor: true  },
  { key: 'material',   label: 'Material',          isLabor: false },
  { key: 'subcontract',label: 'Subcontracts',      isLabor: false },
  { key: 'rental',     label: 'Rentals',           isLabor: false },
  { key: 'equipment',  label: 'MEP Equipment',     isLabor: false },
  { key: 'gc',         label: 'General Conditions',isLabor: false },
];

const fmtShortDate = (d) => {
  const s = toISODate(d);
  if (!s) return '—';
  const dt = new Date(s + 'T00:00:00');
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getMonth() + 1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
};

const monthsDiff = (start, end) => {
  const s = toISODate(start); const e = toISODate(end);
  if (!s || !e) return null;
  const sd = new Date(s + 'T00:00:00'); const ed = new Date(e + 'T00:00:00');
  if (isNaN(sd) || isNaN(ed)) return null;
  return Math.max(1, (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth()));
};

// ── Cost Type Schedule Table ──────────────────────────────────────────────────
function buildScheduleTable(segments, segCosts, projectStart, projectEnd) {
  if (!segments || segments.length === 0) return '';

  const segMap = {};
  segments.forEach(s => { segMap[s.segment_key] = s; });
  const costMap = {};
  (segCosts || []).forEach(c => { costMap[c.segment_key] = c; });

  const dateToMs = (d) => {
    const s = toISODate(d);
    return s ? new Date(s + 'T00:00:00').getTime() : NaN;
  };

  // Overall date range for Gantt bars
  const allMs = [];
  SEGMENT_ORDER.forEach(def => {
    const seg = segMap[def.key];
    if (seg?.start_date) allMs.push(dateToMs(seg.start_date));
    if (seg?.end_date)   allMs.push(dateToMs(seg.end_date));
  });
  if (projectStart) allMs.push(dateToMs(projectStart));
  if (projectEnd)   allMs.push(dateToMs(projectEnd));
  const validMs = allMs.filter(ms => !isNaN(ms));
  const minMs = validMs.length ? Math.min(...validMs) : 0;
  const maxMs = validMs.length ? Math.max(...validMs) : 1;
  const totalMs = maxMs - minMs || 1;

  // Month header ticks
  const tickStart = new Date(minMs); tickStart.setDate(1);
  const tickEnd   = new Date(maxMs);
  const ticks = [];
  const tc = new Date(tickStart);
  while (tc <= tickEnd) {
    ticks.push({
      pct: ((tc.getTime() - minMs) / totalMs) * 100,
      label: tc.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    });
    tc.setMonth(tc.getMonth() + 1);
  }
  const labelEvery = ticks.length <= 7 ? 1 : ticks.length <= 14 ? 2 : 3;

  const ganttHeader = `
    <td style="padding:0;width:240px;min-width:180px;position:relative;height:20px;vertical-align:bottom;">
      <div style="position:relative;width:100%;height:18px;">
        ${ticks.map((t, i) => `
          <div style="position:absolute;left:${t.pct.toFixed(1)}%;top:0;bottom:0;border-left:1px solid #e2e8f0;"></div>
          ${i % labelEvery === 0 ? `<span style="position:absolute;left:${t.pct.toFixed(1)}%;font-size:6.5pt;color:#94a3b8;white-space:nowrap;transform:translateX(-50%);top:4px;">${esc(t.label)}</span>` : ''}
        `).join('')}
      </div>
    </td>`;

  const makeGroupHeader = (label, color) => `
    <tr>
      <td colspan="8" style="background:${color};color:white;font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:3px 8px;">${label}</td>
    </tr>`;

  const makeRow = (def, isEven) => {
    const seg   = segMap[def.key] || {};
    const costs = costMap[def.key] || {};
    const color = SEG_COLOR[def.key] || '#94a3b8';
    const bg    = isEven ? '#f8fafc' : 'white';
    const estHrs = costs.est_hours  ? Number(costs.est_hours).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
    const estCost = costs.est_cost  ? fmt$(costs.est_cost) : '—';
    const start  = fmtShortDate(seg.start_date);
    const end    = fmtShortDate(seg.end_date);
    const dur    = seg.start_date && seg.end_date ? (monthsDiff(seg.start_date, seg.end_date) + 'mo') : '—';
    const contour = seg.contour_type ? (seg.contour_type.charAt(0).toUpperCase() + seg.contour_type.slice(1)) : '—';

    // Gantt bar
    let barHtml = '<div style="width:100%;height:14px;background:#f1f5f9;border-radius:2px;position:relative;"></div>';
    if (seg.start_date && seg.end_date) {
      const x1 = ((dateToMs(seg.start_date) - minMs) / totalMs) * 100;
      const x2 = ((dateToMs(seg.end_date)   - minMs) / totalMs) * 100;
      const w  = Math.max(x2 - x1, 1);
      barHtml = `<div style="width:100%;height:14px;background:#f1f5f9;border-radius:2px;position:relative;">
        <div style="position:absolute;left:${x1.toFixed(1)}%;width:${w.toFixed(1)}%;height:100%;background:${color};border-radius:2px;opacity:0.85;"></div>
      </div>`;
    }

    return `<tr style="background:${bg};">
      <td style="padding:3px 6px;border:1px solid #e2e8f0;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};vertical-align:middle;margin-right:4px;"></span>
        <span style="font-size:8pt;">${esc(def.label)}</span>
        <span style="font-size:6.5pt;color:#94a3b8;margin-left:3px;">${def.key.toUpperCase()}</span>
      </td>
      <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:right;font-size:7.5pt;">${estHrs}</td>
      <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:right;font-size:7.5pt;">${estCost}</td>
      <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:center;font-size:7.5pt;">${start}</td>
      <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:center;font-size:7.5pt;">${end}</td>
      <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:center;font-size:7.5pt;">${dur}</td>
      <td style="padding:3px 6px;border:1px solid #e2e8f0;font-size:7.5pt;">${contour}</td>
      <td style="padding:3px 4px;border:1px solid #e2e8f0;">${barHtml}</td>
    </tr>`;
  };

  const laborDefs    = SEGMENT_ORDER.filter(d => d.isLabor);
  const nonLaborDefs = SEGMENT_ORDER.filter(d => !d.isLabor);
  let rowIdx = 0;

  return `<table style="width:100%;border-collapse:collapse;font-size:8pt;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:left;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Cost Type</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;">Est Hrs</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:right;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Est $</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Start</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">End</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;text-align:center;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Dur</th>
        <th style="padding:4px 6px;border:1px solid #e2e8f0;font-size:7pt;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Contour</th>
        ${ganttHeader}
      </tr>
    </thead>
    <tbody>
      ${makeGroupHeader('Labor', '#1e3a5f')}
      ${laborDefs.map(d => makeRow(d, rowIdx++ % 2 === 0)).join('')}
      ${makeGroupHeader('Non-Labor', '#374151')}
      ${nonLaborDefs.map(d => makeRow(d, rowIdx++ % 2 === 0)).join('')}
    </tbody>
  </table>`;
}

// ── Headcount Chart SVG ───────────────────────────────────────────────────────
function buildHeadcountSvg(laborData, segments, startDate, endDate) {
  const startIso = toISODate(startDate);
  const endIso   = toISODate(endDate);
  if (!startIso || !endIso) return '';

  const today = new Date(); today.setDate(1); today.setHours(0, 0, 0, 0);
  const endDt   = new Date(endIso   + 'T00:00:00'); endDt.setDate(1);
  const startDt = new Date(startIso + 'T00:00:00'); startDt.setDate(1);
  const chartStartDt = new Date(Math.max(today.getTime(), startDt.getTime())); chartStartDt.setDate(1);

  const chartMonths = [];
  const cur = new Date(chartStartDt);
  while (cur <= endDt) {
    chartMonths.push({ label: cur.toLocaleDateString('en-US', { month: 'short' }), ym: cur.toISOString().slice(0, 7), pf: 0, sm: 0, pl: 0 });
    cur.setMonth(cur.getMonth() + 1);
  }
  if (chartMonths.length === 0) return '';

  // Compute headcount per trade
  const labor = laborData || [];
  FORECAST_TRADES.forEach(t => {
    const rows = labor.filter(r => r.trade === t.key);
    const est  = rows.reduce((s, r) => s + (r.est_hours  || 0), 0);
    const jtd  = rows.reduce((s, r) => s + (r.jtd_hours  || 0), 0);
    const remaining = Math.max(0, est - jtd);
    if (remaining <= 0) return;

    const segKey = TRADE_SEGMENT_KEY[t.key];
    const seg = (segments || []).find(s => s.segment_key === segKey);
    const contour = seg?.contour_type || 'flat';
    const multipliers = getContourMultipliers(chartMonths.length, contour);
    const totalMult = multipliers.reduce((s, v) => s + v, 0) || 1;
    chartMonths.forEach((m, i) => {
      m[t.key] = (remaining * (multipliers[i] / totalMult)) / HPP;
    });
  });

  const maxHC = Math.max(...chartMonths.map(m => m.pf + m.sm + m.pl), 1);
  const yMax  = Math.ceil(maxHC / 5) * 5 || 10;
  const barCount = chartMonths.length;
  const barWidth = barCount > 0 ? 100 / barCount : 0;
  const labelEvery = barCount <= 12 ? 1 : barCount <= 18 ? 2 : 3;
  const chartH = 140;
  const W = 480;

  // Year boundary markers
  const yearBounds = [];
  let lastYr = '';
  chartMonths.forEach((m, i) => {
    const yr = m.ym.slice(0, 4);
    if (yr !== lastYr) { yearBounds.push({ index: i, label: yr }); lastYr = yr; }
  });

  const pxPerPct = (W - 40) / 100;

  const bars = chartMonths.map((m, i) => {
    const xPct  = (i / barCount) * 95;
    const xPx   = 40 + xPct * pxPerPct;
    const bwPx  = barWidth * 0.82 * pxPerPct;
    const plH   = yMax > 0 ? (m.pl / yMax) * chartH : 0;
    const smH   = yMax > 0 ? (m.sm / yMax) * chartH : 0;
    const pfH   = yMax > 0 ? (m.pf / yMax) * chartH : 0;
    const centerX = xPx + bwPx / 2;
    return `
      <rect x="${xPx.toFixed(1)}" y="${(chartH - plH).toFixed(1)}" width="${bwPx.toFixed(1)}" height="${plH.toFixed(1)}" fill="#f59e0b" rx="1"/>
      <rect x="${xPx.toFixed(1)}" y="${(chartH - plH - smH).toFixed(1)}" width="${bwPx.toFixed(1)}" height="${smH.toFixed(1)}" fill="#10b981" rx="1"/>
      <rect x="${xPx.toFixed(1)}" y="${(chartH - plH - smH - pfH).toFixed(1)}" width="${bwPx.toFixed(1)}" height="${pfH.toFixed(1)}" fill="#3b82f6" rx="1"/>
      ${i % labelEvery === 0 ? `<text x="${centerX.toFixed(1)}" y="${(chartH + 12).toFixed(1)}" font-size="8" fill="#64748b" text-anchor="middle">${esc(m.label)}</text>` : ''}`;
  }).join('');

  const yearLabels = yearBounds.map((b, idx) => {
    const xStart = (b.index / barCount) * 95;
    const xEnd   = yearBounds[idx + 1] ? (yearBounds[idx + 1].index / barCount) * 95 : 95;
    const xPx = 40 + ((xStart + xEnd) / 2) * pxPerPct;
    return `<text x="${xPx.toFixed(1)}" y="${(chartH + 26).toFixed(1)}" font-size="9" font-weight="600" fill="#1e293b" text-anchor="middle">${b.label}</text>`;
  }).join('');

  const gridLines = `
    <line x1="40" y1="0"        x2="${W}" y2="0"        stroke="#e2e8f0" stroke-dasharray="2,2"/>
    <line x1="40" y1="${(chartH/2).toFixed(1)}" x2="${W}" y2="${(chartH/2).toFixed(1)}" stroke="#e2e8f0" stroke-dasharray="2,2"/>
    <line x1="40" y1="${chartH}" x2="${W}" y2="${chartH}" stroke="#e2e8f0"/>
    <text x="38" y="10"           font-size="8" fill="#64748b" text-anchor="end">${yMax}</text>
    <text x="38" y="${(chartH/2+4).toFixed(1)}" font-size="8" fill="#64748b" text-anchor="end">${Math.round(yMax/2)}</text>
    <text x="38" y="${chartH}"    font-size="8" fill="#64748b" text-anchor="end">0</text>`;

  const totalH = chartH + 36;
  return `
    <div style="font-size:7.5pt;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Projected Headcount by Trade (people)</div>
    <svg width="100%" viewBox="0 0 ${W} ${totalH}" style="display:block;">
      ${gridLines}
      ${bars}
      ${yearLabels}
    </svg>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;font-size:7.5pt;color:#374151;">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#3b82f6;vertical-align:middle;margin-right:3px;"></span>Pipefitter</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#10b981;vertical-align:middle;margin-right:3px;"></span>Sheet Metal</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#f59e0b;vertical-align:middle;margin-right:3px;"></span>Plumber</span>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────

function sectionHeader(title, color = '#002356') {
  return `<div class="section-header" style="background:${color};">${esc(title)}</div>`;
}

function infoRow(label, value) {
  if (!value) return '';
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

function hasSectionContent(notes, items) {
  return !!(notes || (Array.isArray(items) && items.length > 0));
}

function genericRows(items) {
  return items.map(it => `
    <tr>
      <td>${esc(it.description)}</td>
      <td style="text-align:right">${it.budget ? fmt$(it.budget) : '—'}</td>
      <td>${esc(it.notes || '')}</td>
    </tr>`).join('');
}

function generatePreJobChecklistPdfHtml(data, logoBase64 = '') {
  const { project, checklist, assignments, segments, segCosts, laborData, siteMapBase64, siteMapMimeType } = data;

  const mgmtTeam = (assignments || []).filter(a => MGMT_ROLES.includes(a.role));
  const fieldTeam = (assignments || []).filter(a => !MGMT_ROLES.includes(a.role));
  const pi          = checklist?.project_info || {};
  const labor       = checklist?.labor || {};
  const material    = checklist?.material || {};
  const subs        = checklist?.subcontracts || {};
  const rental      = checklist?.rental || {};
  const mep         = checklist?.mep_equipment || {};
  const gc          = checklist?.general_conditions || {};
  const orientation = checklist?.orientation || {};
  const laborTrades   = labor.trades || [];
  const materialItems = material.items || [];
  const subItems      = subs.items || [];
  const rentalItems   = rental.items || [];
  const mepItems      = mep.items || [];
  const gcItems       = gc.items || [];
  const otherContacts = pi.other_contacts || [];
  const keyDates      = pi.key_dates || [];

  const startDate = project?.start_date;
  const endDate   = project?.end_date;

  const printDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const scheduleTable = buildScheduleTable(segments, segCosts, startDate, endDate);
  const headcountSvg  = buildHeadcountSvg(laborData, segments, startDate, endDate);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page { margin: 0.45in; size: letter portrait; }
* { box-sizing: border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9pt;
  color: #1e293b;
  line-height: 1.35;
  margin: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #002356 0%, #003580 100%);
  color: white;
  padding: 10px 14px;
  border-radius: 4px;
  margin-bottom: 10px;
}
.logo-pill {
  background: white;
  border-radius: 4px;
  padding: 5px 10px;
  display: flex;
  align-items: center;
  min-width: 100px;
  min-height: 38px;
}
.logo-pill img { height: 32px; max-width: 150px; object-fit: contain; }
.header-title { text-align: right; }
.header-title h1 { margin: 0; font-size: 14pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #f97316; }
.header-title .proj-name { font-size: 9pt; color: #93c5fd; margin-top: 2px; }
.header-title .print-date { font-size: 7pt; color: #93c5fd; margin-top: 1px; opacity: 0.7; }

.info-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 8px 12px;
}
.info-card table { width: 100%; border-collapse: collapse; }
.info-card td { padding: 2px 4px; font-size: 8.5pt; vertical-align: top; }
.info-card td.lbl { color: #64748b; font-weight: 600; white-space: nowrap; width: 110px; }

.section { margin-bottom: 12px; page-break-inside: avoid; }
.section-header {
  color: white;
  font-size: 8pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 3px 3px 0 0;
}
.section-body {
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 3px 3px;
  padding: 8px 10px;
}
.notes-text { font-size: 8.5pt; color: #334155; white-space: pre-wrap; margin-bottom: 6px; }

table.data { width: 100%; border-collapse: collapse; font-size: 8pt; }
table.data th {
  background: #f1f5f9; color: #475569; font-weight: 700;
  text-transform: uppercase; font-size: 7pt; letter-spacing: 0.04em;
  padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left;
}
table.data td { padding: 4px 6px; border: 1px solid #e2e8f0; vertical-align: top; }
table.data tr:nth-child(even) td { background: #f8fafc; }

.team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.team-group-label {
  font-size: 7pt; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: #475569; margin-bottom: 4px;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;
}

.check-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; font-size: 8.5pt; }
.check-item { display: flex; align-items: center; gap: 4px; }
.check-box {
  width: 12px; height: 12px; border: 1.5px solid #94a3b8; border-radius: 2px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 9pt; color: #002356; font-weight: 900;
}

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.field-label { font-size: 7.5pt; color: #64748b; font-weight: 600; margin-bottom: 1px; }
.field-value { font-size: 8.5pt; color: #1e293b; }
</style>
</head>
<body>

<div class="header">
  <div class="logo-pill">
    ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" />` : '<div style="width:80px;height:30px;"></div>'}
  </div>
  <div class="header-title">
    <h1>Pre-Job Checklist</h1>
    <div class="proj-name">${esc(project?.name || '')}${project?.number ? ` · ${esc(project.number)}` : ''}</div>
    <div class="print-date">Printed ${esc(printDate)}</div>
  </div>
</div>

<!-- Project Info Card -->
<div class="info-card">
  <table>
    ${infoRow('Job Name', project?.name)}
    ${infoRow('Customer / Owner', project?.customer_name)}
    ${infoRow('Location', [project?.ship_city, project?.ship_state].filter(Boolean).join(', ') || project?.address || '')}
    ${infoRow('Contract Value', project?.contract_value ? fmt$(project.contract_value) : null)}
    ${infoRow('Contract #', project?.number)}
  </table>
  <table>
    ${infoRow('Project Manager', project?.manager_name)}
    ${infoRow('Start Date', fmtDate(startDate))}
    ${infoRow('Est. Completion', fmtDate(endDate))}
    ${infoRow('Market', project?.market)}
    ${infoRow('Department', project?.department_name)}
  </table>
</div>

<!-- Project Team -->
${(mgmtTeam.length > 0 || fieldTeam.length > 0) ? `
<div class="section">
  ${sectionHeader('Project Team')}
  <div class="section-body">
    <div class="team-grid">
      <div>
        <div class="team-group-label">Management / Office</div>
        ${mgmtTeam.length > 0 ? `
        <table class="data">
          <tr><th>Name</th><th>Role</th></tr>
          ${mgmtTeam.map(a => `<tr><td>${esc(a.first_name)} ${esc(a.last_name)}</td><td>${esc(a.role || '')}</td></tr>`).join('')}
        </table>` : '<div style="color:#94a3b8;font-size:8pt">None assigned</div>'}
      </div>
      <div>
        <div class="team-group-label">Field Crew</div>
        ${fieldTeam.length > 0 ? `
        <table class="data">
          <tr><th>Name</th><th>Role</th><th>Trade</th><th>Status</th></tr>
          ${fieldTeam.map(a => `<tr>
            <td>${esc(a.first_name)} ${esc(a.last_name)}</td>
            <td>${esc(a.role || '')}</td>
            <td>${esc(a.trade || a.employee_trade || '')}</td>
            <td>${esc(a.status || '')}</td>
          </tr>`).join('')}
        </table>` : '<div style="color:#94a3b8;font-size:8pt">None assigned</div>'}
      </div>
    </div>
    ${otherContacts.length > 0 ? `
    <div style="margin-top:10px">
      <div class="team-group-label">Other Contacts</div>
      <table class="data">
        <tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th></tr>
        ${otherContacts.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.role || '')}</td><td>${esc(c.phone || '')}</td><td>${esc(c.email || '')}</td></tr>`).join('')}
      </table>
    </div>` : ''}
  </div>
</div>` : ''}

<!-- Key Dates -->
${keyDates.length > 0 ? `
<div class="section">
  ${sectionHeader('Key Dates', '#1e3a5f')}
  <div class="section-body">
    <table class="data">
      <tr><th>Milestone</th><th>Date</th></tr>
      ${keyDates.map(d => `<tr><td>${esc(d.label)}</td><td>${fmtDate(d.date) || esc(d.date || '')}</td></tr>`).join('')}
    </table>
  </div>
</div>` : ''}

<!-- Bid Scope & Special Conditions -->
${(pi.bid_scope_notes || pi.special_conditions) ? `
<div class="section">
  ${sectionHeader('Bid Scope & Conditions', '#1e3a5f')}
  <div class="section-body">
    ${pi.bid_scope_notes ? `<div class="field-label">Bid / Scope Notes</div><div class="notes-text" style="margin-bottom:8px">${esc(pi.bid_scope_notes)}</div>` : ''}
    ${pi.special_conditions ? `<div class="field-label">Special Conditions / Risks</div><div class="notes-text">${esc(pi.special_conditions)}</div>` : ''}
  </div>
</div>` : ''}

<!-- Orientation & Site Access -->
${(orientation.badge_required != null || orientation.orientation_required != null || orientation.contact_name || orientation.directions) ? `
<div class="section">
  ${sectionHeader('Orientation & Site Access', '#1e3a5f')}
  <div class="section-body">
    <div class="check-row">
      ${orientation.badge_required != null ? `<span class="check-item"><span class="check-box">${orientation.badge_required ? '✓' : ''}</span> Badge Required</span>` : ''}
      ${orientation.orientation_required != null ? `<span class="check-item"><span class="check-box">${orientation.orientation_required ? '✓' : ''}</span> Orientation Required</span>` : ''}
      ${orientation.safety_training_required != null ? `<span class="check-item"><span class="check-box">${orientation.safety_training_required ? '✓' : ''}</span> Safety Training Required</span>` : ''}
    </div>
    ${(orientation.contact_name || orientation.orientation_link) ? `
    <div class="two-col" style="margin-top:6px">
      <div>
        ${orientation.contact_name ? `<div class="field-label">Orientation Contact</div><div class="field-value">${esc(orientation.contact_name)}</div>` : ''}
        ${orientation.contact_phone ? `<div class="field-value">${esc(orientation.contact_phone)}</div>` : ''}
        ${orientation.contact_email ? `<div class="field-value">${esc(orientation.contact_email)}</div>` : ''}
      </div>
      <div>${orientation.orientation_link ? `<div class="field-label">Orientation Link</div><div class="field-value">${esc(orientation.orientation_link)}</div>` : ''}</div>
    </div>` : ''}
    ${orientation.directions ? `<div style="margin-top:8px"><div class="field-label">Directions / Site Access</div><div class="notes-text">${esc(orientation.directions)}</div></div>` : ''}
    ${orientation.parking_notes ? `<div style="margin-top:6px"><div class="field-label">Parking Notes</div><div class="notes-text">${esc(orientation.parking_notes)}</div></div>` : ''}
    ${siteMapBase64 ? `<div style="margin-top:10px"><div class="field-label">Site Map</div><img src="data:${siteMapMimeType};base64,${siteMapBase64}" style="max-width:100%;max-height:480px;border:1px solid #e5e7eb;border-radius:4px;margin-top:4px;display:block" alt="Site Map"/></div>` : (orientation.site_map_filename ? `<div style="margin-top:6px"><div class="field-label">Site Map</div><div class="field-value">${esc(orientation.site_map_filename)}</div></div>` : '')}
  </div>
</div>` : ''}

<!-- Schedule -->
${scheduleTable ? `
<div class="section">
  ${sectionHeader('Cost Type Schedule', '#1e3a5f')}
  <div class="section-body" style="padding:0;overflow:hidden;">
    ${scheduleTable}
  </div>
</div>` : ''}

<!-- Labor Forecast -->
${headcountSvg ? `
<div class="section">
  ${sectionHeader('Labor Forecast', '#002356')}
  <div class="section-body">
    ${headcountSvg}
  </div>
</div>` : ''}

<!-- Labor Plan -->
${hasSectionContent(labor.approach_notes, laborTrades) ? `
<div class="section">
  ${sectionHeader('Labor Plan', '#002356')}
  <div class="section-body">
    ${labor.approach_notes ? `<div class="notes-text" style="margin-bottom:8px">${esc(labor.approach_notes)}</div>` : ''}
    ${laborTrades.length > 0 ? `
    <table class="data">
      <tr>
        <th>Trade</th>
        <th style="text-align:right">Est Hrs</th>
        <th style="text-align:right">Goal Hrs</th>
        <th style="text-align:right">Hrs Savings</th>
        <th style="text-align:right">Est $/Hr</th>
        <th style="text-align:right">Target $/Hr</th>
        <th style="text-align:right">% Below</th>
        <th>Notes</th>
      </tr>
      ${laborTrades.map(t => `
      <tr>
        <td>${esc(t.trade)}</td>
        <td style="text-align:right">${t.est_hours != null ? Number(t.est_hours).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</td>
        <td style="text-align:right">${t.goal_hours != null ? Number(t.goal_hours).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</td>
        <td style="text-align:right">${t.hours_pct_savings != null ? Number(t.hours_pct_savings).toFixed(1) + '%' : '—'}</td>
        <td style="text-align:right">${t.est_rate != null ? '$' + Number(t.est_rate).toFixed(2) : '—'}</td>
        <td style="text-align:right">${t.target_rate != null ? '$' + Number(t.target_rate).toFixed(2) : '—'}</td>
        <td style="text-align:right">${t.rate_pct_below != null ? Number(t.rate_pct_below).toFixed(1) + '%' : '—'}</td>
        <td>${esc(t.notes || '')}</td>
      </tr>`).join('')}
    </table>` : ''}
  </div>
</div>` : ''}

<!-- Material Plan -->
${hasSectionContent(material.approach_notes, materialItems) ? `
<div class="section">
  ${sectionHeader('Material Plan', '#1e3a5f')}
  <div class="section-body">
    ${material.approach_notes ? `<div class="notes-text" style="margin-bottom:8px">${esc(material.approach_notes)}</div>` : ''}
    ${materialItems.length > 0 ? `
    <table class="data">
      <tr><th>Description</th><th>Vendor</th><th style="text-align:right">Budget</th><th>Lead Time</th><th>Notes</th></tr>
      ${materialItems.map(it => `<tr>
        <td>${esc(it.description)}</td><td>${esc(it.vendor || '')}</td>
        <td style="text-align:right">${it.budget ? fmt$(it.budget) : '—'}</td>
        <td>${esc(it.lead_time || '')}</td><td>${esc(it.notes || '')}</td>
      </tr>`).join('')}
    </table>` : ''}
  </div>
</div>` : ''}

<!-- Subcontracts -->
${hasSectionContent(subs.approach_notes, subItems) ? `
<div class="section">
  ${sectionHeader('Subcontracts', '#1e3a5f')}
  <div class="section-body">
    ${subs.approach_notes ? `<div class="notes-text" style="margin-bottom:8px">${esc(subs.approach_notes)}</div>` : ''}
    ${subItems.length > 0 ? `
    <table class="data">
      <tr><th>Description</th><th>Subcontractor</th><th style="text-align:right">Budget</th><th>Scope</th><th>Notes</th></tr>
      ${subItems.map(it => `<tr>
        <td>${esc(it.description)}</td><td>${esc(it.subcontractor || '')}</td>
        <td style="text-align:right">${it.budget ? fmt$(it.budget) : '—'}</td>
        <td>${esc(it.scope || '')}</td><td>${esc(it.notes || '')}</td>
      </tr>`).join('')}
    </table>` : ''}
  </div>
</div>` : ''}

<!-- Other Costs -->
${(hasSectionContent(rental.approach_notes, rentalItems) || hasSectionContent(mep.approach_notes, mepItems) || hasSectionContent(gc.approach_notes, gcItems)) ? `
<div class="section">
  ${sectionHeader('Other Costs', '#1e3a5f')}
  <div class="section-body">
    ${hasSectionContent(rental.approach_notes, rentalItems) ? `
    <div class="team-group-label" style="margin-bottom:4px">Rentals</div>
    ${rental.approach_notes ? `<div class="notes-text">${esc(rental.approach_notes)}</div>` : ''}
    ${rentalItems.length > 0 ? `<table class="data" style="margin-bottom:10px"><tr><th>Description</th><th style="text-align:right">Budget</th><th>Notes</th></tr>${genericRows(rentalItems)}</table>` : ''}` : ''}
    ${hasSectionContent(mep.approach_notes, mepItems) ? `
    <div class="team-group-label" style="margin-bottom:4px">MEP Equipment</div>
    ${mep.approach_notes ? `<div class="notes-text">${esc(mep.approach_notes)}</div>` : ''}
    ${mepItems.length > 0 ? `<table class="data" style="margin-bottom:10px"><tr><th>Description</th><th style="text-align:right">Budget</th><th>Notes</th></tr>${genericRows(mepItems)}</table>` : ''}` : ''}
    ${hasSectionContent(gc.approach_notes, gcItems) ? `
    <div class="team-group-label" style="margin-bottom:4px">General Conditions</div>
    ${gc.approach_notes ? `<div class="notes-text">${esc(gc.approach_notes)}</div>` : ''}
    ${gcItems.length > 0 ? `<table class="data"><tr><th>Description</th><th style="text-align:right">Budget</th><th>Notes</th></tr>${genericRows(gcItems)}</table>` : ''}` : ''}
  </div>
</div>` : ''}

</body>
</html>`;
}

module.exports = { generatePreJobChecklistPdfHtml };
