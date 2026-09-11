const ExcelJS = require('exceljs');

async function generateBacklogAnalysisExcel(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Titan PM';
  wb.created = new Date();

  // ──────────────────────────────────────────────────────────────
  // Sheet 1: Summary Metrics
  // ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Backlog Analysis');

  ws.columns = [
    { key: 'row',      width: 6  },
    { key: 'category', width: 14 },
    { key: 'metric',   width: 56 },
    { key: 'value',    width: 22 },
    { key: 'desc',     width: 55 },
  ];

  const navy   = '1a2b4a';
  const orange = 'f97316';
  const white  = 'FFFFFF';
  const calcBg = 'EFF6FF';
  const pipeBg = 'FFF7ED';
  const greyFg = '475569';

  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + navy } };
  const calcFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + calcBg } };
  const pipeFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + pipeBg } };

  const divLabel  = data.filters?.divisionFilter && data.filters.divisionFilter !== 'all'
    ? `Division: ${data.filters.divisionFilter}`
    : 'All Divisions';
  const teamLabel = data.teamName
    ? `Team: ${data.teamName}`
    : (data.teamFilter && data.teamFilter !== 'all' ? `Team: ${data.teamFilter}` : 'All Teams');
  const filterLabel = `${divLabel}  ·  ${teamLabel}`;

  // Title
  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Backlog Analysis Report';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF' + white } };
  titleCell.fill = headerFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:E2');
  const subCell = ws.getCell('A2');
  subCell.value = `FY ${data.currentFY} (Jan 1 – Dec 31)  ·  ${filterLabel}  ·  Generated: ${new Date().toLocaleDateString()}`;
  subCell.font = { size: 10, color: { argb: 'FF94A3B8' } };
  subCell.fill = headerFill;
  subCell.alignment = { horizontal: 'left' };

  ws.addRow([]);

  // Column headers
  const hdrRow = ws.addRow(['#', 'Category', 'Metric', 'Value', 'Description']);
  hdrRow.eachCell(cell => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF' + white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A7A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + orange } } };
  });
  hdrRow.getCell('value').alignment = { horizontal: 'right' };
  ws.getRow(4).height = 20;

  const fmt = (v) => v == null ? null : Math.round(v);

  const sections = [
    {
      title: 'BACKLOG BURN BY FISCAL YEAR',
      rows: [
        { num: 31, cat: 'Backlog',    label: `Remaining Backlog to Burn in the Current FY ($)`,     value: fmt(data.currentFYRevenue),    desc: `Remaining backlog that will burn in ${data.currentFY}.` },
        { num: 32, cat: 'Backlog',    label: 'Backlog to Burn in Future Fiscal Years ($)',           value: fmt(data.futureFYRevenue),     desc: `Backlog that will burn after Dec 31, ${data.currentFY}.` },
        { num: '',  cat: 'Calculated', label: 'Total Booked Backlog Revenue ($)',                    value: fmt(data.totalBacklogRevenue), desc: 'Sum of current FY + future FY backlog.' },
      ],
    },
    {
      title: 'GROSS MARGIN ON BACKLOG',
      rows: [
        { num: 33, cat: 'Backlog',    label: `Gross Margin on Backlog that will Burn in the Current FY ($)`,      value: fmt(data.currentFYGM),  desc: `Gross margin on backlog burning in ${data.currentFY}.` },
        { num: 34, cat: 'Backlog',    label: 'Gross Margin on Backlog that will Burn in Future Fiscal Years ($)', value: fmt(data.futureFYGM),   desc: 'Gross margin expected on backlog burning in future years.' },
        { num: '',  cat: 'Calculated', label: 'Total Booked Backlog Gross Margin ($)',                            value: fmt(data.totalBacklogGM), desc: 'Total GM across all booked backlog.' },
        { num: '',  cat: 'Calculated', label: 'Number of Months SG&A Covered by Gross Margin on Backlog',
          value: data.sgaMonthsCovered !== null ? parseFloat(data.sgaMonthsCovered.toFixed(1)) : null,
          desc: data.monthlySgAndA
            ? `Based on monthly SG&A of $${Math.round(data.monthlySgAndA).toLocaleString()}${data.totalBacklogRevenue > 0 ? ' (' + ((data.monthlySgAndA * 12) / data.totalBacklogRevenue * 100).toFixed(1) + '% of rev)' : ''}.`
            : 'Configure monthly SG&A in report settings.',
          isMonths: true,
        },
      ],
    },
    {
      title: 'PIPELINE BACKLOG',
      rows: [
        { num: 35, cat: 'Pipeline', label: 'Backlog Sold (Not Yet Contracted) ($)', value: fmt(data.backlogSoldNotContracted), desc: 'Awarded opportunities not yet entered in Vista.' },
        { num: 36, cat: 'Pipeline', label: 'High Potential Backlog ($)',            value: fmt(data.highPotentialBacklog),     desc: 'Opportunities with High probability of award.' },
      ],
    },
  ];

  let rowNum = 5;
  for (const section of sections) {
    const secRow = ws.addRow(['', '', section.title, '', '']);
    ws.mergeCells(`A${rowNum}:E${rowNum}`);
    secRow.getCell(1).value = section.title;
    secRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF' + white } };
    secRow.getCell(1).fill = headerFill;
    secRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(rowNum).height = 18;
    rowNum++;

    for (const r of section.rows) {
      const isCalc = r.cat === 'Calculated';
      const isPipe = r.cat === 'Pipeline';
      const dataRow = ws.addRow([r.num, r.cat, r.label, r.value, r.desc]);
      dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (isCalc) cell.fill = calcFill;
        if (isPipe) cell.fill = pipeFill;
        cell.font = { size: 9, bold: isCalc && colNum === 4 };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
        cell.alignment = { vertical: 'middle', wrapText: colNum === 3 || colNum === 5 };
      });
      const valCell = dataRow.getCell(4);
      valCell.alignment = { horizontal: 'right' };
      if (!r.isMonths && r.value !== null) valCell.numFmt = '$#,##0';
      if (r.isMonths && r.value !== null)  valCell.numFmt = '0.0';
      ws.getRow(rowNum).height = 18;
      rowNum++;
    }
    ws.addRow([]);
    rowNum++;
  }

  ws.addRow([]);
  rowNum++;

  const totalPipeline = (data.backlogSoldNotContracted || 0) + (data.highPotentialBacklog || 0);
  const blendedGmPct  = data.totalBacklogRevenue > 0
    ? ((data.totalBacklogGM / data.totalBacklogRevenue) * 100).toFixed(1) + '%'
    : '—';

  const summaryRows = [
    ['KEY METRICS SUMMARY', '', '', '', ''],
    ['', 'Total Booked Backlog',            '', fmt(data.totalBacklogRevenue), ''],
    ['', 'Total Backlog Gross Margin',      '', fmt(data.totalBacklogGM),      ''],
    ['', 'Blended Backlog GM %',            '', blendedGmPct,                  ''],
    ['', 'SG&A Months Covered',             '', data.sgaMonthsCovered != null ? parseFloat(data.sgaMonthsCovered.toFixed(1)) : null, ''],
    ['', 'Total Pipeline (Sold + Hi-Prob)', '', fmt(totalPipeline),            ''],
  ];

  for (const [i, sr] of summaryRows.entries()) {
    const r = ws.addRow(sr);
    if (i === 0) {
      ws.mergeCells(`A${rowNum}:E${rowNum}`);
      r.getCell(1).value = 'KEY METRICS SUMMARY';
      r.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF' + white } };
      r.getCell(1).fill = headerFill;
      r.getCell(1).alignment = { horizontal: 'left' };
    } else {
      r.getCell(2).font = { size: 9, color: { argb: 'FF' + greyFg } };
      const vc = r.getCell(4);
      vc.font = { bold: true, size: 9 };
      vc.alignment = { horizontal: 'right' };
      if (typeof sr[3] === 'number') vc.numFmt = i === 4 ? '0.0' : '$#,##0';
      r.eachCell({ includeEmpty: true }, c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      });
    }
    rowNum++;
  }

  ws.views = [{ state: 'frozen', ySplit: 4 }];

  // ──────────────────────────────────────────────────────────────
  // Sheet 2: Contract Detail
  // ──────────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Contract Detail');

  ws2.columns = [
    { key: 'contractNumber',   width: 16 },
    { key: 'description',      width: 36 },
    { key: 'customerName',     width: 28 },
    { key: 'pmName',           width: 24 },
    { key: 'pctComplete',      width: 10 },
    { key: 'totalBacklog',     width: 18 },
    { key: 'gmPct',            width: 10 },
    { key: 'currentFYRevenue', width: 18 },
    { key: 'currentFYGM',      width: 18 },
    { key: 'futureFYRevenue',  width: 18 },
    { key: 'futureFYGM',       width: 18 },
    { key: 'totalGM',          width: 18 },
  ];

  // Sheet 2 title
  ws2.mergeCells('A1:M1');
  const t2 = ws2.getCell('A1');
  t2.value = `Backlog Analysis – Contract Detail  ·  FY ${data.currentFY}  ·  ${filterLabel}`;
  t2.font  = { bold: true, size: 13, color: { argb: 'FF' + white } };
  t2.fill  = headerFill;
  t2.alignment = { vertical: 'middle', horizontal: 'left' };
  ws2.getRow(1).height = 28;

  ws2.addRow([]);

  const detailHdr = ws2.addRow([
    'Contract #', 'Description', 'Customer', 'PM',
    '% Complete', 'Total Backlog', 'GM %',
    'Curr FY Revenue', 'Curr FY GM', 'Future FY Revenue', 'Future FY GM', 'Total GM',
  ]);
  detailHdr.eachCell(cell => {
    cell.font = { bold: true, size: 9, color: { argb: 'FF' + white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A7A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + orange } } };
  });
  ws2.getRow(3).height = 22;

  const contracts = data.contractDetails || [];
  const altBg = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  contracts.forEach((c, idx) => {
    const r = ws2.addRow([
      c.contractNumber,
      c.description,
      c.customerName,
      c.pmName,
      (c.pctComplete ?? 0) / 100,
      c.totalBacklog,
      (c.gmPct ?? 0) / 100,
      c.currentFYRevenue,
      c.currentFYGM,
      c.futureFYRevenue,
      c.futureFYGM,
      c.totalGM,
    ]);

    r.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      if (idx % 2 === 1) cell.fill = altBg;
      cell.font = { size: 9 };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      cell.alignment = { vertical: 'middle', wrapText: colIdx === 2 };
    });

    // Right-align numeric columns (5 onward)
    for (const colIdx of [5, 6, 7, 8, 9, 10, 11, 12]) {
      r.getCell(colIdx).alignment = { horizontal: 'right', vertical: 'middle' };
    }

    // Number formats: col5=%, col6=$, col7=%, col8-12=$
    r.getCell(5).numFmt = '0%';
    r.getCell(6).numFmt = '$#,##0';
    r.getCell(7).numFmt = '0.0%';
    for (const colIdx of [8, 9, 10, 11, 12]) {
      r.getCell(colIdx).numFmt = '$#,##0';
    }

    ws2.getRow(3 + idx + 1).height = 16;
  });

  // Totals row
  if (contracts.length > 0) {
    const totRow = ws2.addRow([
      'TOTALS', '', '', '',
      '',
      contracts.reduce((s, c) => s + (c.totalBacklog || 0), 0),
      '',
      contracts.reduce((s, c) => s + (c.currentFYRevenue || 0), 0),
      contracts.reduce((s, c) => s + (c.currentFYGM || 0), 0),
      contracts.reduce((s, c) => s + (c.futureFYRevenue || 0), 0),
      contracts.reduce((s, c) => s + (c.futureFYGM || 0), 0),
      contracts.reduce((s, c) => s + (c.totalGM || 0), 0),
    ]);
    totRow.eachCell({ includeEmpty: true }, cell => {
      cell.font = { bold: true, size: 9, color: { argb: 'FF' + white } };
      cell.fill = headerFill;
      cell.alignment = { vertical: 'middle' };
    });
    for (const colIdx of [6, 8, 9, 10, 11, 12]) {
      totRow.getCell(colIdx).numFmt = '$#,##0';
      totRow.getCell(colIdx).alignment = { horizontal: 'right' };
    }
  }

  ws2.views = [{ state: 'frozen', ySplit: 3 }];

  // ──────────────────────────────────────────────────────────────
  // Sheet 3: Pipeline Detail
  // ──────────────────────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Pipeline Detail');

  ws3.columns = [
    { key: 'type',         width: 22 },
    { key: 'title',        width: 42 },
    { key: 'customerName', width: 30 },
    { key: 'assignedTo',   width: 24 },
    { key: 'stage',        width: 18 },
    { key: 'estValue',     width: 18 },
  ];

  ws3.mergeCells('A1:F1');
  const t3 = ws3.getCell('A1');
  t3.value = `Backlog Analysis – Pipeline Detail  ·  FY ${data.currentFY}  ·  ${filterLabel}`;
  t3.font  = { bold: true, size: 13, color: { argb: 'FF' + white } };
  t3.fill  = headerFill;
  t3.alignment = { vertical: 'middle', horizontal: 'left' };
  ws3.getRow(1).height = 28;

  ws3.addRow([]);

  function addPipelineSection(ws, sectionTitle, opps, sectionColor, showStage, startRow) {
    // Section header
    ws.mergeCells(`A${startRow}:F${startRow}`);
    const secHdr = ws.getRow(startRow);
    secHdr.getCell(1).value = `${sectionTitle}  (${opps.length} opportunities)`;
    secHdr.getCell(1).font  = { bold: true, size: 10, color: { argb: 'FF' + white } };
    secHdr.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + sectionColor } };
    secHdr.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(startRow).height = 20;
    startRow++;

    // Column headers
    const colHdr = ws.addRow(['Type', 'Opportunity', 'Customer', 'Assigned To', showStage ? 'Stage' : '', 'Est. Value']);
    colHdr.eachCell(cell => {
      cell.font = { bold: true, size: 9, color: { argb: 'FF' + white } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D4A7A' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + orange } } };
    });
    colHdr.getCell(6).alignment = { horizontal: 'right' };
    ws.getRow(startRow).height = 18;
    startRow++;

    let total = 0;
    opps.forEach((o, i) => {
      const r = ws.addRow([
        sectionTitle.includes('Awarded') ? 'Awarded – Not in Vista' : 'High Potential',
        o.title || '',
        o.customerName || '',
        o.assignedTo || '',
        showStage ? (o.stageName || '') : '',
        o.estValue || 0,
      ]);
      if (i % 2 === 1) {
        r.eachCell({ includeEmpty: true }, c => {
          c.fill = altBg;
        });
      }
      r.eachCell({ includeEmpty: true }, c => {
        c.font = { size: 9 };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
        c.alignment = { vertical: 'middle' };
      });
      r.getCell(6).numFmt = '$#,##0';
      r.getCell(6).alignment = { horizontal: 'right' };
      ws.getRow(startRow).height = 16;
      total += o.estValue || 0;
      startRow++;
    });

    // Totals row
    const totR = ws.addRow(['', 'TOTAL', '', '', '', total]);
    totR.eachCell({ includeEmpty: true }, c => {
      c.font = { bold: true, size: 9, color: { argb: 'FF' + white } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + sectionColor } };
      c.alignment = { vertical: 'middle' };
    });
    totR.getCell(6).numFmt = '$#,##0';
    totR.getCell(6).alignment = { horizontal: 'right' };
    startRow++;

    return startRow;
  }

  let pipeRow = 3;
  const awardedOpps = data.awardedNotInVistaOpps || [];
  const highProbOpps = data.highPotentialOpps || [];

  if (awardedOpps.length > 0) {
    pipeRow = addPipelineSection(ws3, 'Backlog Sold — Not Yet Contracted', awardedOpps, 'c2410c', false, pipeRow);
    ws3.addRow([]);
    pipeRow++;
  }

  if (highProbOpps.length > 0) {
    addPipelineSection(ws3, 'High Potential Backlog', highProbOpps, navy, true, pipeRow);
  }

  ws3.views = [{ state: 'frozen', ySplit: 3 }];

  return wb.xlsx.writeBuffer();
}

module.exports = { generateBacklogAnalysisExcel };
