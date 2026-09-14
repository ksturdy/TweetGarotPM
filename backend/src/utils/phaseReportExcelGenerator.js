const ExcelJS = require('exceljs');

async function generatePhaseReportExcel(rows, filters = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Titan PM';
  wb.created = new Date();

  const ws = wb.addWorksheet('Phase Report');

  const navy  = '1a2b4a';
  const orange = 'F37B03';
  const white  = 'FFFFFF';
  const altBg = 'F8FAFC';

  ws.columns = [
    { key: 'job_number',      header: 'Job #',        width: 16 },
    { key: 'phase_code',      header: 'Phase Code',   width: 14 },
    { key: 'phase_name',      header: 'Phase Name',   width: 30 },
    { key: 'job_name',        header: 'Job Name',     width: 36 },
    { key: 'department_code', header: 'Department',   width: 13 },
    { key: 'status',          header: 'Status',       width: 12 },
    { key: 'bill_method',     header: 'Bill Method',  width: 14 },
    { key: 'manager_name',    header: 'PM',           width: 18 },
    { key: 'est_hours',       header: 'Est Hours',    width: 13 },
    { key: 'jtd_hours',       header: 'JTD Hours',    width: 13 },
    { key: 'burn_pct',        header: 'Burn %',       width: 11 },
  ];

  // Title row
  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Phase Report — Tweet Garot Mechanical';
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF' + white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + navy } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 28;

  // Filter / date row
  const filterParts = [];
  if (filters.department) filterParts.push(`Dept: ${filters.department}`);
  if (filters.status) filterParts.push(`Status: ${filters.status}`);
  if (filters.bill_method) filterParts.push(`Bill Method: ${filters.bill_method}`);
  if (filters.teamName) filterParts.push(`Team: ${filters.teamName}`);
  if (filters.phases && filters.phases.length > 0) filterParts.push(`Phase: ${filters.phases.join(', ')}`);
  const filterLabel = filterParts.length > 0 ? filterParts.join('  ·  ') : 'All Jobs';

  const distinctJobs = new Set(rows.map(r => r.job_number)).size;
  ws.mergeCells('A2:K2');
  const subCell = ws.getCell('A2');
  subCell.value = `${filterLabel}  ·  Generated: ${new Date().toLocaleDateString()}  ·  ${distinctJobs} job(s) · ${rows.length} phase(s)`;
  subCell.font = { size: 9, color: { argb: 'FF94A3B8' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + navy } };
  ws.getRow(2).height = 16;

  ws.addRow([]);

  // Header row
  const hdrRow = ws.addRow(['Job #', 'Phase Code', 'Phase Name', 'Job Name', 'Department', 'Status', 'Bill Method', 'PM', 'Est Hours', 'JTD Hours', 'Burn %']);
  hdrRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF' + white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + orange } };
    cell.alignment = { vertical: 'middle', horizontal: colNum >= 9 ? 'right' : 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
  });
  ws.getRow(4).height = 22;

  let totalEst = 0;
  let totalJtd = 0;

  rows.forEach((r, i) => {
    const est = Number(r.est_hours) || 0;
    const jtd = Number(r.jtd_hours) || 0;
    const burnPct = est > 0 ? jtd / est : null;
    totalEst += est;
    totalJtd += jtd;

    const dataRow = ws.addRow([
      r.job_number || '',
      r.phase_code || '',
      r.phase_name || '',
      r.job_name || '',
      r.department_code || '',
      r.status || '',
      r.bill_method || '',
      r.manager_name || '',
      est || null,
      jtd || null,
      burnPct,
    ]);

    const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FF' + altBg;
    dataRow.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.font = { size: 10 };
      if (colNum >= 9) {
        cell.alignment = { horizontal: 'right' };
        if (colNum === 9 || colNum === 10) {
          cell.numFmt = '#,##0.0';
        }
        if (colNum === 11 && burnPct !== null) {
          cell.numFmt = '0.0%';
          if (burnPct > 1.1) cell.font = { size: 10, color: { argb: 'FFDC2626' } };
          else if (burnPct > 0.9) cell.font = { size: 10, color: { argb: 'FFD97706' } };
          else cell.font = { size: 10, color: { argb: 'FF16A34A' } };
        }
      }
    });
  });

  // Totals row
  const totalBurnPct = totalEst > 0 ? totalJtd / totalEst : null;
  const totRow = ws.addRow(['TOTAL', '', '', '', '', '', '', '', totalEst || null, totalJtd || null, totalBurnPct]);
  totRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF' + white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + navy } };
    if (colNum >= 9) {
      cell.alignment = { horizontal: 'right' };
      if (colNum === 9 || colNum === 10) cell.numFmt = '#,##0.0';
      if (colNum === 11) cell.numFmt = '0.0%';
    }
  });

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  return wb.xlsx.writeBuffer();
}

module.exports = { generatePhaseReportExcel };
