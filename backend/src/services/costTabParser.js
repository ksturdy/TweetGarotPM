const XLSX = require('xlsx');

/**
 * Parser for the Tweet Garot "Master Cost Tabulation" template (.xlsm).
 *
 * Extracts project info and cost rows from the "Cost Tab" sheet, grouped
 * by Vista cost type:
 *   1 = Labor, 2 = Material, 3 = Subcontracts,
 *   4 = Rentals, 5 = MEP Equipment, 6 = General Conditions
 *
 * Cell map (header rows):
 *   C3   Prepared By (estimator(s))
 *   G3   Start Date
 *   K3   Completion Date
 *   B6   Job Name
 *   J6   Bid Date
 *   L6   Hub #
 *   L8   Project Sq Ft
 *
 * Row ranges on the "Cost Tab" sheet:
 *   Labor     rows 17–30 (label C, hours K, dollars L)
 *   Material  rows 35–44 (label C, phase B, dollars L; rows 43–44 in K)
 *   Equipment rows 48–52 (label C, phase B, dollars L)
 *   Rentals   rows 57–60 (label C, phase B, dollars K)
 *   Subs      rows 73–80 (label "Sub - " + D, phase B, dollars L)
 *   Travel    rows 67, 69 (Subsistence + Travel; dollars K)
 *   Totals    L31, L45, L53, K61, L81, L85–L88, L92, L95
 */

const COST_TYPE = {
  LABOR: 1,
  MATERIAL: 2,
  SUBCONTRACT: 3,
  RENTAL: 4,
  MEP_EQUIPMENT: 5,
  GENERAL_CONDITIONS: 6,
};

function getCell(sheet, addr) {
  const cell = sheet[addr];
  return cell ? cell.v : null;
}

function getCellByRC(sheet, row, col) {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
  return getCell(sheet, addr);
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toIsoDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Excel can hand back strings like "2026-02-05T06:00:00.000Z"
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Definition of every cost row we extract from the Cost Tab.
 * costType matches Vista's numbering.
 */
const ROW_DEFS = [
  // Labor (col K = hours, col L = dollars)
  { row: 17, label: 'Sheet Metal Field Labor',   costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 18, label: 'Sheet Metal Shop Labor',    costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 19, label: 'Pipefitter Field Labor',    costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 20, label: 'Pipefitter Shop Labor',     costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 21, label: 'Plumbing Field Labor',      costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 22, label: 'Plumbing Shop Labor',       costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 23, label: 'Service Labor',             costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 24, label: 'Other Labor',               costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 25, label: 'Management Labor',          costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 26, label: 'Safety Labor',              costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 27, label: 'Delivery Labor',            costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 28, label: 'Engineering Labor',         costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 29, label: 'VC Labor',                  costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },
  { row: 30, label: 'RTS',                       costType: COST_TYPE.LABOR,    hoursCol: 'K', costCol: 'L' },

  // Material (col L for items, col K for GC consumables/safety)
  { row: 35, label: 'Sheet Metal Material',      costType: COST_TYPE.MATERIAL, phaseCol: 'B', costCol: 'L' },
  { row: 37, label: 'Piping Material',           costType: COST_TYPE.MATERIAL, phaseCol: 'B', costCol: 'L' },
  { row: 39, label: 'Plumbing Material',         costType: COST_TYPE.MATERIAL, phaseCol: 'B', costCol: 'L' },
  { row: 41, label: 'Service Material',          costType: COST_TYPE.MATERIAL, phaseCol: 'B', costCol: 'L' },

  // General Conditions (phase 16-xxx)
  { row: 43, label: 'Gen. Cond. - Consumables',  costType: COST_TYPE.GENERAL_CONDITIONS, phaseCol: 'B', costCol: 'K' },
  { row: 44, label: 'Gen. Cond. - Safety',       costType: COST_TYPE.GENERAL_CONDITIONS, phaseCol: 'B', costCol: 'K' },

  // MEP Equipment
  { row: 48, label: 'MEP Equipment - Piping',                 costType: COST_TYPE.MEP_EQUIPMENT, phaseCol: 'B', costCol: 'L' },
  { row: 49, label: 'MEP Equipment - Exempt - Med Gas & Trade', costType: COST_TYPE.MEP_EQUIPMENT, phaseCol: 'B', costCol: 'L' },
  { row: 50, label: 'MEP Equipment - Plumbing Fixture',       costType: COST_TYPE.MEP_EQUIPMENT, phaseCol: 'B', costCol: 'L' },
  { row: 51, label: 'MEP Equipment - Plumbing',               costType: COST_TYPE.MEP_EQUIPMENT, phaseCol: 'B', costCol: 'L' },
  { row: 52, label: 'MEP Equipment - Sheetmetal',             costType: COST_TYPE.MEP_EQUIPMENT, phaseCol: 'B', costCol: 'L' },

  // Rentals (col K dollars)
  { row: 57, label: 'Rentals - 3rd Party',       costType: COST_TYPE.RENTAL, phaseCol: 'B', costCol: 'K' },
  { row: 58, label: 'Small Tools',               costType: COST_TYPE.RENTAL, phaseCol: 'B', costCol: 'K' },
  { row: 59, label: 'Large Tools',               costType: COST_TYPE.RENTAL, phaseCol: 'B', costCol: 'K' },
  { row: 60, label: 'Rentals - Truck Charges',   costType: COST_TYPE.RENTAL, phaseCol: 'B', costCol: 'K' },

  // Travel / Subsistence — bucket into General Conditions
  { row: 67, label: 'Subsistence',               costType: COST_TYPE.GENERAL_CONDITIONS, phaseCol: 'B', costCol: 'K' },
  { row: 69, label: 'Travel',                    costType: COST_TYPE.GENERAL_CONDITIONS, phaseCol: 'B', costCol: 'K' },

  // Subs — label is "Sub - " + the trade in col D
  { row: 73, label: 'Sub - Insulation',          costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
  { row: 74, label: 'Sub - Controls',            costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
  { row: 75, label: 'Sub - TG Controls',         costType: COST_TYPE.SUBCONTRACT,                  tradeCol: 'D', costCol: 'L' },
  { row: 76, label: 'Sub - Balancing',           costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
  { row: 77, label: 'Sub - Crane Service',       costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
  { row: 78, label: 'Sub - Demolition',          costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
  { row: 79, label: 'Sub - Firestopping',        costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
  { row: 80, label: 'Sub - Misc',                costType: COST_TYPE.SUBCONTRACT, phaseCol: 'B', tradeCol: 'D', costCol: 'L' },
];

const COST_TYPE_INFO = {
  [COST_TYPE.LABOR]:              { name: 'Labor',              order: 1 },
  [COST_TYPE.MATERIAL]:           { name: 'Material',           order: 2 },
  [COST_TYPE.SUBCONTRACT]:        { name: 'Subcontracts',       order: 3 },
  [COST_TYPE.RENTAL]:             { name: 'Rentals',            order: 4 },
  [COST_TYPE.MEP_EQUIPMENT]:      { name: 'MEP Equipment',      order: 5 },
  [COST_TYPE.GENERAL_CONDITIONS]: { name: 'General Conditions', order: 6 },
};

function parseCostTab(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  if (!workbook.SheetNames.includes('Cost Tab')) {
    throw new Error('Cost Tab sheet not found in workbook. This does not look like a Tweet Garot Master Cost Tabulation template.');
  }

  const sheet = workbook.Sheets['Cost Tab'];

  // ── Project info ─────────────────────────────────────────────
  const projectInfo = {
    projectName:    str(getCell(sheet, 'B6')),
    estimatorNames: str(getCell(sheet, 'C3')),
    bidDate:        toIsoDate(getCell(sheet, 'J6')),
    startDate:      toIsoDate(getCell(sheet, 'G3')),
    completionDate: toIsoDate(getCell(sheet, 'K3')),
    hubNumber:      str(getCell(sheet, 'L6')),
    squareFootage:  num(getCell(sheet, 'L8')),
    totalFixtures:  num(getCell(sheet, 'L11')),
  };

  // ── Cost rows ────────────────────────────────────────────────
  const groups = {};
  Object.keys(COST_TYPE_INFO).forEach((key) => {
    const ct = Number(key);
    groups[ct] = {
      costType: ct,
      name: COST_TYPE_INFO[ct].name,
      order: COST_TYPE_INFO[ct].order,
      items: [],
      totalCost: 0,
      totalHours: 0,
    };
  });

  for (const def of ROW_DEFS) {
    const phaseCode = def.phaseCol ? str(getCell(sheet, `${def.phaseCol}${def.row}`)) : '';
    const trade     = def.tradeCol ? str(getCell(sheet, `${def.tradeCol}${def.row}`)) : '';
    const hours     = def.hoursCol ? num(getCell(sheet, `${def.hoursCol}${def.row}`)) : 0;
    const cost      = num(getCell(sheet, `${def.costCol}${def.row}`));

    if (cost === 0 && hours === 0) continue;

    const description = trade ? `Sub - ${trade}` : def.label;

    groups[def.costType].items.push({
      sourceRow: def.row,
      phaseCode,
      description,
      hours,
      cost,
    });
    groups[def.costType].totalCost += cost;
    groups[def.costType].totalHours += hours;
  }

  // Filter out empty groups and sort by canonical order
  const sections = Object.values(groups)
    .filter((g) => g.items.length > 0)
    .sort((a, b) => a.order - b.order);

  // ── Summary totals (pulled from totals row, with sum fallback) ─
  const sumByCostType = (ct) => groups[ct]?.totalCost || 0;

  const laborTotal      = num(getCell(sheet, 'L31')) || sumByCostType(COST_TYPE.LABOR);
  const materialTotal   = num(getCell(sheet, 'L45')) || sumByCostType(COST_TYPE.MATERIAL);
  const equipmentTotal  = num(getCell(sheet, 'L53')) || sumByCostType(COST_TYPE.MEP_EQUIPMENT);
  const gcRentalTotal   = num(getCell(sheet, 'K61')); // rentals + small/large tools, no subsistence/travel
  const subTotal        = num(getCell(sheet, 'L81')) || sumByCostType(COST_TYPE.SUBCONTRACT);
  const projectTotal    = num(getCell(sheet, 'L88'));
  const markupAmount    = num(getCell(sheet, 'L89'));
  const markupPct       = num(getCell(sheet, 'D89'));
  const totalProjectCost = num(getCell(sheet, 'L92'));
  const bondPct         = num(getCell(sheet, 'I95'));
  const bondAmount      = num(getCell(sheet, 'L95'));
  const taxPct          = num(getCell(sheet, 'D65'));

  // Split gcRentalTotal between rentals + GC roughly using row sums
  const rentalsFromRows = sumByCostType(COST_TYPE.RENTAL);
  const gcFromRows      = sumByCostType(COST_TYPE.GENERAL_CONDITIONS);

  const summary = {
    laborCost:        laborTotal,
    materialCost:     materialTotal,
    equipmentCost:    equipmentTotal,
    rentalCost:       rentalsFromRows,
    generalConditions: gcFromRows,
    subcontractCost:  subTotal,
    subtotal:         projectTotal,
    markupPercentage: markupPct * 100, // L cell is decimal
    markupAmount,
    bondPercentage:   bondPct * 100,
    bondAmount,
    taxPercentage:    taxPct * 100,
    totalCost:        totalProjectCost,
    gcRentalCombined: gcRentalTotal, // diagnostic only
  };

  return {
    projectInfo,
    sections,
    summary,
  };
}

/**
 * Map parsed Cost Tab data to the estimate DB format
 * (estimate header + sections + line items).
 */
function mapToEstimate(parsed) {
  const estimate = {
    project_name: parsed.projectInfo.projectName || '',
    bid_date: parsed.projectInfo.bidDate || null,
    project_start_date: parsed.projectInfo.startDate || null,
    square_footage: parsed.projectInfo.squareFootage || null,
    estimator_name: parsed.projectInfo.estimatorNames || null,

    // Cost summary — these are advisory; the DB trigger (see migration 010)
    // recomputes labor/material/etc on the estimate from the sum of line items
    // after they're inserted, then derives subtotal/total_cost from the
    // markup percentages below.
    labor_cost: parsed.summary.laborCost,
    material_cost: parsed.summary.materialCost,
    equipment_cost: parsed.summary.equipmentCost,
    rental_cost: parsed.summary.rentalCost + parsed.summary.generalConditions,
    subcontractor_cost: parsed.summary.subcontractCost,
    subtotal: parsed.summary.subtotal,
    total_cost: parsed.summary.totalCost,

    // Markup carried from the Cost Tab (L89 = 8% markup, I95 = 0.8% bond).
    // The Excel marks up at the project-total level (no overhead/contingency
    // legs), so we map that whole markup onto profit_percentage.
    overhead_percentage: 0,
    profit_percentage: parsed.summary.markupPercentage || 0,
    contingency_percentage: 0,
    bond_percentage: parsed.summary.bondPercentage || 0,

    build_method: 'excel_import',
    notes: buildImportNote(parsed),
  };

  // One section per cost type, with one line item per source row
  const sections = parsed.sections.map((group, idx) => {
    const totalsByKind = {
      labor: 0,
      material: 0,
      equipment: 0,
      subcontractor: 0,
      rental: 0,
    };

    const kindForGroup = costTypeToItemKind(group.costType);

    const items = group.items.map((item, itemIdx) => {
      const lineItem = {
        item_order: itemIdx,
        item_type: costTypeToItemType(group.costType),
        description: item.description,
        specification: item.phaseCode || '',
        quantity: 1,
        unit: 'LS',
        labor_hours: 0,
        labor_rate: 0,
        labor_cost: 0,
        material_unit_cost: 0,
        material_cost: 0,
        equipment_unit_cost: 0,
        equipment_cost: 0,
        subcontractor_cost: 0,
        rental_cost: 0,
        rental_duration: 0,
        rental_rate: 0,
        total_cost: item.cost,
      };

      if (kindForGroup === 'labor') {
        lineItem.labor_hours = item.hours || 0;
        lineItem.labor_cost  = item.cost;
        if (item.hours > 0) lineItem.labor_rate = item.cost / item.hours;
        totalsByKind.labor += item.cost;
      } else if (kindForGroup === 'material') {
        lineItem.material_cost = item.cost;
        lineItem.material_unit_cost = item.cost;
        totalsByKind.material += item.cost;
      } else if (kindForGroup === 'equipment') {
        lineItem.equipment_cost = item.cost;
        lineItem.equipment_unit_cost = item.cost;
        totalsByKind.equipment += item.cost;
      } else if (kindForGroup === 'subcontractor') {
        lineItem.subcontractor_cost = item.cost;
        totalsByKind.subcontractor += item.cost;
      } else if (kindForGroup === 'rental') {
        lineItem.rental_cost = item.cost;
        lineItem.rental_rate = item.cost;
        lineItem.rental_duration = 1;
        totalsByKind.rental += item.cost;
      } else {
        // GC: bucket as rental_cost so it carries downstream without
        // creating new top-level cost buckets the schema doesn't have.
        lineItem.rental_cost = item.cost;
        totalsByKind.rental += item.cost;
      }

      return lineItem;
    });

    return {
      section_name: group.name,
      section_order: idx,
      description: `Imported from Master Cost Tabulation — cost type ${group.costType} (${group.name})`,
      labor_cost: totalsByKind.labor,
      material_cost: totalsByKind.material,
      equipment_cost: totalsByKind.equipment,
      subcontractor_cost: totalsByKind.subcontractor,
      rental_cost: totalsByKind.rental,
      total_cost: group.totalCost,
      items,
    };
  });

  return { estimate, sections };
}

function costTypeToItemType(costType) {
  // estimate_line_items.item_type is free-text in the DB; keep these strings
  // consistent with the rest of the codebase.
  switch (costType) {
    case COST_TYPE.LABOR: return 'labor';
    case COST_TYPE.MATERIAL: return 'material';
    case COST_TYPE.SUBCONTRACT: return 'subcontractor';
    case COST_TYPE.RENTAL: return 'rental';
    case COST_TYPE.MEP_EQUIPMENT: return 'equipment';
    case COST_TYPE.GENERAL_CONDITIONS: return 'other';
    default: return 'other';
  }
}

function costTypeToItemKind(costType) {
  switch (costType) {
    case COST_TYPE.LABOR: return 'labor';
    case COST_TYPE.MATERIAL: return 'material';
    case COST_TYPE.MEP_EQUIPMENT: return 'equipment';
    case COST_TYPE.SUBCONTRACT: return 'subcontractor';
    case COST_TYPE.RENTAL: return 'rental';
    case COST_TYPE.GENERAL_CONDITIONS: return 'gc';
    default: return 'gc';
  }
}

function buildImportNote(parsed) {
  const lines = ['Imported from Tweet Garot Master Cost Tabulation Excel.'];
  if (parsed.projectInfo.estimatorNames) lines.push(`Prepared by: ${parsed.projectInfo.estimatorNames}`);
  if (parsed.projectInfo.hubNumber) lines.push(`Hub #: ${parsed.projectInfo.hubNumber}`);
  if (parsed.projectInfo.squareFootage) lines.push(`Sq ft: ${parsed.projectInfo.squareFootage.toLocaleString()}`);
  return lines.join('\n');
}

module.exports = {
  parseCostTab,
  mapToEstimate,
  COST_TYPE,
};
