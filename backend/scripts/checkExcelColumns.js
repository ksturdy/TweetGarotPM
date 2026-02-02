const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../../Estimate Templates/12 HVAC Budget Spreadsheet 05-20-25.xlsx');

console.log('Reading Excel file:', excelPath);
const workbook = XLSX.readFile(excelPath);

const sheetName = 'Data';
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Total rows:', data.length);

// Show first 10 rows
for (let i = 0; i < Math.min(15, data.length); i++) {
  const row = data[i];
  if (row && row.length > 0) {
    // Filter out empty cells and show first 10 values
    const nonEmpty = row.filter(cell => cell !== undefined && cell !== null && cell !== '');
    console.log(`\nRow ${i}:`, nonEmpty.slice(0, 15));
  } else {
    console.log(`\nRow ${i}: [empty]`);
  }
}
