const XLSX = require('xlsx');

/**
 * Parser for Tweet Garot Excel Bid Form (.xlsm)
 * Extracts data from Rate Inputs and Base Bid tabs
 *
 * Structure:
 * - Markups: V3=Labor(20%), X3=Material(20%), V4=Sub(20%), X4=TaxRate(8.6%), Z3=Margin
 * - General Labor: Rows 7-17 (header 7, data 8-17)
 * - Sheet Metal: Rows 19-69 (header 19, data 20-69)
 * - Piping: Rows 71-121 (header 71, data 72-121)
 * - Plumbing: Rows 123-173 (header 123, data 124-173)
 * - Rentals: Rows 175-185 (header 175, data 176-185)
 * - General Conditions: Rows 187-197 (header 187, data 188-197)
 * - Subcontracts: Rows 199-209 (header 199, data 200-209)
 * - Totals: Row 211
 *
 * Column mapping for trades:
 * - A=Line#, B=Description, E=Class, G=Phase
 * - H=Field Rate, I=Shop Rate, J=Qty, K=UOM
 * - M=Field Hours, N=Shop Hours, O=Total Hours
 * - P=Labor Cost, Q=Labor Markup, R=Labor Sell
 * - T=Material, V=Ext Material, W=Material Markup, X=Material Sell
 * - Z=Lump Sum (subs)
 */

/**
 * Parse an Excel bid form buffer and extract estimate data
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @returns {Object} Parsed estimate data
 */
function parseBidForm(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  const result = {
    projectInfo: {},
    rateInputs: {},
    sections: [],
    summary: {},
    markupPercentages: {},
    errors: [],
  };

  try {
    // Parse Rate Inputs tab
    if (workbook.SheetNames.includes('Rate Inputs')) {
      result.rateInputs = parseRateInputs(workbook.Sheets['Rate Inputs']);
    } else {
      result.errors.push('Rate Inputs sheet not found');
    }

    // Parse Base Bid tab
    if (workbook.SheetNames.includes('Base Bid')) {
      const baseBidData = parseBaseBid(workbook.Sheets['Base Bid']);
      result.projectInfo = baseBidData.projectInfo;
      result.sections = baseBidData.sections;
      result.summary = baseBidData.summary;
      result.markupPercentages = baseBidData.markupPercentages;
    } else {
      result.errors.push('Base Bid sheet not found');
    }

    // Parse Quoted Items if present
    if (workbook.SheetNames.includes('Quoted Items')) {
      result.quotedItems = parseQuotedItems(workbook.Sheets['Quoted Items']);
    }

  } catch (error) {
    result.errors.push(`Parse error: ${error.message}`);
  }

  return result;
}

/**
 * Parse the Rate Inputs sheet to extract labor rates
 */
function parseRateInputs(sheet) {
  const rates = {
    pipefitters: { straightTime: {}, overtime: {}, doubleTime: {}, nightShift: {} },
    plumbers: { straightTime: {}, overtime: {}, doubleTime: {}, nightShift: {} },
    sheetMetal: { straightTime: {}, overtime: {}, doubleTime: {}, nightShift: {} },
  };

  // Classification codes mapping
  const classificationCodes = ['SV', 'S', 'GF', 'F', 'J', '5A', '4A', '3A', '2A', '1A', 'PA'];

  // Helper to get cell value safely
  const getCellValue = (row, col) => {
    const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
    const cell = sheet[cellAddress];
    return cell ? cell.v : null;
  };

  // Parse Pipefitters rates (columns B-H, rows 7-17 for straight time)
  for (let row = 7; row <= 17; row++) {
    const code = getCellValue(row, 5);
    const rate = getCellValue(row, 7);
    if (code && classificationCodes.includes(code) && rate) {
      rates.pipefitters.straightTime[code] = parseFloat(rate) || 0;
    }
  }

  // Composite rates
  rates.pipefitters.straightTime.composite = getCellValue(19, 8) || 0;
  rates.pipefitters.overtime.composite = getCellValue(20, 8) || 0;
  rates.pipefitters.doubleTime.composite = getCellValue(21, 8) || 0;
  rates.pipefitters.nightShift.composite = getCellValue(22, 8) || 0;

  return rates;
}

/**
 * Parse the Base Bid sheet to extract project info, line items, and summary
 */
function parseBaseBid(sheet) {
  const result = {
    projectInfo: {},
    sections: [],
    summary: {
      totalLaborHours: 0,
      totalLaborCost: 0,
      totalMaterialCost: 0,
      totalEquipmentCost: 0,
      totalSubcontractCost: 0,
      totalRentalCost: 0,
      subtotal: 0,
      totalMarkup: 0,
      totalSell: 0,
    },
    markupPercentages: {},
  };

  // Helper to get cell value by letter address
  const getCell = (addr) => {
    const cell = sheet[addr];
    return cell ? cell.v : null;
  };

  // Helper to get cell value by row/col numbers (1-indexed)
  const getCellValue = (row, col) => {
    const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
    const cell = sheet[cellAddress];
    return cell ? cell.v : null;
  };

  // Parse project info (rows 3-4)
  result.projectInfo = {
    projectName: getCell('C3'),
    bidDate: getCell('J3'),
    bidTime: getCell('J4'),
    date: getCell('C4'),
  };

  // Parse markup percentages (V3, X3, V4, X4, Z3)
  result.markupPercentages = {
    labor: parseFloat(getCell('V3')) || 0.2,        // 20% default
    material: parseFloat(getCell('X3')) || 0.2,     // 20% default
    subcontractor: parseFloat(getCell('V4')) || 0.2, // 20% default
    taxRate: parseFloat(getCell('X4')) || 0.086,    // 8.6% default
    margin: parseFloat(getCell('Z3')) || 0.1667,    // ~16.67% default
  };

  // Section definitions with CORRECT row ranges based on actual file
  const sectionDefs = [
    { name: 'General Labor', headerRow: 7, startRow: 8, endRow: 17, type: 'labor' },
    { name: 'Sheet Metal', headerRow: 19, startRow: 20, endRow: 69, type: 'trade' },
    { name: 'Piping', headerRow: 71, startRow: 72, endRow: 121, type: 'trade' },
    { name: 'Plumbing', headerRow: 123, startRow: 124, endRow: 173, type: 'trade' },
    { name: 'Rentals', headerRow: 175, startRow: 176, endRow: 185, type: 'rental' },
    { name: 'General Conditions', headerRow: 187, startRow: 188, endRow: 197, type: 'conditions' },
    { name: 'Subcontracts', headerRow: 199, startRow: 200, endRow: 209, type: 'subcontract' },
  ];

  // Parse each section
  for (const sectionDef of sectionDefs) {
    const section = parseSection(sheet, sectionDef, getCellValue, getCell);
    if (section.lineItems.length > 0) {
      result.sections.push(section);

      // Accumulate summary totals
      result.summary.totalLaborHours += section.totals.totalHours || 0;
      result.summary.totalLaborCost += section.totals.laborCost || 0;
      result.summary.totalMaterialCost += section.totals.materialCost || 0;
      result.summary.totalSubcontractCost += section.totals.subcontractCost || 0;
      result.summary.totalRentalCost += section.totals.rentalCost || 0;
      result.summary.totalMarkup += section.totals.markup || 0;
      result.summary.totalSell += section.totals.sell || 0;
    }
  }

  // Read totals from row 211 (the actual totals row)
  const totalsRow = 211;
  result.summary.totalLaborHours = parseFloat(getCell('O211')) || result.summary.totalLaborHours;
  result.summary.totalLaborCost = parseFloat(getCell('P211')) || result.summary.totalLaborCost;
  result.summary.totalMaterialCost = parseFloat(getCell('V211')) || result.summary.totalMaterialCost;

  // Labor sell + Material sell + Lump Sum (subcontracts) from totals
  const laborSell = parseFloat(getCell('R211')) || 0;
  const materialSell = parseFloat(getCell('X211')) || 0;
  const lumpSumTotal = parseFloat(getCell('Z211')) || 0; // Subcontract lump sums
  const contingency = parseFloat(getCell('AA211')) || 0; // Contingency

  // Gross margin and total sell price from bid form
  const grossMarginDollars = parseFloat(getCell('AF211')) || 0; // Gross Margin $
  const totalCellPrice = parseFloat(getCell('AH211')) || 0; // Total Cell Price

  // Total sell includes labor, material, lump sums, and contingency
  result.summary.totalSell = laborSell + materialSell + lumpSumTotal + contingency;
  result.summary.totalMarkup = (parseFloat(getCell('Q211')) || 0) + (parseFloat(getCell('W211')) || 0);

  // Set subcontract cost from Z211 if not already accumulated
  if (lumpSumTotal > result.summary.totalSubcontractCost) {
    result.summary.totalSubcontractCost = lumpSumTotal;
  }

  // Store contingency separately
  result.summary.contingency = contingency;

  // Store gross margin info from Excel
  result.summary.grossMarginDollars = grossMarginDollars;
  result.summary.totalCellPrice = totalCellPrice;

  // Calculate gross margin percentage from Excel values
  // GM% = Gross Margin $ / Total Cell Price
  if (totalCellPrice > 0) {
    result.summary.grossMarginPercentage = (grossMarginDollars / totalCellPrice) * 100;
  } else {
    result.summary.grossMarginPercentage = 0;
  }

  // Calculate subtotal (before contingency)
  result.summary.subtotal = result.summary.totalLaborCost +
    result.summary.totalMaterialCost +
    result.summary.totalEquipmentCost +
    result.summary.totalSubcontractCost +
    result.summary.totalRentalCost;

  return result;
}

/**
 * Parse a section of the Base Bid sheet
 * Column mapping:
 * - A=Line#, B=Description (or D for some sections)
 * - E=Classification, G=Phase
 * - H=Field Rate, I=Shop Rate
 * - J=Qty, K=UOM
 * - M=Field Hours, N=Shop Hours, O=Total Hours
 * - P=Labor Cost, Q=Labor Markup, R=Labor Sell
 * - T=Material base, V=Extended Material, W=Material Markup, X=Material Sell
 * - Z=Lump Sum (for subs)
 */
function parseSection(sheet, sectionDef, getCellValue, getCell) {
  const section = {
    name: sectionDef.name,
    type: sectionDef.type,
    lineItems: [],
    totals: {
      totalHours: 0,
      laborCost: 0,
      laborSell: 0,
      materialCost: 0,
      materialSell: 0,
      subcontractCost: 0,
      rentalCost: 0,
      markup: 0,
      sell: 0,
    },
  };

  // Column letter to number mapping
  const col = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 10,
    K: 11, L: 12, M: 13, N: 14, O: 15, P: 16, Q: 17, R: 18, S: 19, T: 20,
    U: 21, V: 22, W: 23, X: 24, Y: 25, Z: 26
  };

  for (let row = sectionDef.startRow; row <= sectionDef.endRow; row++) {
    // Description is in column B or D depending on section
    let description = getCellValue(row, col.B);
    if (!description) description = getCellValue(row, col.D);

    // Skip rows without any meaningful data
    const laborCost = parseFloat(getCellValue(row, col.P)) || 0;
    const laborSell = parseFloat(getCellValue(row, col.R)) || 0;
    const materialCost = parseFloat(getCellValue(row, col.V)) || 0;
    const materialSell = parseFloat(getCellValue(row, col.X)) || 0;
    const lumpSum = parseFloat(getCellValue(row, col.Z)) || 0;
    const hours = parseFloat(getCellValue(row, col.O)) || 0;

    // Skip empty rows (no description and no cost)
    if (!description && laborCost === 0 && materialCost === 0 && lumpSum === 0) continue;

    const lineItem = {
      rowNumber: row,
      description: description ? String(description).trim() : `Line ${row - sectionDef.startRow + 1}`,
      phaseCode: getCellValue(row, col.G), // Column G - Phase code
    };

    if (sectionDef.type === 'labor') {
      // General Labor format: Rate in J, Hours in N or O, Cost in P, Markup in Q, Sell in R
      lineItem.rate = parseFloat(getCellValue(row, col.J)) || 0;
      lineItem.hours = hours;
      lineItem.cost = laborCost;
      lineItem.markup = parseFloat(getCellValue(row, col.Q)) || 0;
      lineItem.sell = laborSell;
    } else if (sectionDef.type === 'trade') {
      // Trade sections (Sheet Metal, Piping, Plumbing)
      lineItem.classificationCode = getCellValue(row, col.E);
      lineItem.fieldRate = parseFloat(getCellValue(row, col.H)) || 0;
      lineItem.shopRate = parseFloat(getCellValue(row, col.I)) || 0;
      lineItem.quantity = parseFloat(getCellValue(row, col.J)) || 0;
      lineItem.unit = getCellValue(row, col.K);
      lineItem.fieldHours = parseFloat(getCellValue(row, col.M)) || 0;
      lineItem.shopHours = parseFloat(getCellValue(row, col.N)) || 0;
      lineItem.hours = hours;

      // Labor columns
      lineItem.laborCost = laborCost;
      lineItem.laborMarkup = parseFloat(getCellValue(row, col.Q)) || 0;
      lineItem.laborSell = laborSell;

      // Material columns (T=base, V=extended, W=markup, X=sell)
      lineItem.materialBase = parseFloat(getCellValue(row, col.T)) || 0;
      lineItem.materialCost = materialCost; // Extended (includes tax)
      lineItem.materialMarkup = parseFloat(getCellValue(row, col.W)) || 0;
      lineItem.materialSell = materialSell;

      // Subcontract lump sum (Z column) - can appear in trade sections too
      lineItem.lumpSum = lumpSum;
      lineItem.subcontractCost = lumpSum;

      // Combined (include lump sum subcontract if present)
      lineItem.cost = laborCost + materialCost + lumpSum;
      lineItem.sell = laborSell + materialSell + lumpSum;
    } else if (sectionDef.type === 'rental' || sectionDef.type === 'conditions') {
      // Rentals/Conditions: V=Ext cost, W=Markup, X=Sell
      lineItem.quantity = parseFloat(getCellValue(row, col.J)) || 0;
      lineItem.cost = materialCost; // Use V column for cost
      lineItem.markup = parseFloat(getCellValue(row, col.W)) || 0;
      lineItem.sell = materialSell;
    } else if (sectionDef.type === 'subcontract') {
      // Subcontracts: Z=Lump Sum, or V/W/X for extended
      lineItem.cost = lumpSum > 0 ? lumpSum : materialCost;
      lineItem.markup = parseFloat(getCellValue(row, col.W)) || 0;
      lineItem.sell = materialSell > 0 ? materialSell : lumpSum;
    }

    // Only add if there's actual data
    if (lineItem.cost > 0 || lineItem.hours > 0 || lineItem.sell > 0) {
      section.lineItems.push(lineItem);

      // Accumulate section totals
      section.totals.totalHours += lineItem.hours || 0;

      if (sectionDef.type === 'trade') {
        section.totals.laborCost += lineItem.laborCost || 0;
        section.totals.laborSell += lineItem.laborSell || 0;
        section.totals.materialCost += lineItem.materialCost || 0;
        section.totals.materialSell += lineItem.materialSell || 0;
        section.totals.subcontractCost += lineItem.lumpSum || 0; // Track lump sums in trades
        section.totals.sell += lineItem.sell || 0;
      } else {
        section.totals.laborCost += lineItem.cost || 0;
        section.totals.sell += lineItem.sell || 0;
      }

      if (sectionDef.type === 'subcontract') {
        section.totals.subcontractCost += lineItem.cost || 0;
      }
      if (sectionDef.type === 'rental') {
        section.totals.rentalCost += lineItem.cost || 0;
      }
    }
  }

  return section;
}

/**
 * Parse the Quoted Items sheet
 */
function parseQuotedItems(sheet) {
  const quotedItems = {
    piping: [],
    sheetMetal: [],
    plumbing: [],
    insulation: [],
    controls: [],
    testBalance: [],
  };

  const getCellValue = (row, col) => {
    const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });
    const cell = sheet[cellAddress];
    return cell ? cell.v : null;
  };

  const sections = [
    { key: 'piping', startRow: 5, endRow: 9, vendors: ['Hydroflow', 'FHI', 'H&P', 'Ferguson', 'Columbia', 'Other'] },
    { key: 'sheetMetal', startRow: 14, endRow: 18, vendors: ['Masters', 'Trane', 'TSI', 'Access', 'Other', 'Other'] },
    { key: 'plumbing', startRow: 23, endRow: 27, vendors: ['Ferguson', 'First Supply', 'Midstate', 'Able', '', ''] },
    { key: 'insulation', startRow: 32, endRow: 34, vendors: ['Hurckman', 'Thermotech', 'Quality', 'Other', 'Other', 'Other'] },
    { key: 'controls', startRow: 39, endRow: 41, vendors: ['JCI', 'BATI', 'EC&D', 'ALC', 'Other', 'Other'] },
    { key: 'testBalance', startRow: 46, endRow: 48, vendors: ['Badger', 'Balco', 'Other', 'Other', 'Other', 'Other'] },
  ];

  for (const section of sections) {
    for (let row = section.startRow; row <= section.endRow; row++) {
      const description = getCellValue(row, 2);
      if (!description) continue;

      const item = {
        itemNumber: getCellValue(row, 1),
        description: description,
        quantity: getCellValue(row, 5),
        unit: getCellValue(row, 6),
        quotes: {},
      };

      for (let i = 0; i < section.vendors.length; i++) {
        const vendorName = section.vendors[i];
        if (vendorName) {
          const quote = getCellValue(row, 8 + i);
          if (quote && quote !== 0) {
            item.quotes[vendorName] = parseFloat(quote) || 0;
          }
        }
      }

      if (Object.keys(item.quotes).length > 0 || item.description) {
        quotedItems[section.key].push(item);
      }
    }
  }

  return quotedItems;
}

/**
 * Map parsed bid form data to estimate database format
 * @param {Object} parsedData - Output from parseBidForm()
 * @param {Object} additionalMarkups - Optional additional markups { overhead_percentage, profit_percentage }
 * @returns {Object} Data ready for estimate creation/update
 */
function mapToEstimateFormat(parsedData, additionalMarkups = {}) {
  // Get gross margin info from Excel
  let grossMarginDollars = parsedData.summary.grossMarginDollars || 0;
  const totalCellPrice = parsedData.summary.totalCellPrice || 0;
  let grossMarginPercentage = parsedData.summary.grossMarginPercentage || 0;

  // If additional overhead/profit markups are provided, add them to the gross margin
  const additionalOverhead = additionalMarkups.overhead_percentage || 0;
  const additionalProfit = additionalMarkups.profit_percentage || 0;

  if (additionalOverhead > 0 || additionalProfit > 0) {
    // Calculate additional markup amounts based on subtotal
    const subtotal = parsedData.summary.subtotal || 0;
    const additionalOverheadAmount = subtotal * (additionalOverhead / 100);
    const additionalProfitAmount = (subtotal + additionalOverheadAmount) * (additionalProfit / 100);

    // Add to gross margin dollars
    grossMarginDollars += additionalOverheadAmount + additionalProfitAmount;

    // Recalculate gross margin percentage with new total
    const newTotalSell = totalCellPrice + additionalOverheadAmount + additionalProfitAmount;
    if (newTotalSell > 0) {
      grossMarginPercentage = (grossMarginDollars / newTotalSell) * 100;
    }
  }

  const estimate = {
    project_name: parsedData.projectInfo.projectName || '',
    bid_date: parsedData.projectInfo.bidDate || null,

    // Summary costs - use the actual totals
    labor_cost: parsedData.summary.totalLaborCost || 0,
    material_cost: parsedData.summary.totalMaterialCost || 0,
    equipment_cost: parsedData.summary.totalEquipmentCost || 0,
    subcontractor_cost: parsedData.summary.totalSubcontractCost || 0,
    rental_cost: parsedData.summary.totalRentalCost || 0,
    subtotal: parsedData.summary.subtotal || 0,
    total_cost: parsedData.summary.totalSell || 0,

    // For Excel imports, markups are already applied in the Sell prices
    // Set percentages to 0 to prevent database trigger from re-applying them
    overhead_percentage: additionalOverhead,
    profit_percentage: additionalProfit,
    contingency_percentage: 0,
    bond_percentage: 0,

    // Gross margin from Excel (AF211 / AH211)
    gross_margin_dollars: grossMarginDollars,
    gross_margin_percentage: grossMarginPercentage,

    // Store full rate inputs as JSON
    rate_inputs: parsedData.rateInputs,

    // Build method
    build_method: 'excel_import',
  };

  // Map sections to estimate_sections format
  const sections = parsedData.sections.map((section, index) => ({
    section_name: section.name,
    section_order: index,
    description: `Imported from Excel bid form - ${section.type}`,
    labor_cost: section.totals.laborCost || 0,
    material_cost: section.totals.materialCost || 0,
    equipment_cost: 0,
    subcontractor_cost: section.totals.subcontractCost || 0,
    rental_cost: section.totals.rentalCost || 0,
    total_cost: section.totals.sell || 0,
    line_items: section.lineItems.map((item, itemIndex) => ({
      item_order: itemIndex,
      item_type: mapItemType(section.type),
      description: item.description,
      specification: item.phaseCode || '',
      quantity: item.quantity || 1,
      unit: item.unit || 'EA',
      labor_hours: item.hours || 0,
      labor_rate: item.fieldRate || item.rate || 0,
      // For Excel imports, use SELL values (with markup already applied)
      // since percentages are set to 0 in the estimate
      labor_cost: item.laborSell || item.sell || item.cost || 0,
      material_cost: item.materialSell || 0,
      subcontractor_cost: (section.type === 'subcontract' ? item.sell : item.lumpSum) || 0,
      rental_cost: section.type === 'rental' ? (item.sell || item.cost) : 0,
      total_cost: item.sell || item.cost || 0,
    })),
  }));

  return { estimate, sections };
}

/**
 * Map section type to line item type
 */
function mapItemType(sectionType) {
  const typeMap = {
    labor: 'labor',
    trade: 'labor',
    rental: 'rental',
    conditions: 'other',
    subcontract: 'subcontractor',
  };
  return typeMap[sectionType] || 'other';
}

/**
 * Get list of sheet names from a workbook
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @returns {string[]} Array of sheet names
 */
function getSheetNames(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  return workbook.SheetNames;
}

module.exports = {
  parseBidForm,
  mapToEstimateFormat,
  getSheetNames,
};
