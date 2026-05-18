/**
 * Phase Schedule Excel Generator
 * Exports phase schedule grid to an Excel workbook using ExcelJS.
 * Raw numbers with currency formatting; mirrors PDF generator column logic.
 */

const ExcelJS = require('exceljs');
const { getContourMultipliers } = require('./phaseScheduleContours');

// ─── Constants ────────────────────────────────────────────────────────
const COST_TYPE_NAMES = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions'
};
const COST_TYPE_COLORS = {
  1: '3b82f6', 2: '10b981', 3: 'f59e0b', 4: '8b5cf6', 5: 'ef4444', 6: '6b7280'
};
const GROUP_ARGB = {
  est:   { hdr: 'FFdbeafe', cell: 'FFeff6ff' },
  jtd:   { hdr: 'FFfef3c7', cell: 'FFfffbeb' },
  proj:  { hdr: 'FFdcfce7', cell: 'FFf0fdf4' },
  rem:   { hdr: 'FFede9fe', cell: 'FFf5f3ff' },
  sched: { hdr: 'FFe2e8f0', cell: 'FFf8fafc' },
  total: { hdr: 'FFf1f5f9', cell: 'FFf1f5f9' },
};

const SHIFT_HRS_PER_MONTH = {
  '5/8':  (5 * 8)  * 52 / 12,
  '5/10': (5 * 10) * 52 / 12,
  '6/8':  (6 * 8)  * 52 / 12,
  '6/10': (6 * 10) * 52 / 12,
};

// ─── Helpers ──────────────────────────────────────────────────────────
const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonthLabel(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}`;
}

function generateMonths(items) {
  let earliest = null, latest = null;
  items.forEach(item => {
    if (item.start_date) { const s = new Date(item.start_date); if (!earliest || s < earliest) earliest = s; }
    if (item.end_date)   { const e = new Date(item.end_date);   if (!latest   || e > latest)   latest   = e; }
  });
  if (!earliest || !latest) return [];

  earliest = addMonths(earliest, -1);
  latest   = addMonths(latest, 1);

  const months = [];
  let current = startOfMonth(earliest);
  const last  = startOfMonth(latest);
  while (current <= last) {
    months.push(new Date(current));
    current = addMonths(current, 1);
  }
  return months;
}

// ─── Monthly Distribution ─────────────────────────────────────────────
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
        total = Math.max(0, projHrs - jtdHrs) * (laborRateById.get(item.billable_rate_id) || 0);
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
    default: // cost
      if (item.use_manual_values && item.manual_monthly_values) {
        return typeof item.manual_monthly_values === 'string'
          ? JSON.parse(item.manual_monthly_values) : item.manual_monthly_values;
      }
      total = Math.max(0, vPC - jtdCost);
      break;
  }

  if (total <= 0) return values;

  const itemStart  = startOfMonth(new Date(item.start_date));
  const itemEnd    = startOfMonth(new Date(item.end_date));
  const itemMonths = months.filter(m => m >= itemStart && m <= itemEnd);
  if (itemMonths.length === 0) return values;

  const multipliers = getContourMultipliers(itemMonths.length, item.contour_type || 'flat');
  const perMonth = total / itemMonths.length;
  itemMonths.forEach((m, i) => { values[formatMonthKey(m)] = perMonth * multipliers[i]; });
  return values;
}

// ─── Cost Type Groups ─────────────────────────────────────────────────
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
      const jQ = parseNum(i.quantity_installed), jH = parseNum(i.total_jtd_hours);
      const eQ = parseNum(i.quantity), eH = parseNum(i.total_est_hours);
      const pi = jQ > 0 && jH > 0 ? jQ / jH : 0;
      return s + (pi > 0 ? eQ / pi : eH);
    }, 0);
    const projCostField = ctItems.reduce((s, i) => {
      const pct = parseNum(i.percent_complete), jC = parseNum(i.total_jtd_cost), eC = parseNum(i.total_est_cost);
      return s + (pct > 0 ? Math.max(jC / (pct / 100), jC) : jC > eC ? jC : eC);
    }, 0);
    const projCostVista = ctItems.reduce((s, i) => {
      const vPC = parseNum(i.total_projected_cost), jC = parseNum(i.total_jtd_cost);
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
    });
  }
  return groups;
}

// ─── Cell style helpers ───────────────────────────────────────────────
function bgFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function borderStyle(sides = {}) {
  const thin = { style: 'thin', color: { argb: 'FFcbd5e1' } };
  const med  = { style: 'medium', color: { argb: 'FF94a3b8' } };
  return {
    top:    sides.top    ? med : thin,
    bottom: sides.bottom ? med : thin,
    left:   sides.left   ? med : thin,
    right:  sides.right  ? med : thin,
  };
}

// ─── Main export ──────────────────────────────────────────────────────
async function generatePhaseScheduleExcelBuffer(data) {
  const { items, project, mode, groups: groupsParam, laborRateById, markupByCt, shift } = data;

  const showEst     = !groupsParam || groupsParam.has('est');
  const showJtd     = !groupsParam || groupsParam.has('jtd');
  const showProj    = !groupsParam || groupsParam.has('proj');
  const showRem     = !groupsParam || groupsParam.has('rem');
  const showSched   = !groupsParam || groupsParam.has('sched');
  const showMonthly = !groupsParam || groupsParam.has('monthly');

  const shiftHrs = SHIFT_HRS_PER_MONTH[shift || '5/8'] || SHIFT_HRS_PER_MONTH['5/8'];

  const months = generateMonths(items);
  const ctGroups = buildCostTypeGroups(items);

  // Compute all monthly values
  const allMonthly = new Map();
  items.forEach(item => {
    allMonthly.set(item.id, computeMonthlyValues(item, months, mode, laborRateById, markupByCt));
  });

  const modeLabels = { cost: 'Cost', qty: 'Qty', manpower: `Manpower (${shift || '5/8'})`, billable: 'Billable' };
  const monthlyLabel = { cost: 'Monthly Cost', qty: 'Monthly Qty', manpower: 'Monthly Headcount', billable: 'Monthly Billable' }[mode] || 'Monthly';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tweet Garot PM';
  wb.created = new Date();

  const ws = wb.addWorksheet('Phase Schedule', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 5 },
  });

  // ── Build column definitions ────────────────────────────────────────
  const colDefs = [
    { header: '#',    key: 'rowNum', width: 5,  group: null },
    { header: 'Phase / Description', key: 'phase', width: 42, group: null },
    { header: 'CT',   key: 'ct',    width: 6,  group: null },
  ];
  const COL_FMT_CURRENCY = '$#,##0';
  const COL_FMT_INT      = '#,##0';
  const COL_FMT_HRS      = '#,##0.0';
  const COL_FMT_PCT      = '0%';
  const COL_FMT_HEADCOUNT = '0.0';

  if (showEst) {
    colDefs.push(
      { header: 'Qty',  key: 'estQty',  width: 10, group: 'est', numFmt: COL_FMT_INT,      groupLeft: true },
      { header: 'UOM',  key: 'uom',     width: 7,  group: 'est' },
      { header: 'Hrs',  key: 'estHrs',  width: 10, group: 'est', numFmt: COL_FMT_HRS },
      { header: 'Cost', key: 'estCost', width: 13, group: 'est', numFmt: COL_FMT_CURRENCY },
      { header: 'PI',   key: 'estPi',   width: 9,  group: 'est', numFmt: '#,##0.00',        groupRight: true },
    );
  }
  if (showJtd) {
    colDefs.push(
      { header: '%Comp', key: 'pctComp', width: 9,  group: 'jtd', numFmt: COL_FMT_PCT,       groupLeft: true },
      { header: 'Qty',   key: 'jtdQty',  width: 10, group: 'jtd', numFmt: COL_FMT_INT },
      { header: 'Hrs',   key: 'jtdHrs',  width: 10, group: 'jtd', numFmt: COL_FMT_HRS },
      { header: 'Cost',  key: 'jtdCost', width: 13, group: 'jtd', numFmt: COL_FMT_CURRENCY },
      { header: 'PI',    key: 'jtdPi',   width: 9,  group: 'jtd', numFmt: '#,##0.00',        groupRight: true },
    );
  }
  if (showProj) {
    colDefs.push(
      { header: 'Qty',          key: 'projQty',        width: 10, group: 'proj', numFmt: COL_FMT_INT,      groupLeft: true },
      { header: 'Hrs',          key: 'projHrs',        width: 10, group: 'proj', numFmt: COL_FMT_HRS },
      { header: 'Cost (Field)', key: 'projCostField',  width: 14, group: 'proj', numFmt: COL_FMT_CURRENCY },
      { header: 'Cost (Vista)', key: 'projCostVista',  width: 14, group: 'proj', numFmt: COL_FMT_CURRENCY },
      { header: 'PI',           key: 'projPi',         width: 9,  group: 'proj', numFmt: '#,##0.00',        groupRight: true },
    );
  }
  if (showRem) {
    colDefs.push(
      { header: 'Rem Qty',  key: 'remQty',  width: 10, group: 'rem', numFmt: COL_FMT_INT,      groupLeft: true },
      { header: 'Rem Hrs',  key: 'remHrs',  width: 10, group: 'rem', numFmt: COL_FMT_HRS },
      { header: 'Rem Cost', key: 'remCost', width: 13, group: 'rem', numFmt: COL_FMT_CURRENCY, groupRight: true },
    );
  }
  if (showSched) {
    colDefs.push(
      { header: 'Start',   key: 'start',   width: 12, group: 'sched', groupLeft: true },
      { header: 'End',     key: 'end',     width: 12, group: 'sched' },
      { header: 'Days',    key: 'dur',     width: 7,  group: 'sched', numFmt: COL_FMT_INT },
      { header: 'Contour', key: 'contour', width: 10, group: 'sched', groupRight: true },
    );
  }
  if (showMonthly) {
    months.forEach((m, i) => {
      const isFirst = i === 0;
      const isLast  = i === months.length - 1;
      const numFmt  = mode === 'qty' ? COL_FMT_INT : mode === 'manpower' ? COL_FMT_HEADCOUNT : COL_FMT_CURRENCY;
      colDefs.push({
        header: fmtMonthLabel(m), key: `m_${formatMonthKey(m)}`, width: 11,
        group: 'monthly', monthKey: formatMonthKey(m), numFmt,
        groupLeft: isFirst, groupRight: isLast,
      });
    });
  }

  ws.columns = colDefs.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // ── Title row ──────────────────────────────────────────────────────
  const titleRow = ws.addRow([]);
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  titleRow.getCell(1).value = `Phase Schedule — Grid (${modeLabels[mode] || 'Cost'})`;
  titleRow.getCell(1).font  = { bold: true, size: 13, color: { argb: 'FF1e293b' } };
  const projCell = titleRow.getCell(2);
  projCell.value = `${project.number ? '#' + project.number + ' — ' : ''}${project.name || ''}`;
  projCell.font  = { size: 10, color: { argb: 'FF475569' } };
  const dateCell = titleRow.getCell(colDefs.length);
  dateCell.value = `Generated ${dateStr}`;
  dateCell.font  = { size: 8, color: { argb: 'FF94a3b8' }, italic: true };
  dateCell.alignment = { horizontal: 'right' };
  titleRow.height = 22;
  ws.addRow([]); // blank spacer

  // ── Group header row (row 3) ────────────────────────────────────────
  const groupHdrRow = ws.addRow([]);
  groupHdrRow.height = 14;

  let colIdx = 4; // 1-indexed, after rowNum/phase/ct
  function addGroupHdr(label, argbHdr, argbColor, count) {
    if (count === 0) return;
    const startCol = colIdx;
    const endCol   = colIdx + count - 1;
    for (let c = startCol; c <= endCol; c++) {
      const cell = groupHdrRow.getCell(c);
      cell.fill      = bgFill(argbHdr);
      cell.font      = { bold: true, size: 7, color: { argb: argbColor } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = borderStyle({ top: true, bottom: true, left: c === startCol, right: c === endCol });
    }
    groupHdrRow.getCell(startCol).value = label;
    if (count > 1) ws.mergeCells(3, startCol, 3, endCol);
    colIdx += count;
  }

  // Fixed cols (no group header)
  for (let c = 1; c <= 3; c++) {
    const cell = groupHdrRow.getCell(c);
    cell.fill = bgFill('FFeef2f7');
  }

  if (showEst)  addGroupHdr('Estimated',  GROUP_ARGB.est.hdr,   'FF3b82f6', 5);
  if (showJtd)  addGroupHdr('JTD',        GROUP_ARGB.jtd.hdr,   'FFf59e0b', 5);
  if (showProj) addGroupHdr('Projected',  GROUP_ARGB.proj.hdr,  'FF10b981', 5);
  if (showRem)  addGroupHdr('Remaining',  GROUP_ARGB.rem.hdr,   'FF8b5cf6', 3);
  if (showSched) addGroupHdr('Schedule',  GROUP_ARGB.sched.hdr, 'FF64748b', 4);
  if (showMonthly && months.length > 0) addGroupHdr(monthlyLabel, 'FFeef2f7', 'FF8b5cf6', months.length);

  // ── Column header row (row 4) ───────────────────────────────────────
  const colHdrRow = ws.addRow(colDefs.map(c => c.header));
  colHdrRow.height = 14;
  colHdrRow.eachCell((cell, cIdx) => {
    const def = colDefs[cIdx - 1];
    const grp = def && def.group;
    const argbCell = grp ? GROUP_ARGB[grp]?.hdr : 'FFeef2f7';
    cell.fill      = bgFill(argbCell || 'FFeef2f7');
    cell.font      = { bold: true, size: 7, color: { argb: 'FF1e293b' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    cell.border    = borderStyle({ bottom: true, left: def?.groupLeft, right: def?.groupRight });
  });

  // ── Data writer helpers ────────────────────────────────────────────
  const dataRowFill    = (grp) => bgFill(grp ? GROUP_ARGB[grp]?.cell : 'FFFFFFFF');
  const groupRowFill   = (argb) => bgFill(argb + '18');
  const totalRowFill   = bgFill(GROUP_ARGB.total.cell);

  function addDataRow(rowData, isGroupRow, isTotal) {
    const row = ws.addRow([]);
    colDefs.forEach((def, i) => {
      const cell = row.getCell(i + 1);
      const val  = rowData[def.key];
      if (val !== undefined && val !== null && val !== '') {
        if (def.numFmt && typeof val === 'number') {
          cell.value  = val;
          cell.numFmt = def.numFmt;
          if (def.numFmt === COL_FMT_PCT && typeof val === 'number') {
            cell.value = val / 100; // ExcelJS expects 0-1 for percent
          }
        } else {
          cell.value = val;
        }
      }
      cell.fill      = isTotal ? totalRowFill : (isGroupRow ? groupRowFill(rowData._groupColor || 'FF64748b') : dataRowFill(def.group));
      cell.font      = { size: 7.5, bold: isGroupRow || isTotal, color: { argb: rowData._cellColor?.[def.key] || 'FF1e293b' } };
      cell.alignment = { horizontal: def.key === 'phase' || def.key === 'ct' ? 'left' : 'center', vertical: 'middle' };
      cell.border    = borderStyle({ left: def?.groupLeft, right: def?.groupRight });
    });
    row.height = isGroupRow ? 13 : 12;
    return row;
  }

  // ── Emit cost-type groups and items ───────────────────────────────
  ctGroups.forEach(group => {
    const gMonthly = {};
    months.forEach(m => {
      const key = formatMonthKey(m);
      gMonthly[key] = group.items.reduce((s, item) => s + ((allMonthly.get(item.id) || {})[key] || 0), 0);
    });

    const gRemQty  = Math.max(0, group.projQty - group.jtdQty);
    const gRemHrs  = Math.max(0, group.projHrs - group.jtdHrs);
    const gRemCost = Math.max(0, group.projCostVista - group.jtdCost);

    const gRow = {
      rowNum: '', phase: `${group.name} (${group.items.length} items)`, ct: '',
      _groupColor: COST_TYPE_COLORS[group.costType],
      estQty: group.estQty || null, uom: '', estHrs: group.estHrs || null, estCost: group.estCost || null,
      estPi: group.estQty && group.estHrs ? group.estQty / group.estHrs : null,
      pctComp: group.pctComp || null, jtdQty: group.jtdQty || null, jtdHrs: group.jtdHrs || null,
      jtdCost: group.jtdCost || null,
      jtdPi: group.jtdQty && group.jtdHrs ? group.jtdQty / group.jtdHrs : null,
      projQty: group.projQty || null, projHrs: group.projHrs || null,
      projCostField: group.projCostField || null, projCostVista: group.projCostVista || null,
      projPi: group.projQty && group.projHrs ? group.projQty / group.projHrs : null,
      remQty: gRemQty || null, remHrs: gRemHrs || null, remCost: gRemCost || null,
      start: group.earliestStart || null, end: group.latestEnd || null,
      dur: null, contour: '',
    };
    months.forEach(m => {
      const key = formatMonthKey(m);
      const val = gMonthly[key] || 0;
      gRow[`m_${key}`] = val > 0 ? (mode === 'manpower' ? val / shiftHrs : val) : null;
    });
    addDataRow(gRow, true, false);

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
      const monthlyVals = allMonthly.get(item.id) || {};
      const ctName = item.cost_types ? item.cost_types.map(ct => (COST_TYPE_NAMES[ct] || '').charAt(0)).join('') : '';
      const phaseName = item.phase_code_display ? `${item.phase_code_display} - ${item.name}` : item.name;

      const iRow = {
        rowNum: item.row_number || '',
        phase: phaseName, ct: ctName,
        estQty:  estQty  || null,  uom: item.quantity_uom || '',
        estHrs:  estHrs  || null,  estCost: estCost || null,
        estPi:   estHrs  > 0 ? estQty / estHrs : null,
        pctComp: pctComp || null,  jtdQty: jtdQty || null, jtdHrs: jtdHrs || null,
        jtdCost: jtdCost || null,
        jtdPi:   jtdHrs  > 0 ? jtdQty / jtdHrs : null,
        projQty: projQty || null,  projHrs: projHrs || null,
        projCostField: projCostField || null,  projCostVista: projCostVista || null,
        projPi:  projHrs > 0 ? projQty / projHrs : null,
        remQty:  remQty  || null,  remHrs: remHrs || null, remCost: remCost || null,
        start:   item.start_date || null, end: item.end_date || null,
        dur:     item.start_date && item.end_date
          ? Math.round((new Date(item.end_date) - new Date(item.start_date)) / 86400000) + 1
          : null,
        contour: item.contour_type || 'flat',
      };
      months.forEach(m => {
        const key = formatMonthKey(m);
        const val = monthlyVals[key] || 0;
        iRow[`m_${key}`] = val > 0 ? (mode === 'manpower' ? val / shiftHrs : val) : null;
      });
      addDataRow(iRow, false, false);
    });
  });

  // ── Grand totals row ──────────────────────────────────────────────
  const totalEst = items.reduce((s, i) => s + parseNum(i.total_est_cost), 0);
  const totalJtd = items.reduce((s, i) => s + parseNum(i.total_jtd_cost), 0);
  const grandEstQty  = items.reduce((s, i) => s + parseNum(i.quantity), 0);
  const grandEstHrs  = items.reduce((s, i) => s + parseNum(i.total_est_hours), 0);
  const grandJtdQty  = items.reduce((s, i) => s + parseNum(i.quantity_installed), 0);
  const grandJtdHrs  = items.reduce((s, i) => s + parseNum(i.total_jtd_hours), 0);
  const grandProjQty = grandEstQty;
  const grandProjHrs = ctGroups.reduce((s, g) => s + g.projHrs, 0);
  const grandProjCostField = ctGroups.reduce((s, g) => s + g.projCostField, 0);
  const grandProjCostVista = ctGroups.reduce((s, g) => s + g.projCostVista, 0);
  const grandRemQty  = Math.max(0, grandProjQty - grandJtdQty);
  const grandRemHrs  = Math.max(0, grandProjHrs - grandJtdHrs);
  const grandRemCost = Math.max(0, grandProjCostVista - totalJtd);

  const totRow = {
    rowNum: '', phase: 'TOTAL', ct: '',
    estQty: grandEstQty || null, uom: '', estHrs: grandEstHrs || null, estCost: totalEst || null,
    estPi: grandEstHrs > 0 ? grandEstQty / grandEstHrs : null,
    pctComp: totalEst > 0 ? (totalJtd / totalEst) : null,
    jtdQty: grandJtdQty || null, jtdHrs: grandJtdHrs || null, jtdCost: totalJtd || null,
    jtdPi: grandJtdHrs > 0 ? grandJtdQty / grandJtdHrs : null,
    projQty: grandProjQty || null, projHrs: grandProjHrs || null,
    projCostField: grandProjCostField || null, projCostVista: grandProjCostVista || null,
    projPi: grandProjHrs > 0 ? grandProjQty / grandProjHrs : null,
    remQty: grandRemQty || null, remHrs: grandRemHrs || null, remCost: grandRemCost || null,
    start: null, end: null, dur: null, contour: '',
  };
  months.forEach(m => {
    const key = formatMonthKey(m);
    let colTotal = 0;
    items.forEach(item => { colTotal += (allMonthly.get(item.id) || {})[key] || 0; });
    totRow[`m_${key}`] = colTotal > 0 ? (mode === 'manpower' ? colTotal / shiftHrs : colTotal) : null;
  });
  addDataRow(totRow, false, true);

  // ── Freeze header rows ────────────────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

  return wb.xlsx.writeBuffer();
}

module.exports = { generatePhaseScheduleExcelBuffer };
