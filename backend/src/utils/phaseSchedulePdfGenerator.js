/**
 * Phase Schedule PDF Generator
 * Generates HTML for Puppeteer-based PDF export of Grid and Gantt views.
 */

const { getContourMultipliers } = require('./phaseScheduleContours');

// ─── Constants ───────────────────────────────────────────────────────
const COST_TYPE_NAMES = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions'
};
const COST_TYPE_COLORS = {
  1: '#3b82f6', 2: '#10b981', 3: '#f59e0b', 4: '#8b5cf6', 5: '#ef4444', 6: '#6b7280'
};
const COL_GROUP = {
  est:   { hdr: '#dbeafe', cell: '#eff6ff' },
  jtd:   { hdr: '#fef3c7', cell: '#fffbeb' },
  proj:  { hdr: '#dcfce7', cell: '#f0fdf4' },
  sched: { hdr: '#e2e8f0', cell: '#f8fafc' },
};

// ─── Formatting Helpers ──────────────────────────────────────────────
const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const fmtCurrency = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
};

const fmtCompact = (v) => {
  if (!v || isNaN(v)) return '-';
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtHrs = (v) => {
  if (v === null || v === undefined || isNaN(v) || v === 0) return '-';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(0);
};

const fmtPi = (qty, hrs) => {
  if (!qty || !hrs || hrs === 0) return '-';
  return (qty / hrs).toFixed(2);
};

const fmtPct = (v) => {
  if (!v || isNaN(v) || v === 0) return '-';
  return `${Math.round(v)}%`;
};

const fmtDateShort = (d) => {
  if (!d) return '-';
  try {
    const date = new Date(d);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  } catch { return '-'; }
};

const fmtMonthLabel = (date) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
};

const getDuration = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e - s) / 86400000) + 1;
};

// ─── Month Generation ────────────────────────────────────────────────
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function generateMonths(items) {
  let earliest = null;
  let latest = null;
  items.forEach(item => {
    if (item.start_date) {
      const s = new Date(item.start_date);
      if (!earliest || s < earliest) earliest = s;
    }
    if (item.end_date) {
      const e = new Date(item.end_date);
      if (!latest || e > latest) latest = e;
    }
  });
  if (!earliest || !latest) return [];

  earliest = addMonths(earliest, -1);
  latest = addMonths(latest, 1);

  const months = [];
  let current = startOfMonth(earliest);
  const last = startOfMonth(latest);
  while (current <= last) {
    months.push(new Date(current));
    current = addMonths(current, 1);
  }
  return months;
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Monthly Distribution ────────────────────────────────────────────
function computeMonthlyValues(item, months, mode) {
  const values = {};
  if (!item.start_date || !item.end_date) return values;

  const useManual = mode === 'cost' ? item.use_manual_values : item.use_manual_qty_values;
  const manualValues = mode === 'cost' ? item.manual_monthly_values : item.manual_monthly_qty;

  if (useManual && manualValues) {
    return typeof manualValues === 'string' ? JSON.parse(manualValues) : manualValues;
  }

  const total = mode === 'cost'
    ? parseNum(item.total_est_cost) - parseNum(item.total_jtd_cost)
    : (parseNum(item.quantity) - parseNum(item.quantity_installed));

  if (total <= 0) return values;

  const itemStart = startOfMonth(new Date(item.start_date));
  const itemEnd = startOfMonth(new Date(item.end_date));

  const itemMonths = months.filter(m => m >= itemStart && m <= itemEnd);
  if (itemMonths.length === 0) return values;

  const multipliers = getContourMultipliers(itemMonths.length, item.contour_type || 'flat');
  const perMonth = total / itemMonths.length;

  itemMonths.forEach((m, i) => {
    values[formatMonthKey(m)] = perMonth * multipliers[i];
  });

  return values;
}

// ─── Cost Type Grouping ──────────────────────────────────────────────
function buildCostTypeGroups(items) {
  const groupMap = new Map();
  items.forEach(item => {
    const ct = (item.cost_types && item.cost_types[0]) || 1;
    if (!groupMap.has(ct)) groupMap.set(ct, []);
    groupMap.get(ct).push(item);
  });

  const groups = [];
  for (let ct = 1; ct <= 6; ct++) {
    const ctItems = groupMap.get(ct);
    if (!ctItems || ctItems.length === 0) continue;

    const estQty = ctItems.reduce((s, i) => s + parseNum(i.quantity), 0);
    const estHrs = ctItems.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
    const estCost = ctItems.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
    const jtdQty = ctItems.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
    const jtdHrs = ctItems.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
    const jtdCost = ctItems.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);
    const pctComp = estCost > 0 ? (jtdCost / estCost * 100) : 0;
    const projQty = estQty;
    const projHrs = ctItems.reduce((s, i) => {
      const eQ = parseNum(i.quantity);
      const jQ = parseNum(i.quantity_installed);
      const jH = parseNum(i.total_jtd_hours);
      const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
      return s + (pi > 0 ? eQ / pi : parseNum(i.total_est_hours));
    }, 0);
    const projCost = ctItems.reduce((s, i) => {
      const pct = parseNum(i.percent_complete);
      const jC = parseNum(i.total_jtd_cost);
      return s + (pct > 0 ? jC / (pct / 100) : parseNum(i.total_est_cost));
    }, 0);

    let earliestStart = null;
    let latestEnd = null;
    ctItems.forEach(item => {
      if (item.start_date && (!earliestStart || item.start_date < earliestStart)) earliestStart = item.start_date;
      if (item.end_date && (!latestEnd || item.end_date > latestEnd)) latestEnd = item.end_date;
    });

    groups.push({
      costType: ct, name: COST_TYPE_NAMES[ct], color: COST_TYPE_COLORS[ct],
      items: ctItems, estQty, estHrs, estCost, jtdQty, jtdHrs, jtdCost, pctComp,
      projQty, projHrs, projCost, earliestStart, latestEnd,
      duration: getDuration(earliestStart, latestEnd)
    });
  }
  return groups;
}

// ─── Project Header HTML ─────────────────────────────────────────────
function buildProjectHeader(project, viewLabel, itemCount, totalEst, totalJtd, logoBase64) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `
    <div class="header">
      <div class="header-left">
        <h1>Phase Schedule &mdash; ${viewLabel} View</h1>
        <div class="header-project">${project.number ? '#' + escHtml(project.number) + ' &mdash; ' : ''}${escHtml(project.name || '')}</div>
        <div class="header-meta">${dateStr} at ${timeStr} &nbsp;&bull;&nbsp; ${itemCount} items &nbsp;&bull;&nbsp; Est: ${fmtCompact(totalEst)} &nbsp; JTD: ${fmtCompact(totalJtd)}</div>
      </div>
      <div class="header-right">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo" />` : ''}
      </div>
    </div>`;
}

function buildFooter(project, viewLabel) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `
    <div class="footer">
      <span>${project.number ? '#' + escHtml(project.number) + ' - ' : ''}${escHtml(project.name || '')} &nbsp;|&nbsp; Phase Schedule (${viewLabel})</span>
      <span>Generated ${dateStr} at ${timeStr}</span>
    </div>`;
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════════════
// GRID VIEW HTML
// ═══════════════════════════════════════════════════════════════════════
function buildGridHtml(items, months, mode, project, logoBase64) {
  const groups = buildCostTypeGroups(items);
  const totalEst = items.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
  const totalJtd = items.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);

  // Compute all monthly values
  const allMonthly = new Map();
  items.forEach(item => {
    allMonthly.set(item.id, computeMonthlyValues(item, months, mode));
  });

  // Max monthly value for heatmap
  let maxVal = 0;
  allMonthly.forEach(vals => {
    Object.values(vals).forEach(v => { if (v > maxVal) maxVal = v; });
  });

  // Dynamic monthly column sizing
  const mc = months.length;
  let mColW, mFont;
  if (mc <= 12) { mColW = 38; mFont = '6pt'; }
  else if (mc <= 18) { mColW = 34; mFont = '5.5pt'; }
  else { mColW = 30; mFont = '5pt'; }

  // Fixed column widths (px) — compact for PDF
  const cw = {
    rowNum: 22, phase: 150, ct: 22,
    estQty: 44, uom: 30, estHrs: 44, estCost: 54, estPi: 36,
    pctComp: 38, jtdQty: 44, jtdHrs: 44, jtdCost: 54, jtdPi: 36,
    projQty: 44, projHrs: 44, projCost: 54, projPi: 36,
    start: 52, end: 52, dur: 30, contour: 42
  };

  const fixedW = Object.values(cw).reduce((a, b) => a + b, 0);
  const totalW = fixedW + mc * mColW;

  const viewLabel = `Grid (${mode === 'cost' ? 'Cost' : 'Qty'})`;
  const header = buildProjectHeader(project, viewLabel, items.length, totalEst, totalJtd, logoBase64);
  const footer = buildFooter(project, viewLabel);

  // Styles
  const thS = `padding: 2px 3px; text-align: center; font-size: 6pt; font-weight: 600; white-space: nowrap; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; color: #1e293b; overflow: hidden;`;
  const tdS = `padding: 2px 3px; text-align: center; font-size: 6.5pt; white-space: nowrap; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; overflow: hidden;`;

  // Group header row helper
  function groupHdrTh(label, color, bgColor, colspan) {
    return `<th colspan="${colspan}" style="${thS} background: ${bgColor}; color: ${color}; font-size: 5.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-left: 2px solid #94a3b8; border-right: 2px solid #94a3b8;">${label}</th>`;
  }

  // Build table rows
  let rows = '';

  groups.forEach(group => {
    // Group summary row
    const gMonthly = {};
    months.forEach(m => {
      const key = formatMonthKey(m);
      gMonthly[key] = group.items.reduce((s, item) => s + ((allMonthly.get(item.id) || {})[key] || 0), 0);
    });

    rows += `<tr style="background: ${group.color}10; page-break-inside: avoid;">`;
    rows += `<td style="${tdS} font-weight: 700; font-size: 6.5pt; text-align: left; padding-left: 6px; border-left: 3px solid ${group.color};" colspan="3">`;
    rows += `<span style="color: ${group.color};">${escHtml(group.name)}</span> <span style="color: #64748b; font-size: 5.5pt;">(${group.items.length})</span></td>`;
    // Estimated group
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; border-left: 2px solid #94a3b8;">${group.estQty ? Math.round(group.estQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};"></td>`; // UOM
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};">${fmtHrs(group.estHrs)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 600;">${fmtCompact(group.estCost)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; border-right: 2px solid #94a3b8;">${fmtPi(group.estQty, group.estHrs)}</td>`;
    // JTD group
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtPct(group.pctComp)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${group.jtdQty ? Math.round(group.jtdQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtHrs(group.jtdHrs)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtCompact(group.jtdCost)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; border-right: 2px solid #94a3b8;">${fmtPi(group.jtdQty, group.jtdHrs)}</td>`;
    // Projected group
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell};">${group.projQty ? Math.round(group.projQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell};">${fmtHrs(group.projHrs)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 600;">${fmtCompact(group.projCost)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; border-right: 2px solid #94a3b8;">${fmtPi(group.projQty, group.projHrs)}</td>`;
    // Schedule group
    rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${fmtDateShort(group.earliestStart)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${fmtDateShort(group.latestEnd)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${group.duration || '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; border-right: 2px solid #94a3b8;"></td>`; // Contour
    // Monthly columns
    months.forEach(m => {
      const key = formatMonthKey(m);
      const val = gMonthly[key] || 0;
      rows += `<td style="${tdS} font-size: ${mFont}; font-weight: 600; color: ${val > 0 ? '#1e293b' : '#cbd5e1'}; background: ${val > 0 ? group.color + '15' : 'transparent'};">${val > 0 ? (mode === 'cost' ? fmtCompact(val) : val.toFixed(0)) : ''}</td>`;
    });
    rows += '</tr>';

    // Item rows
    group.items.forEach(item => {
      const estQty = parseNum(item.quantity);
      const estHrs = parseNum(item.total_est_hours);
      const estCost = parseNum(item.total_est_cost);
      const jtdQty = parseNum(item.quantity_installed);
      const jtdHrs = parseNum(item.total_jtd_hours);
      const jtdCost = parseNum(item.total_jtd_cost);
      const pctComp = parseNum(item.percent_complete);
      const jtdPiVal = jtdQty > 0 && jtdHrs > 0 ? jtdQty / jtdHrs : 0;
      const projQty = estQty;
      const projHrs = jtdPiVal > 0 ? estQty / jtdPiVal : estHrs;
      const projCost = pctComp > 0 ? jtdCost / (pctComp / 100) : estCost;
      const dur = getDuration(item.start_date, item.end_date);
      const monthlyVals = allMonthly.get(item.id) || {};

      // Color-coding for projected vs estimated
      const projHrsColor = projHrs > estHrs ? '#ef4444' : projHrs < estHrs ? '#10b981' : '#1e293b';
      const projCostColor = projCost > estCost ? '#ef4444' : projCost < estCost ? '#10b981' : '#1e293b';
      const ePi = estHrs > 0 ? estQty / estHrs : 0;
      const pPi = projHrs > 0 ? projQty / projHrs : 0;
      const projPiColor = pPi < ePi ? '#ef4444' : pPi > ePi ? '#10b981' : '#64748b';

      rows += '<tr>';
      rows += `<td style="${tdS} font-size: 5.5pt; color: #94a3b8;">${item.row_number || ''}</td>`;
      rows += `<td style="${tdS} text-align: left; max-width: ${cw.phase}px; overflow: hidden; text-overflow: ellipsis;">`;
      // Cost type color dots
      if (item.cost_types) {
        item.cost_types.forEach(ct => {
          rows += `<span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${COST_TYPE_COLORS[ct] || '#999'}; margin-right: 2px; vertical-align: middle;"></span>`;
        });
      }
      if (item.phase_code_display) {
        rows += `<span style="color: #64748b;">${escHtml(item.phase_code_display)} - </span>`;
      }
      rows += `<span>${escHtml(item.name)}</span></td>`;
      rows += `<td style="${tdS} font-size: 5.5pt; color: #64748b;">${item.cost_types ? item.cost_types.map(ct => (COST_TYPE_NAMES[ct] || '').charAt(0)).join('') : ''}</td>`;

      // Estimated
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; border-left: 2px solid #94a3b8;">${estQty ? Math.round(estQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-size: 5.5pt;">${item.quantity_uom || '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};">${fmtHrs(estHrs)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 500;">${fmtCompact(estCost)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; color: #64748b; border-right: 2px solid #94a3b8;">${fmtPi(estQty, estHrs)}</td>`;

      // JTD
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtPct(pctComp)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${jtdQty ? Math.round(jtdQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtHrs(jtdHrs)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtCompact(jtdCost)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; color: #64748b; border-right: 2px solid #94a3b8;">${fmtPi(jtdQty, jtdHrs)}</td>`;

      // Projected
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell};">${projQty ? Math.round(projQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; color: ${projHrsColor};">${fmtHrs(projHrs)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 500; color: ${projCostColor};">${fmtCompact(projCost)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; color: ${projPiColor}; border-right: 2px solid #94a3b8;">${fmtPi(projQty, projHrs)}</td>`;

      // Schedule
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${fmtDateShort(item.start_date)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${fmtDateShort(item.end_date)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${dur || '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; font-size: 5.5pt; border-right: 2px solid #94a3b8;">${item.contour_type || 'flat'}</td>`;

      // Monthly
      months.forEach(m => {
        const key = formatMonthKey(m);
        const val = monthlyVals[key] || 0;
        const intensity = maxVal > 0 ? val / maxVal : 0;
        const bgColor = val > 0 ? `rgba(59, 130, 246, ${(0.05 + intensity * 0.25).toFixed(2)})` : 'transparent';
        rows += `<td style="${tdS} font-size: ${mFont}; background: ${bgColor}; color: ${val > 0 ? '#1e293b' : '#cbd5e1'};">${val > 0 ? (mode === 'cost' ? fmtCompact(val) : val.toFixed(0)) : ''}</td>`;
      });

      rows += '</tr>';
    });
  });

  // Grand totals row
  const grandEstQty = items.reduce((s, i) => s + parseNum(i.quantity), 0);
  const grandEstHrs = items.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
  const grandJtdQty = items.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
  const grandJtdHrs = items.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
  const grandPctComp = totalEst > 0 ? (totalJtd / totalEst * 100) : 0;
  const grandProjQty = grandEstQty;
  const grandProjHrs = groups.reduce((s, g) => s + g.projHrs, 0);
  const grandProjCost = groups.reduce((s, g) => s + g.projCost, 0);

  rows += `<tr style="font-weight: 700; background: #f1f5f9;">`;
  rows += `<td style="${tdS} font-weight: 700;" colspan="3">TOTAL</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 700; border-left: 2px solid #94a3b8;">${grandEstQty ? Math.round(grandEstQty).toLocaleString() : '-'}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};"></td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 700;">${fmtHrs(grandEstHrs)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 700;">${fmtCompact(totalEst)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; border-right: 2px solid #94a3b8;">${fmtPi(grandEstQty, grandEstHrs)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${fmtPct(grandPctComp)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${grandJtdQty ? Math.round(grandJtdQty).toLocaleString() : '-'}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${fmtHrs(grandJtdHrs)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${fmtCompact(totalJtd)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; border-right: 2px solid #94a3b8;">${fmtPi(grandJtdQty, grandJtdHrs)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 700;">${grandProjQty ? Math.round(grandProjQty).toLocaleString() : '-'}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 700;">${fmtHrs(grandProjHrs)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 700;">${fmtCompact(grandProjCost)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; border-right: 2px solid #94a3b8;">${fmtPi(grandProjQty, grandProjHrs)}</td>`;
  rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};" colspan="4"></td>`;
  // Monthly totals
  months.forEach(m => {
    const key = formatMonthKey(m);
    let colTotal = 0;
    items.forEach(item => { colTotal += (allMonthly.get(item.id) || {})[key] || 0; });
    rows += `<td style="${tdS} font-size: ${mFont}; font-weight: 700; color: ${colTotal > 0 ? '#1e293b' : '#cbd5e1'};">${colTotal > 0 ? (mode === 'cost' ? fmtCompact(colTotal) : colTotal.toFixed(0)) : ''}</td>`;
  });
  rows += '</tr>';

  return `
    ${header}
    <table style="border-collapse: collapse; table-layout: fixed; width: ${totalW}px; font-family: system-ui, -apple-system, sans-serif;">
      <colgroup>
        <col style="width: ${cw.rowNum}px" />
        <col style="width: ${cw.phase}px" />
        <col style="width: ${cw.ct}px" />
        <col style="width: ${cw.estQty}px" /><col style="width: ${cw.uom}px" /><col style="width: ${cw.estHrs}px" /><col style="width: ${cw.estCost}px" /><col style="width: ${cw.estPi}px" />
        <col style="width: ${cw.pctComp}px" /><col style="width: ${cw.jtdQty}px" /><col style="width: ${cw.jtdHrs}px" /><col style="width: ${cw.jtdCost}px" /><col style="width: ${cw.jtdPi}px" />
        <col style="width: ${cw.projQty}px" /><col style="width: ${cw.projHrs}px" /><col style="width: ${cw.projCost}px" /><col style="width: ${cw.projPi}px" />
        <col style="width: ${cw.start}px" /><col style="width: ${cw.end}px" /><col style="width: ${cw.dur}px" /><col style="width: ${cw.contour}px" />
        ${months.map(() => `<col style="width: ${mColW}px" />`).join('')}
      </colgroup>
      <thead style="display: table-header-group;">
        <tr style="background: #eef2f7;">
          <th colspan="3" style="${thS} background: #eef2f7;"></th>
          ${groupHdrTh('Estimated', '#3b82f6', COL_GROUP.est.hdr, 5)}
          ${groupHdrTh('JTD', '#f59e0b', COL_GROUP.jtd.hdr, 5)}
          ${groupHdrTh('Projected', '#10b981', COL_GROUP.proj.hdr, 4)}
          ${groupHdrTh('Schedule', '#64748b', COL_GROUP.sched.hdr, 4)}
          ${mc > 0 ? `<th colspan="${mc}" style="${thS} background: #eef2f7; color: #8b5cf6; font-size: 5.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Monthly Distribution</th>` : ''}
        </tr>
        <tr style="background: #eef2f7;">
          <th style="${thS} background: #eef2f7;">ID</th>
          <th style="${thS} background: #eef2f7; text-align: left; padding-left: 6px;">Phase</th>
          <th style="${thS} background: #eef2f7;">CT</th>
          <th style="${thS} background: ${COL_GROUP.est.hdr}; border-left: 2px solid #94a3b8;">Qty</th>
          <th style="${thS} background: ${COL_GROUP.est.hdr};">UOM</th>
          <th style="${thS} background: ${COL_GROUP.est.hdr};">Hrs</th>
          <th style="${thS} background: ${COL_GROUP.est.hdr};">Cost</th>
          <th style="${thS} background: ${COL_GROUP.est.hdr}; border-right: 2px solid #94a3b8;">PI</th>
          <th style="${thS} background: ${COL_GROUP.jtd.hdr};">%Comp</th>
          <th style="${thS} background: ${COL_GROUP.jtd.hdr};">Qty</th>
          <th style="${thS} background: ${COL_GROUP.jtd.hdr};">Hrs</th>
          <th style="${thS} background: ${COL_GROUP.jtd.hdr};">Cost</th>
          <th style="${thS} background: ${COL_GROUP.jtd.hdr}; border-right: 2px solid #94a3b8;">PI</th>
          <th style="${thS} background: ${COL_GROUP.proj.hdr};">Qty</th>
          <th style="${thS} background: ${COL_GROUP.proj.hdr};">Hrs</th>
          <th style="${thS} background: ${COL_GROUP.proj.hdr};">Cost</th>
          <th style="${thS} background: ${COL_GROUP.proj.hdr}; border-right: 2px solid #94a3b8;">PI</th>
          <th style="${thS} background: ${COL_GROUP.sched.hdr};">Start</th>
          <th style="${thS} background: ${COL_GROUP.sched.hdr};">End</th>
          <th style="${thS} background: ${COL_GROUP.sched.hdr};">Days</th>
          <th style="${thS} background: ${COL_GROUP.sched.hdr}; border-right: 2px solid #94a3b8;">Contour</th>
          ${months.map(m => `<th style="${thS} background: #eef2f7; font-size: ${mFont};">${fmtMonthLabel(m)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    ${footer}`;
}

// ═══════════════════════════════════════════════════════════════════════
// GANTT VIEW HTML
// ═══════════════════════════════════════════════════════════════════════
function buildGanttHtml(items, months, project, logoBase64) {
  const groups = buildCostTypeGroups(items);
  const totalEst = items.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
  const totalJtd = items.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);

  const mc = months.length;
  let colWidth;
  if (mc <= 12) colWidth = 80;
  else if (mc <= 15) colWidth = 65;
  else if (mc <= 20) colWidth = 55;
  else colWidth = 45;

  const firstMonth = months.length > 0 ? months[0] : null;
  const timelineW = mc * colWidth;
  const rowH = 22;

  // Left panel column widths
  const lc = { rowNum: 24, phase: 160, ct: 22, estCost: 58, start: 52, end: 52, dur: 30, contour: 44 };
  const leftW = Object.values(lc).reduce((a, b) => a + b, 0);
  const totalW = leftW + timelineW;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Day-level pixel position for a date
  function dateToX(date) {
    if (!firstMonth) return 0;
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthIndex = (monthStart.getFullYear() - firstMonth.getFullYear()) * 12 + (monthStart.getMonth() - firstMonth.getMonth());
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const dayFraction = (date.getDate() - 1) / daysInMonth;
    return monthIndex * colWidth + dayFraction * colWidth;
  }

  const header = buildProjectHeader(project, 'Gantt', items.length, totalEst, totalJtd, logoBase64);
  const footer = buildFooter(project, 'Gantt');

  // Today marker offset
  const todayX = firstMonth ? dateToX(today) + leftW : 0;

  const thS = `padding: 2px 3px; text-align: center; font-size: 6pt; font-weight: 600; white-space: nowrap; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; color: #1e293b; background: #eef2f7; overflow: hidden;`;

  // Build rows
  let rowsHtml = '';

  groups.forEach(group => {
    // Group header row
    const gStart = group.earliestStart ? new Date(group.earliestStart) : null;
    const gEnd = group.latestEnd ? new Date(group.latestEnd) : null;
    let gBarHtml = '';
    if (gStart && gEnd && firstMonth && gStart >= firstMonth) {
      const gBarLeft = dateToX(gStart) + 2;
      const gEndDIM = new Date(gEnd.getFullYear(), gEnd.getMonth() + 1, 0).getDate();
      const gBarRight = dateToX(gEnd) + colWidth / gEndDIM;
      const gBarWidth = gBarRight - gBarLeft;
      if (gBarWidth > 0) {
        gBarHtml = `<div style="position: absolute; left: ${gBarLeft}px; top: 3px; height: ${rowH - 6}px; width: ${gBarWidth}px; background: ${group.color}20; border: 1px dashed ${group.color}; border-radius: 3px;"></div>`;
      }
    }

    rowsHtml += `<tr style="background: ${group.color}10;">`;
    rowsHtml += `<td style="padding: 2px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1;"></td>`;
    rowsHtml += `<td style="padding: 2px 4px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; font-size: 6.5pt; font-weight: 700; color: ${group.color}; white-space: nowrap; overflow: hidden;">`;
    rowsHtml += `<span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background: ${group.color}; margin-right: 3px; vertical-align: middle;"></span>`;
    rowsHtml += `${escHtml(group.name)} <span style="font-size: 5.5pt; color: #64748b; font-weight: 400;">(${group.items.length})</span></td>`;
    rowsHtml += `<td style="border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1;"></td>`;
    rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; font-size: 6pt; text-align: center; color: #64748b;">${fmtCompact(group.estCost)}</td>`;
    rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center; color: #64748b;">${fmtDateShort(group.earliestStart)}</td>`;
    rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center; color: #64748b;">${fmtDateShort(group.latestEnd)}</td>`;
    rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1; font-size: 6pt; text-align: center; color: #64748b;">${group.duration || ''}</td>`;
    rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #94a3b8; border-right: 1px solid #cbd5e1;"></td>`;
    // Timeline cell for group
    rowsHtml += `<td colspan="${mc}" style="position: relative; height: ${rowH}px; border-bottom: 1px solid #94a3b8; padding: 0;">`;
    rowsHtml += gBarHtml;
    rowsHtml += '</td></tr>';

    // Item rows
    group.items.forEach(item => {
      const startDate = item.start_date ? new Date(item.start_date) : null;
      const endDate = item.end_date ? new Date(item.end_date) : null;
      const dur = getDuration(item.start_date, item.end_date);
      const barColor = COST_TYPE_COLORS[(item.cost_types && item.cost_types[0]) || 1];

      let barHtml = '';
      if (startDate && endDate && firstMonth && startDate >= firstMonth) {
        const barLeft = dateToX(startDate) + 2;
        const endDIM = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
        const barRight = dateToX(endDate) + colWidth / endDIM;
        const barWidth = barRight - barLeft;
        if (barWidth > 0) {
          barHtml = `<div style="position: absolute; left: ${barLeft}px; top: 3px; height: ${rowH - 6}px; width: ${barWidth}px; background: ${barColor}30; border: 2px solid ${barColor}; border-radius: 4px; overflow: hidden;">`;
          barHtml += `<span style="font-size: 5.5pt; color: #1e293b; white-space: nowrap; padding-left: 4px; line-height: ${rowH - 6}px;">${escHtml(item.name)}</span>`;
          barHtml += '</div>';
        }
      }

      rowsHtml += '<tr>';
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center; color: #94a3b8;">${item.row_number || ''}</td>`;
      rowsHtml += `<td style="padding: 2px 4px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 6.5pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: ${lc.phase}px;">`;
      if (item.cost_types) {
        item.cost_types.forEach(ct => {
          rowsHtml += `<span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${COST_TYPE_COLORS[ct] || '#999'}; margin-right: 2px; vertical-align: middle;"></span>`;
        });
      }
      if (item.phase_code_display) {
        rowsHtml += `<span style="color: #64748b;">${escHtml(item.phase_code_display)} - </span>`;
      }
      rowsHtml += `${escHtml(item.name)}</td>`;
      rowsHtml += `<td style="padding: 2px 2px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center; color: #64748b;">${item.cost_types ? item.cost_types.map(ct => (COST_TYPE_NAMES[ct] || '').charAt(0)).join('') : ''}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 6pt; text-align: center;">${fmtCompact(parseNum(item.total_est_cost))}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center;">${fmtDateShort(item.start_date)}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center;">${fmtDateShort(item.end_date)}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 6pt; text-align: center;">${dur || '-'}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center;">${item.contour_type || 'flat'}</td>`;
      // Timeline cell
      rowsHtml += `<td colspan="${mc}" style="position: relative; height: ${rowH}px; border-bottom: 1px solid #cbd5e1; padding: 0;">`;
      rowsHtml += barHtml;
      rowsHtml += '</td></tr>';
    });
  });

  // Month grid lines via background pattern in timeline cells are done via borders on sub-divs
  // We'll add faint column lines via a CSS trick on the timeline <td>
  const monthLinesCss = months.map((m, i) => {
    return `background-position: ${i * colWidth}px 0`;
  }).join(', ');

  return `
    ${header}
    <table style="border-collapse: collapse; table-layout: fixed; width: ${totalW}px; font-family: system-ui, -apple-system, sans-serif;">
      <colgroup>
        <col style="width: ${lc.rowNum}px" />
        <col style="width: ${lc.phase}px" />
        <col style="width: ${lc.ct}px" />
        <col style="width: ${lc.estCost}px" />
        <col style="width: ${lc.start}px" />
        <col style="width: ${lc.end}px" />
        <col style="width: ${lc.dur}px" />
        <col style="width: ${lc.contour}px" />
        ${months.map(() => `<col style="width: ${colWidth}px" />`).join('')}
      </colgroup>
      <thead style="display: table-header-group;">
        <tr>
          <th style="${thS}">ID</th>
          <th style="${thS} text-align: left; padding-left: 6px;">Phase</th>
          <th style="${thS}">CT</th>
          <th style="${thS}">Est $</th>
          <th style="${thS}">Start</th>
          <th style="${thS}">End</th>
          <th style="${thS}">Dur</th>
          <th style="${thS}">Contour</th>
          ${months.map(m => `<th style="${thS} font-size: 5.5pt;">${fmtMonthLabel(m)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    ${todayX > leftW ? `<div style="position: absolute; left: ${todayX}px; top: 0; bottom: 0; width: 2px; background: #ef4444; opacity: 0.6; z-index: 10;"><div style="position: absolute; top: -1px; left: -12px; font-size: 5pt; color: #ef4444; font-weight: 600;">Today</div></div>` : ''}
    ${footer}`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════
function generatePhaseSchedulePdfHtml(data) {
  const { items, project, view, mode, logoBase64 } = data;
  const months = generateMonths(items);

  const content = view === 'gantt'
    ? buildGanttHtml(items, months, project, logoBase64)
    : buildGridHtml(items, months, mode || 'cost', project, logoBase64);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      font-size: 6.5pt;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: letter landscape;
      margin: 0;
    }
    table { border-collapse: collapse; }
    td, th { vertical-align: middle; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0 0 8px 0;
      margin-bottom: 6px;
      border-bottom: 2px solid #3b82f6;
    }
    .header-left { flex: 1; }
    .header-left h1 {
      font-size: 14pt;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 2px 0;
    }
    .header-project {
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      margin-bottom: 2px;
    }
    .header-meta {
      font-size: 7pt;
      color: #94a3b8;
    }
    .header-right {
      flex-shrink: 0;
      margin-left: 16px;
    }
    .logo {
      max-height: 48px;
      max-width: 160px;
      object-fit: contain;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0 0 0;
      margin-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 6.5pt;
      color: #94a3b8;
    }
  </style>
</head>
<body style="padding: 4px; position: relative;">
  ${content}
</body>
</html>`;
}

module.exports = { generatePhaseSchedulePdfHtml };
