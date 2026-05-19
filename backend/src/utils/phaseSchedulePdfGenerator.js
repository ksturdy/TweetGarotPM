/**
 * Phase Schedule PDF Generator
 * Supports: cost / qty / manpower / billable modes; groups filter; Remaining column group.
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
  est:   { hdr: '#dbeafe', cell: '#eff6ff', color: '#3b82f6' },
  jtd:   { hdr: '#fef3c7', cell: '#fffbeb', color: '#f59e0b' },
  proj:  { hdr: '#dcfce7', cell: '#f0fdf4', color: '#10b981' },
  rem:   { hdr: '#ede9fe', cell: '#f5f3ff', color: '#8b5cf6' },
  sched: { hdr: '#e2e8f0', cell: '#f8fafc', color: '#64748b' },
  bill:  { hdr: '#fce7f3', cell: '#fdf2f8', color: '#db2777' },
};

const SHIFT_HRS_PER_MONTH = {
  '5/8':  (5 * 8)  * 52 / 12,
  '5/10': (5 * 10) * 52 / 12,
  '6/8':  (6 * 8)  * 52 / 12,
  '6/10': (6 * 10) * 52 / 12,
};

// ─── Conditional cell shading ─────────────────────────────────────────
function costCellStyle(proj, baseline) {
  if (baseline === 0 && proj === 0) return { bg: '', fg: '#1e293b' };
  if (baseline === 0 && proj > 0) return { bg: '#FFC7CE', fg: '#9C0006' };
  if (proj === 0 && baseline > 0) return { bg: '#C6EFCE', fg: '#006100' };
  const pct = (proj - baseline) / baseline;
  if (pct > 0.01) return { bg: '#FFC7CE', fg: '#9C0006' };
  if (pct < -0.01) return { bg: '#C6EFCE', fg: '#006100' };
  return { bg: '', fg: '#1e293b' };
}

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

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
function computeMonthlyValues(item, months, mode, laborRateById, markupByCt) {
  const values = {};
  if (!item.start_date || !item.end_date) return values;

  const jtdHrs  = parseNum(item.total_jtd_hours);
  const jtdCost = parseNum(item.total_jtd_cost);
  const jtdQty  = parseNum(item.quantity_installed);
  const estQty  = parseNum(item.quantity);
  const estHrs  = parseNum(item.total_est_hours);
  const vPC     = parseNum(item.total_projected_cost);
  const jtdPi   = jtdQty > 0 && jtdHrs > 0 ? jtdQty / jtdHrs : 0;
  const projHrs = jtdPi > 0 ? estQty / jtdPi : estHrs;

  let total;
  switch (mode) {
    case 'manpower':
      total = Math.max(0, projHrs - jtdHrs);
      break;
    case 'billable': {
      const ct = (item.cost_types && item.cost_types[0]) || 1;
      if (ct === 1 && item.billable_rate_id && laborRateById) {
        const rate = laborRateById.get(item.billable_rate_id) || 0;
        total = Math.max(0, projHrs - jtdHrs) * rate;
      } else {
        const mkPct = markupByCt ? (markupByCt[ct] || 0) : 0;
        total = Math.max(0, vPC - jtdCost) * (1 + mkPct / 100);
      }
      break;
    }
    case 'qty':
      if (item.use_manual_qty_values && item.manual_monthly_qty) {
        return typeof item.manual_monthly_qty === 'string'
          ? JSON.parse(item.manual_monthly_qty) : item.manual_monthly_qty;
      }
      total = Math.max(0, estQty - jtdQty);
      break;
    case 'cost':
    default:
      if (item.use_manual_values && item.manual_monthly_values) {
        return typeof item.manual_monthly_values === 'string'
          ? JSON.parse(item.manual_monthly_values) : item.manual_monthly_values;
      }
      total = Math.max(0, vPC - jtdCost);
      break;
  }

  if (total <= 0) return values;

  const itemStart = startOfMonth(new Date(item.start_date));
  const itemEnd   = startOfMonth(new Date(item.end_date));
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

    const estQty  = ctItems.reduce((s, i) => s + parseNum(i.quantity), 0);
    const estHrs  = ctItems.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
    const estCost = ctItems.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
    const jtdQty  = ctItems.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
    const jtdHrs  = ctItems.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
    const jtdCost = ctItems.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);
    const pctComp = estCost > 0 ? (jtdCost / estCost * 100) : 0;
    const projQty = estQty;
    const projHrs = ctItems.reduce((s, i) => {
      const jQ = parseNum(i.quantity_installed);
      const jH = parseNum(i.total_jtd_hours);
      const eQ = parseNum(i.quantity);
      const eH = parseNum(i.total_est_hours);
      const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
      return s + (pi > 0 ? eQ / pi : eH);
    }, 0);
    const projCostField = ctItems.reduce((s, i) => {
      const pct = parseNum(i.percent_complete);
      const jC  = parseNum(i.total_jtd_cost);
      const eC  = parseNum(i.total_est_cost);
      return s + (pct > 0 ? Math.max(jC / (pct / 100), jC) : jC > eC ? jC : eC);
    }, 0);
    const projCostVista = ctItems.reduce((s, i) => {
      const vPC = parseNum(i.total_projected_cost);
      const jC  = parseNum(i.total_jtd_cost);
      return s + (vPC > 0 ? Math.max(vPC, jC) : 0);
    }, 0);

    let earliestStart = null, latestEnd = null;
    ctItems.forEach(item => {
      if (item.start_date && (!earliestStart || item.start_date < earliestStart)) earliestStart = item.start_date;
      if (item.end_date   && (!latestEnd   || item.end_date   > latestEnd))   latestEnd   = item.end_date;
    });

    groups.push({
      costType: ct, name: COST_TYPE_NAMES[ct], color: COST_TYPE_COLORS[ct],
      items: ctItems, estQty, estHrs, estCost, jtdQty, jtdHrs, jtdCost, pctComp,
      projQty, projHrs, projCostField, projCostVista, earliestStart, latestEnd,
      duration: getDuration(earliestStart, latestEnd)
    });
  }
  return groups;
}

// ─── Project Header / Footer HTML ────────────────────────────────────
function buildProjectHeader(project, viewLabel, itemCount, totalEst, totalJtd, _logoBase64) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  // Logo is rendered in Puppeteer's page-margin headerTemplate (appears in the
  // upper-right of every page), so the body header is title/meta only here.
  return `
    <div class="header">
      <div class="header-left">
        <h1>Phase Schedule &mdash; ${viewLabel} View</h1>
        <div class="header-project">${project.number ? '#' + escHtml(project.number) + ' &mdash; ' : ''}${escHtml(project.name || '')}</div>
        <div class="header-meta">${dateStr} at ${timeStr} &nbsp;&bull;&nbsp; ${itemCount} items &nbsp;&bull;&nbsp; Est: ${fmtCompact(totalEst)} &nbsp; JTD: ${fmtCompact(totalJtd)}</div>
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

// ═══════════════════════════════════════════════════════════════════════
// GRID VIEW HTML
// ═══════════════════════════════════════════════════════════════════════
function buildGridHtml(items, months, mode, project, logoBase64, groups, laborRateById, laborRates, markupByCt, shift) {
  // Groups visibility
  const showEst     = !groups || groups.has('est');
  const showJtd     = !groups || groups.has('jtd');
  const showProj    = !groups || groups.has('proj');
  const showRem     = !groups || groups.has('rem');
  const showSched   = !groups || groups.has('sched');
  const showBill    = !groups || groups.has('bill');
  const showMonthly = !groups || groups.has('monthly');

  // Rate label lookup: id → "Label ($XX/hr)" — matches the on-screen Billing/Rate column
  const rateLabelById = new Map(
    (laborRates || []).map(r => [r.id, `${r.label} ($${Number(r.billable_rate).toFixed(0)}/hr)`])
  );
  const rateLabel = (item) => {
    const isLabor = (item.cost_types?.[0] || 0) === 1;
    if (!isLabor) return '—';
    if (!item.billable_rate_id) return '— unrated —';
    return rateLabelById.get(item.billable_rate_id) || '— unrated —';
  };

  const shiftHrs = SHIFT_HRS_PER_MONTH[shift || '5/8'] || SHIFT_HRS_PER_MONTH['5/8'];

  // Format monthly cell value based on mode
  const fmtMonthVal = (val) => {
    if (!val || val === 0) return '';
    if (mode === 'qty')      return val.toFixed(0);
    if (mode === 'manpower') return (val / shiftHrs).toFixed(1);
    return fmtCompact(val); // cost and billable
  };

  const modeLabels = { cost: 'Cost', qty: 'Qty', manpower: `Manpower (${shift || '5/8'})`, billable: 'Billable' };
  const viewLabel = `Grid (${modeLabels[mode] || 'Cost'})`;
  const monthlyLabel = { cost: 'Monthly Cost', qty: 'Monthly Qty', manpower: 'Monthly Headcount', billable: 'Monthly Billable' }[mode] || 'Monthly Distribution';

  const ctGroups = buildCostTypeGroups(items);
  const totalEst = items.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
  const totalJtd = items.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);

  // Compute all monthly values
  const allMonthly = new Map();
  items.forEach(item => {
    allMonthly.set(item.id, computeMonthlyValues(item, months, mode, laborRateById, markupByCt));
  });

  // Max monthly value for heatmap
  let maxVal = 0;
  allMonthly.forEach(vals => {
    Object.values(vals).forEach(v => { if (v > maxVal) maxVal = v; });
  });

  // Dynamic monthly column sizing
  const mc = months.length;
  let mColW, mFont;
  if (mc <= 12)      { mColW = 38; mFont = '6pt'; }
  else if (mc <= 18) { mColW = 34; mFont = '5.5pt'; }
  else               { mColW = 30; mFont = '5pt'; }

  // Fixed column widths (px)
  const cw = {
    rowNum: 20, phase: 200, ct: 20,
    estQty: 40, uom: 28, estHrs: 40, estCost: 50, estPi: 34,
    pctComp: 36, jtdQty: 40, jtdHrs: 40, jtdCost: 50, jtdPi: 34,
    projQty: 40, projHrs: 40, projCostField: 54, projCostVista: 54, projPi: 34,
    remQty: 40, remHrs: 40, remCost: 54,
    start: 48, end: 48, dur: 28, contour: 38,
    rate: 110,
  };

  const fixedW = cw.rowNum + cw.phase + cw.ct
    + (showEst    ? cw.estQty + cw.uom + cw.estHrs + cw.estCost + cw.estPi : 0)
    + (showJtd    ? cw.pctComp + cw.jtdQty + cw.jtdHrs + cw.jtdCost + cw.jtdPi : 0)
    + (showProj   ? cw.projQty + cw.projHrs + cw.projCostField + cw.projCostVista + cw.projPi : 0)
    + (showRem    ? cw.remQty + cw.remHrs + cw.remCost : 0)
    + (showSched  ? cw.start + cw.end + cw.dur + cw.contour : 0)
    + (showBill   ? cw.rate : 0);
  const totalW = fixedW + (showMonthly ? mc * mColW : 0);

  const totalColCount = 3
    + (showEst    ? 5 : 0)
    + (showJtd    ? 5 : 0)
    + (showProj   ? 5 : 0)
    + (showRem    ? 3 : 0)
    + (showSched  ? 4 : 0)
    + (showBill   ? 1 : 0)
    + (showMonthly ? mc : 0);

  const header = buildProjectHeader(project, viewLabel, items.length, totalEst, totalJtd, logoBase64);
  const footer = buildFooter(project, viewLabel);

  // Style constants
  const thS = `padding: 2px 3px; text-align: center; font-size: 6pt; font-weight: 600; white-space: nowrap; border: 1px solid #cbd5e1; border-bottom: 1px solid #94a3b8; color: #1e293b; overflow: hidden;`;
  const tdS = `padding: 2px 3px; text-align: center; font-size: 6.5pt; white-space: nowrap; border: 1px solid #cbd5e1; overflow: hidden;`;
  const grpBdr = 'border-right: 2px solid #94a3b8;';

  function groupHdrTh(label, color, bgColor, colspan, isLast) {
    const rBdr = isLast && !showMonthly ? '' : grpBdr;
    return `<th colspan="${colspan}" style="${thS} background: ${bgColor}; color: ${color}; font-size: 5.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-left: 2px solid #94a3b8; ${rBdr}">${label}</th>`;
  }

  // ── Build colgroup ────────────────────────────────────────────────
  let colgroupCols = `<col style="width: ${cw.rowNum}px" /><col style="width: ${cw.phase}px" /><col style="width: ${cw.ct}px" />`;
  if (showEst)  colgroupCols += `<col style="width: ${cw.estQty}px" /><col style="width: ${cw.uom}px" /><col style="width: ${cw.estHrs}px" /><col style="width: ${cw.estCost}px" /><col style="width: ${cw.estPi}px" />`;
  if (showJtd)  colgroupCols += `<col style="width: ${cw.pctComp}px" /><col style="width: ${cw.jtdQty}px" /><col style="width: ${cw.jtdHrs}px" /><col style="width: ${cw.jtdCost}px" /><col style="width: ${cw.jtdPi}px" />`;
  if (showProj) colgroupCols += `<col style="width: ${cw.projQty}px" /><col style="width: ${cw.projHrs}px" /><col style="width: ${cw.projCostField}px" /><col style="width: ${cw.projCostVista}px" /><col style="width: ${cw.projPi}px" />`;
  if (showRem)  colgroupCols += `<col style="width: ${cw.remQty}px" /><col style="width: ${cw.remHrs}px" /><col style="width: ${cw.remCost}px" />`;
  if (showSched) colgroupCols += `<col style="width: ${cw.start}px" /><col style="width: ${cw.end}px" /><col style="width: ${cw.dur}px" /><col style="width: ${cw.contour}px" />`;
  if (showBill) colgroupCols += `<col style="width: ${cw.rate}px" />`;
  if (showMonthly) colgroupCols += months.map(() => `<col style="width: ${mColW}px" />`).join('');

  // ── Group header row ──────────────────────────────────────────────
  let groupHdrRow = `<tr style="background: #eef2f7;"><th colspan="3" style="${thS} background: #eef2f7;"></th>`;
  if (showEst)     groupHdrRow += groupHdrTh('Estimated', '#3b82f6', COL_GROUP.est.hdr, 5, !showJtd && !showProj && !showRem && !showSched && !showBill && !showMonthly);
  if (showJtd)     groupHdrRow += groupHdrTh('JTD',       '#f59e0b', COL_GROUP.jtd.hdr, 5, !showProj && !showRem && !showSched && !showBill && !showMonthly);
  if (showProj)    groupHdrRow += groupHdrTh('Projected', '#10b981', COL_GROUP.proj.hdr, 5, !showRem && !showSched && !showBill && !showMonthly);
  if (showRem)     groupHdrRow += groupHdrTh('Remaining', '#8b5cf6', COL_GROUP.rem.hdr,  3, !showSched && !showBill && !showMonthly);
  if (showSched)   groupHdrRow += groupHdrTh('Schedule',  '#64748b', COL_GROUP.sched.hdr, 4, !showBill && !showMonthly);
  if (showBill)    groupHdrRow += groupHdrTh('Billing',   '#db2777', COL_GROUP.bill.hdr,  1, !showMonthly);
  if (showMonthly && mc > 0) groupHdrRow += `<th colspan="${mc}" style="${thS} background: #eef2f7; color: #8b5cf6; font-size: 5.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${monthlyLabel}</th>`;
  groupHdrRow += '</tr>';

  // ── Column header row ─────────────────────────────────────────────
  let colHdrRow = `<tr style="background: #eef2f7;">
    <th style="${thS} background: #eef2f7;">ID</th>
    <th style="${thS} background: #eef2f7; text-align: left; padding-left: 6px;">Phase</th>
    <th style="${thS} background: #eef2f7;">CT</th>`;
  if (showEst) colHdrRow += `
    <th style="${thS} background: ${COL_GROUP.est.hdr}; border-left: 2px solid #94a3b8;">Qty</th>
    <th style="${thS} background: ${COL_GROUP.est.hdr};">UOM</th>
    <th style="${thS} background: ${COL_GROUP.est.hdr};">Hrs</th>
    <th style="${thS} background: ${COL_GROUP.est.hdr};">Cost</th>
    <th style="${thS} background: ${COL_GROUP.est.hdr}; ${grpBdr}">PI</th>`;
  if (showJtd) colHdrRow += `
    <th style="${thS} background: ${COL_GROUP.jtd.hdr};">%Comp</th>
    <th style="${thS} background: ${COL_GROUP.jtd.hdr};">Qty</th>
    <th style="${thS} background: ${COL_GROUP.jtd.hdr};">Hrs</th>
    <th style="${thS} background: ${COL_GROUP.jtd.hdr};">Cost</th>
    <th style="${thS} background: ${COL_GROUP.jtd.hdr}; ${grpBdr}">PI</th>`;
  if (showProj) colHdrRow += `
    <th style="${thS} background: ${COL_GROUP.proj.hdr};">Qty</th>
    <th style="${thS} background: ${COL_GROUP.proj.hdr};">Hrs</th>
    <th style="${thS} background: ${COL_GROUP.proj.hdr}; font-size: 5pt;">Cost (Field)</th>
    <th style="${thS} background: ${COL_GROUP.proj.hdr}; font-size: 5pt;">Cost (Vista)</th>
    <th style="${thS} background: ${COL_GROUP.proj.hdr}; ${grpBdr}">PI</th>`;
  if (showRem) colHdrRow += `
    <th style="${thS} background: ${COL_GROUP.rem.hdr}; border-left: 2px solid #94a3b8;">Qty</th>
    <th style="${thS} background: ${COL_GROUP.rem.hdr};">Hrs</th>
    <th style="${thS} background: ${COL_GROUP.rem.hdr}; ${grpBdr}">Cost</th>`;
  if (showSched) colHdrRow += `
    <th style="${thS} background: ${COL_GROUP.sched.hdr}; border-left: 2px solid #94a3b8;">Start</th>
    <th style="${thS} background: ${COL_GROUP.sched.hdr};">End</th>
    <th style="${thS} background: ${COL_GROUP.sched.hdr};">Days</th>
    <th style="${thS} background: ${COL_GROUP.sched.hdr}; ${grpBdr}">Contour</th>`;
  if (showBill) colHdrRow += `
    <th style="${thS} background: ${COL_GROUP.bill.hdr}; border-left: 2px solid #94a3b8; ${grpBdr}">Rate</th>`;
  if (showMonthly) colHdrRow += months.map(m => `<th style="${thS} background: #eef2f7; font-size: ${mFont};">${fmtMonthLabel(m)}</th>`).join('');
  colHdrRow += '</tr>';

  // ── Data rows ─────────────────────────────────────────────────────
  let rows = '';

  ctGroups.forEach(group => {
    // Group-level monthly totals
    const gMonthly = {};
    months.forEach(m => {
      const key = formatMonthKey(m);
      gMonthly[key] = group.items.reduce((s, item) => s + ((allMonthly.get(item.id) || {})[key] || 0), 0);
    });

    const gRemQty  = Math.max(0, group.projQty - group.jtdQty);
    const gRemHrs  = Math.max(0, group.projHrs - group.jtdHrs);
    const gRemCost = Math.max(0, group.projCostVista - group.jtdCost);

    // Group summary row
    rows += `<tr style="background: ${group.color}10; page-break-inside: avoid;">`;
    rows += `<td style="${tdS} font-weight: 700; font-size: 6.5pt; text-align: left; padding-left: 6px; border-left: 3px solid ${group.color};" colspan="3">`;
    rows += `<span style="color: ${group.color};">${escHtml(group.name)}</span> <span style="color: #64748b; font-size: 5.5pt;">(${group.items.length})</span></td>`;

    if (showEst) {
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; border-left: 2px solid #94a3b8;">${group.estQty ? Math.round(group.estQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};"></td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};">${fmtHrs(group.estHrs)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 600;">${fmtCompact(group.estCost)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; ${grpBdr}">${fmtPi(group.estQty, group.estHrs)}</td>`;
    }
    if (showJtd) {
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtPct(group.pctComp)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${group.jtdQty ? Math.round(group.jtdQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtHrs(group.jtdHrs)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtCompact(group.jtdCost)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; ${grpBdr}">${fmtPi(group.jtdQty, group.jtdHrs)}</td>`;
    }
    if (showProj) {
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell};">${group.projQty ? Math.round(group.projQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell};">${fmtHrs(group.projHrs)}</td>`;
      { const bl = group.projCostVista > 0 ? group.projCostVista : group.estCost; const cs = costCellStyle(group.projCostField, bl);
        rows += `<td style="${tdS} background: ${cs.bg || COL_GROUP.proj.cell}; color: ${cs.fg}; font-weight: 600;">${fmtCompact(group.projCostField)}</td>`; }
      { const cs = costCellStyle(group.projCostVista, group.estCost);
        rows += `<td style="${tdS} background: ${cs.bg || COL_GROUP.proj.cell}; color: ${cs.fg}; font-weight: 600;">${group.projCostVista > 0 ? fmtCompact(group.projCostVista) : '$0'}</td>`; }
      rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; ${grpBdr}">${fmtPi(group.projQty, group.projHrs)}</td>`;
    }
    if (showRem) {
      rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; border-left: 2px solid #94a3b8;">${gRemQty ? Math.round(gRemQty).toLocaleString() : '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell};">${fmtHrs(gRemHrs)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; font-weight: 600; ${grpBdr}">${fmtCompact(gRemCost)}</td>`;
    }
    if (showSched) {
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; border-left: 2px solid #94a3b8;">${fmtDateShort(group.earliestStart)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${fmtDateShort(group.latestEnd)}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${group.duration || '-'}</td>`;
      rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; ${grpBdr}"></td>`;
    }
    if (showBill) {
      rows += `<td style="${tdS} background: ${COL_GROUP.bill.cell}; border-left: 2px solid #94a3b8; ${grpBdr} color: #cbd5e1;">—</td>`;
    }
    if (showMonthly) {
      months.forEach(m => {
        const key = formatMonthKey(m);
        const val = gMonthly[key] || 0;
        rows += `<td style="${tdS} font-size: ${mFont}; font-weight: 600; color: ${val > 0 ? '#1e293b' : '#cbd5e1'}; background: ${val > 0 ? group.color + '15' : 'transparent'};">${fmtMonthVal(val)}</td>`;
      });
    }
    rows += '</tr>';

    // Item rows
    group.items.forEach(item => {
      const estQty  = parseNum(item.quantity);
      const estHrs  = parseNum(item.total_est_hours);
      const estCost = parseNum(item.total_est_cost);
      const jtdQty  = parseNum(item.quantity_installed);
      const jtdHrs  = parseNum(item.total_jtd_hours);
      const jtdCost = parseNum(item.total_jtd_cost);
      const pctComp = parseNum(item.percent_complete);
      const jtdPiVal = jtdQty > 0 && jtdHrs > 0 ? jtdQty / jtdHrs : 0;
      const projQty  = estQty;
      const projHrs  = jtdPiVal > 0 ? estQty / jtdPiVal : estHrs;
      const projCostField = pctComp > 0 ? Math.max(jtdCost / (pctComp / 100), jtdCost) : jtdCost > estCost ? jtdCost : estCost;
      const vistaProjCost = parseNum(item.total_projected_cost);
      const projCostVista = vistaProjCost > 0 ? Math.max(vistaProjCost, jtdCost) : 0;
      const remQty  = Math.max(0, projQty - jtdQty);
      const remHrs  = Math.max(0, projHrs - jtdHrs);
      const remCost = Math.max(0, projCostVista - jtdCost);
      const dur = getDuration(item.start_date, item.end_date);
      const monthlyVals = allMonthly.get(item.id) || {};

      const projHrsColor = projHrs > estHrs ? '#ef4444' : projHrs < estHrs ? '#10b981' : '#1e293b';
      const csField = costCellStyle(projCostField, projCostVista > 0 ? projCostVista : estCost);
      const csVista = projCostVista > 0 ? costCellStyle(projCostVista, estCost) : estCost > 0 ? { bg: '#C6EFCE', fg: '#006100' } : { bg: '', fg: '#cbd5e1' };
      const ePi = estHrs > 0 ? estQty / estHrs : 0;
      const pPi = projHrs > 0 ? projQty / projHrs : 0;
      const projPiColor = pPi < ePi ? '#ef4444' : pPi > ePi ? '#10b981' : '#64748b';

      rows += '<tr>';
      rows += `<td style="${tdS} font-size: 5.5pt; color: #94a3b8;">${item.row_number || ''}</td>`;
      rows += `<td style="${tdS} text-align: left; max-width: ${cw.phase}px; overflow: hidden; text-overflow: ellipsis;">`;
      if (item.cost_types) {
        item.cost_types.forEach(ct => {
          rows += `<span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${COST_TYPE_COLORS[ct] || '#999'}; margin-right: 2px; vertical-align: middle;"></span>`;
        });
      }
      if (item.phase_code_display) rows += `<span style="color: #64748b;">${escHtml(item.phase_code_display)} - </span>`;
      rows += `<span>${escHtml(item.name)}</span></td>`;
      rows += `<td style="${tdS} font-size: 5.5pt; color: #64748b;">${item.cost_types ? item.cost_types.map(ct => (COST_TYPE_NAMES[ct] || '').charAt(0)).join('') : ''}</td>`;

      if (showEst) {
        rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; border-left: 2px solid #94a3b8;">${estQty ? Math.round(estQty).toLocaleString() : '-'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-size: 5.5pt;">${item.quantity_uom || '-'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};">${fmtHrs(estHrs)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 500;">${fmtCompact(estCost)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; color: #64748b; ${grpBdr}">${fmtPi(estQty, estHrs)}</td>`;
      }
      if (showJtd) {
        rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtPct(pctComp)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${jtdQty ? Math.round(jtdQty).toLocaleString() : '-'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtHrs(jtdHrs)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell};">${fmtCompact(jtdCost)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; color: #64748b; ${grpBdr}">${fmtPi(jtdQty, jtdHrs)}</td>`;
      }
      if (showProj) {
        rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell};">${projQty ? Math.round(projQty).toLocaleString() : '-'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; color: ${projHrsColor};">${fmtHrs(projHrs)}</td>`;
        rows += `<td style="${tdS} background: ${csField.bg || COL_GROUP.proj.cell}; font-weight: 500; color: ${csField.fg};">${fmtCompact(projCostField)}</td>`;
        rows += `<td style="${tdS} background: ${csVista.bg || COL_GROUP.proj.cell}; color: ${csVista.fg};">${projCostVista > 0 ? fmtCompact(projCostVista) : '$0'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; color: ${projPiColor}; ${grpBdr}">${fmtPi(projQty, projHrs)}</td>`;
      }
      if (showRem) {
        rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; border-left: 2px solid #94a3b8;">${remQty ? Math.round(remQty).toLocaleString() : '-'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell};">${fmtHrs(remHrs)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; ${grpBdr}">${fmtCompact(remCost)}</td>`;
      }
      if (showSched) {
        rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; border-left: 2px solid #94a3b8;">${fmtDateShort(item.start_date)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${fmtDateShort(item.end_date)}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell};">${dur || '-'}</td>`;
        rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; font-size: 5.5pt; ${grpBdr}">${item.contour_type || 'flat'}</td>`;
      }
      if (showBill) {
        const isLabor = (item.cost_types?.[0] || 0) === 1;
        const isUnrated = isLabor && !item.billable_rate_id;
        const color = !isLabor || isUnrated ? '#cbd5e1' : '#1e293b';
        rows += `<td style="${tdS} background: ${COL_GROUP.bill.cell}; border-left: 2px solid #94a3b8; ${grpBdr} font-size: 5.5pt; color: ${color}; text-align: left; padding-left: 4px;">${escHtml(rateLabel(item))}</td>`;
      }
      if (showMonthly) {
        months.forEach(m => {
          const key = formatMonthKey(m);
          const val = monthlyVals[key] || 0;
          const intensity = maxVal > 0 ? val / maxVal : 0;
          const bgColor = val > 0 ? `rgba(59, 130, 246, ${(0.05 + intensity * 0.25).toFixed(2)})` : 'transparent';
          rows += `<td style="${tdS} font-size: ${mFont}; background: ${bgColor}; color: ${val > 0 ? '#1e293b' : '#cbd5e1'};">${fmtMonthVal(val)}</td>`;
        });
      }
      rows += '</tr>';
    });
  });

  // ── Grand totals row ──────────────────────────────────────────────
  const grandEstQty       = items.reduce((s, i) => s + parseNum(i.quantity), 0);
  const grandEstHrs       = items.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
  const grandJtdQty       = items.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
  const grandJtdHrs       = items.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
  const grandPctComp      = totalEst > 0 ? (totalJtd / totalEst * 100) : 0;
  const grandProjQty      = grandEstQty;
  const grandProjHrs      = ctGroups.reduce((s, g) => s + g.projHrs, 0);
  const grandProjCostField = ctGroups.reduce((s, g) => s + g.projCostField, 0);
  const grandProjCostVista = ctGroups.reduce((s, g) => s + g.projCostVista, 0);
  const grandRemQty  = Math.max(0, grandProjQty - grandJtdQty);
  const grandRemHrs  = Math.max(0, grandProjHrs - grandJtdHrs);
  const grandRemCost = Math.max(0, grandProjCostVista - totalJtd);

  rows += `<tr style="font-weight: 700; background: #f1f5f9;">`;
  rows += `<td style="${tdS} font-weight: 700;" colspan="3">TOTAL</td>`;
  if (showEst) {
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 700; border-left: 2px solid #94a3b8;">${grandEstQty ? Math.round(grandEstQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell};"></td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 700;">${fmtHrs(grandEstHrs)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; font-weight: 700;">${fmtCompact(totalEst)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.est.cell}; ${grpBdr}">${fmtPi(grandEstQty, grandEstHrs)}</td>`;
  }
  if (showJtd) {
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${fmtPct(grandPctComp)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${grandJtdQty ? Math.round(grandJtdQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${fmtHrs(grandJtdHrs)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; font-weight: 700;">${fmtCompact(totalJtd)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.jtd.cell}; ${grpBdr}">${fmtPi(grandJtdQty, grandJtdHrs)}</td>`;
  }
  if (showProj) {
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 700;">${grandProjQty ? Math.round(grandProjQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; font-weight: 700;">${fmtHrs(grandProjHrs)}</td>`;
    { const cs = costCellStyle(grandProjCostField, grandProjCostVista > 0 ? grandProjCostVista : totalEst);
      rows += `<td style="${tdS} background: ${cs.bg || COL_GROUP.proj.cell}; color: ${cs.fg}; font-weight: 700;">${fmtCompact(grandProjCostField)}</td>`; }
    { const cs = costCellStyle(grandProjCostVista, totalEst);
      rows += `<td style="${tdS} background: ${cs.bg || COL_GROUP.proj.cell}; color: ${cs.fg}; font-weight: 700;">${grandProjCostVista > 0 ? fmtCompact(grandProjCostVista) : '$0'}</td>`; }
    rows += `<td style="${tdS} background: ${COL_GROUP.proj.cell}; ${grpBdr}">${fmtPi(grandProjQty, grandProjHrs)}</td>`;
  }
  if (showRem) {
    rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; font-weight: 700; border-left: 2px solid #94a3b8;">${grandRemQty ? Math.round(grandRemQty).toLocaleString() : '-'}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; font-weight: 700;">${fmtHrs(grandRemHrs)}</td>`;
    rows += `<td style="${tdS} background: ${COL_GROUP.rem.cell}; font-weight: 700; ${grpBdr}">${fmtCompact(grandRemCost)}</td>`;
  }
  if (showSched) {
    rows += `<td style="${tdS} background: ${COL_GROUP.sched.cell}; border-left: 2px solid #94a3b8;" colspan="4"></td>`;
  }
  if (showBill) {
    rows += `<td style="${tdS} background: ${COL_GROUP.bill.cell}; border-left: 2px solid #94a3b8; ${grpBdr}"></td>`;
  }
  if (showMonthly) {
    months.forEach(m => {
      const key = formatMonthKey(m);
      let colTotal = 0;
      items.forEach(item => { colTotal += (allMonthly.get(item.id) || {})[key] || 0; });
      rows += `<td style="${tdS} font-size: ${mFont}; font-weight: 700; color: ${colTotal > 0 ? '#1e293b' : '#cbd5e1'};">${fmtMonthVal(colTotal)}</td>`;
    });
  }
  rows += '</tr>';

  return `
    <table style="border-collapse: collapse; table-layout: fixed; width: ${totalW}px; font-family: system-ui, -apple-system, sans-serif;">
      <colgroup>${colgroupCols}</colgroup>
      <thead style="display: table-header-group;">
        <tr><td colspan="${totalColCount}" style="border: none; padding: 0;">${header}</td></tr>
        ${groupHdrRow}
        ${colHdrRow}
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${footer}`;
}

// ═══════════════════════════════════════════════════════════════════════
// GANTT VIEW HTML  (unchanged — groups filter not applied here)
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

  const lc = { rowNum: 24, phase: 160, ct: 22, estCost: 58, start: 52, end: 52, dur: 30, contour: 44 };
  const leftW = Object.values(lc).reduce((a, b) => a + b, 0);
  const totalW = leftW + timelineW;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
  const todayX = firstMonth ? dateToX(today) + leftW : 0;
  const thS = `padding: 2px 3px; text-align: center; font-size: 6pt; font-weight: 600; white-space: nowrap; border: 1px solid #cbd5e1; border-bottom: 1px solid #94a3b8; color: #1e293b; background: #eef2f7; overflow: hidden;`;

  let rowsHtml = '';
  groups.forEach(group => {
    const gStart = group.earliestStart ? new Date(group.earliestStart) : null;
    const gEnd   = group.latestEnd   ? new Date(group.latestEnd)   : null;
    let gBarHtml = '';
    if (gStart && gEnd && firstMonth && gStart >= firstMonth) {
      const gBarLeft = dateToX(gStart) + 2;
      const gEndDIM  = new Date(gEnd.getFullYear(), gEnd.getMonth() + 1, 0).getDate();
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
    rowsHtml += `<td colspan="${mc}" style="position: relative; height: ${rowH}px; border-bottom: 1px solid #94a3b8; padding: 0;">`;
    rowsHtml += gBarHtml;
    rowsHtml += '</td></tr>';

    group.items.forEach(item => {
      const startDate = item.start_date ? new Date(item.start_date) : null;
      const endDate   = item.end_date   ? new Date(item.end_date)   : null;
      const dur = getDuration(item.start_date, item.end_date);
      const barColor = COST_TYPE_COLORS[(item.cost_types && item.cost_types[0]) || 1];

      let barHtml = '';
      if (startDate && endDate && firstMonth && startDate >= firstMonth) {
        const barLeft = dateToX(startDate) + 2;
        const endDIM  = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
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
      if (item.phase_code_display) rowsHtml += `<span style="color: #64748b;">${escHtml(item.phase_code_display)} - </span>`;
      rowsHtml += `${escHtml(item.name)}</td>`;
      rowsHtml += `<td style="padding: 2px 2px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center; color: #64748b;">${item.cost_types ? item.cost_types.map(ct => (COST_TYPE_NAMES[ct] || '').charAt(0)).join('') : ''}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 6pt; text-align: center;">${fmtCompact(parseNum(item.total_est_cost))}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center;">${fmtDateShort(item.start_date)}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center;">${fmtDateShort(item.end_date)}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 6pt; text-align: center;">${dur || '-'}</td>`;
      rowsHtml += `<td style="padding: 2px 3px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; font-size: 5.5pt; text-align: center;">${item.contour_type || 'flat'}</td>`;
      rowsHtml += `<td colspan="${mc}" style="position: relative; height: ${rowH}px; border-bottom: 1px solid #cbd5e1; padding: 0;">`;
      rowsHtml += barHtml;
      rowsHtml += '</td></tr>';
    });
  });

  const ganttTotalCols = 8 + mc;
  return `
    <table style="border-collapse: collapse; table-layout: fixed; width: ${totalW}px; font-family: system-ui, -apple-system, sans-serif;">
      <colgroup>
        <col style="width: ${lc.rowNum}px" /><col style="width: ${lc.phase}px" /><col style="width: ${lc.ct}px" />
        <col style="width: ${lc.estCost}px" /><col style="width: ${lc.start}px" /><col style="width: ${lc.end}px" />
        <col style="width: ${lc.dur}px" /><col style="width: ${lc.contour}px" />
        ${months.map(() => `<col style="width: ${colWidth}px" />`).join('')}
      </colgroup>
      <thead style="display: table-header-group;">
        <tr><td colspan="${ganttTotalCols}" style="border: none; padding: 0;">${header}</td></tr>
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
      <tbody>${rowsHtml}</tbody>
    </table>
    ${todayX > leftW ? `<div style="position: absolute; left: ${todayX}px; top: 0; bottom: 0; width: 2px; background: #ef4444; opacity: 0.6; z-index: 10;"><div style="position: absolute; top: -1px; left: -12px; font-size: 5pt; color: #ef4444; font-weight: 600;">Today</div></div>` : ''}
    ${footer}`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════
function generatePhaseSchedulePdfHtml(data) {
  const { items, project, view, mode, logoBase64, groups, laborRateById, laborRates, markupByCt, shift } = data;
  const months = generateMonths(items);

  const content = view === 'gantt'
    ? buildGanttHtml(items, months, project, logoBase64)
    : buildGridHtml(items, months, mode || 'cost', project, logoBase64, groups, laborRateById, laborRates, markupByCt, shift);

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
    @page { size: letter landscape; }
    table { border-collapse: collapse; }
    td, th { vertical-align: middle; }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 0 0 8px 0; margin-bottom: 6px; border-bottom: 2px solid #3b82f6;
    }
    @media print { thead { display: table-header-group; } }
    .header-left { flex: 1; }
    .header-left h1 { font-size: 14pt; font-weight: 700; color: #1e293b; margin: 0 0 2px 0; }
    .header-project { font-size: 9pt; font-weight: 600; color: #475569; margin-bottom: 2px; }
    .header-meta { font-size: 7pt; color: #94a3b8; }
    .header-right { flex-shrink: 0; margin-left: 16px; }
    .logo { max-height: 48px; max-width: 160px; object-fit: contain; }
    .footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 0 0 0; margin-top: 8px; border-top: 1px solid #e2e8f0;
      font-size: 6.5pt; color: #94a3b8;
    }
  </style>
</head>
<body style="padding: 2px; position: relative;">
  ${content}
</body>
</html>`;
}

module.exports = { generatePhaseSchedulePdfHtml };
