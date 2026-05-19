// Inspect VP Data/Phase Codes.xlsx and confirm it matches the import format.
const path = require('path');
const XLSX = require('xlsx');

const filePath = path.join(__dirname, '..', '..', 'VP Data', 'Phase Codes.xlsx');
console.log(`Reading: ${filePath}\n`);

const wb = XLSX.readFile(filePath);
console.log('Sheet names:', wb.SheetNames);

const sheetName = 'Phase Codes';
if (!wb.SheetNames.includes(sheetName)) {
  console.error(`\n❌ Sheet "${sheetName}" not found. Aborting.`);
  process.exit(1);
}

const sheet = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

console.log(`Total rows in "${sheetName}": ${rows.length}`);
if (!rows.length) {
  console.log('No rows — nothing to do.');
  process.exit(0);
}

const cols = Object.keys(rows[0]);
console.log(`\nColumns (${cols.length}):`);
cols.forEach(c => console.log(`  - "${c}"`));

const expected = [
  'Contract', 'Job', 'Job Description', 'CostType', 'Phase', 'Phase Description',
  'Est Hours', 'Est Cost', 'JTD Hours', 'JTD Cost',
  'Committed Cost', 'Projected At Completion Cost', 'Percent Complete', 'Previous Week Cost'
];
const missing = expected.filter(e => !cols.some(c => c.trim() === e.trim()));
console.log(`\nExpected columns missing: ${missing.length ? missing.join(', ') : '(none — looks good)'}`);

console.log('\nFirst 3 sample rows:');
rows.slice(0, 3).forEach((r, i) => {
  console.log(`  [${i}]`, JSON.stringify(r, null, 2).split('\n').slice(0, 18).join('\n'));
});

const distinctJobs = new Set(rows.map(r => String(r.Job || '').trim()).filter(Boolean));
const distinctContracts = new Set(rows.map(r => String(r.Contract || '').trim()).filter(Boolean));
console.log(`\nDistinct jobs:      ${distinctJobs.size}`);
console.log(`Distinct contracts: ${distinctContracts.size}`);
console.log(`\nFirst 8 distinct contracts (to compare against vp_contracts.contract_number format):`);
Array.from(distinctContracts).slice(0, 8).forEach(c => console.log(`  "${c}"`));
