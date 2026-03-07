/**
 * Extract productivity rates from the Piping Productivity Rates spreadsheet
 * and generate a SQL seed migration file.
 *
 * Usage: node backend/scripts/extractProductivityRates.js
 * Output: backend/src/migrations/127_seed_piping_productivity_rates.sql
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '../../Estimate Templates/Piping Productivty Rates.xlsx'));

// Excel date serial number → pipe diameter mapping
// Excel interprets fractions like "1/2" as dates (Jan 2), "3/4" as (Mar 4), etc.
const SERIAL_TO_DIA = {
  '46024': '1/2',
  '46026': '1/4',
  '46030': '1/8',
  '46085': '3/4',
  '46089': '3/8',
  '46150': '5/8',
  '46211': '7/8',
};

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// Standardize diameter format: "1 1/4" -> "1-1/4", add quote, handle date serials
function stdDia(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let s = String(raw).trim();
  // Check if it's a date serial number
  if (SERIAL_TO_DIA[s]) {
    return SERIAL_TO_DIA[s] + '"';
  }
  // Skip unknown large numbers (corrupted date serials)
  if (/^\d{4,}$/.test(s)) return null;
  // Replace spaces between numbers with hyphens: "1 1/4" -> "1-1/4"
  s = s.replace(/(\d)\s+(\d)/, '$1-$2');
  if (!s.endsWith('"')) s += '"';
  return s;
}

const rows = [];
const seen = new Set();

function addRow(fitting_type, pipe_diameter, hours_per_unit, unit = 'EA') {
  const key = `${fitting_type}|${pipe_diameter}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ fitting_type, pipe_diameter, hours_per_unit: +hours_per_unit.toFixed(4), unit });
}

// ==========================================
// 1. BW STD WT Standard Fittings
// ==========================================
const bwSheet = wb.Sheets['BW STD WT Standard Fittings'];
const bwData = XLSX.utils.sheet_to_json(bwSheet, { header: 1, defval: null });
// Row 0 headers: DIA. IN. | 45° ELBOW | 45° ELBOW 3R | 90° ELBOW 3R | 90° ELBOW LONG RADIUS |
//                90° ELBOW SHORT RADIUS | 180° BEND LONG RADIUS | CAP | CROSS | LATERAL | STUB END | TEE

const bwColMap = {
  1: '45_elbow',      // 45° ELBOW
  4: '90_elbow',      // 90° ELBOW LONG RADIUS
  7: 'cap',           // CAP
  11: 'tee',          // TEE
};

for (let i = 1; i < bwData.length; i++) {
  const row = bwData[i];
  if (!row || !row[0]) continue;
  const dia = stdDia(row[0]);
  if (!dia) continue;

  for (const [colIdx, fittingType] of Object.entries(bwColMap)) {
    const val = parseNum(row[Number(colIdx)]);
    if (val !== null && val > 0) {
      addRow(fittingType, dia, val);
    }
  }
}

// ==========================================
// 2. BW STD WT Elbow Reducing & Reducer
// ==========================================
const bwRedSheet = wb.Sheets['BW STD WT Elbow Reducing & Redu'];
const bwRedData = XLSX.utils.sheet_to_json(bwRedSheet, { header: 1, defval: null });
// Col 0: MAIN DIA, Col 1: REDUCING DIA, Col 3: REDUCER CONCENTRIC OR ECCENTRIC
// Take the first occurrence for each main diameter (smallest reducer)

for (let i = 1; i < bwRedData.length; i++) {
  const row = bwRedData[i];
  if (!row || !row[0]) continue;
  const mainDia = stdDia(row[0]);
  if (!mainDia) continue;
  const val = parseNum(row[3]); // REDUCER column
  if (val !== null && val > 0) {
    addRow('reducer', mainDia, val);
  }
}

// ==========================================
// 3. GRV STD WT Standard Fittings
// ==========================================
const grvSheet = wb.Sheets['GRV STD WT Standard Fittings'];
const grvData = XLSX.utils.sheet_to_json(grvSheet, { header: 1, defval: null });
const grvHeaders = grvData[0];

// Find column indices we care about
const grvTargets = {};
grvHeaders.forEach((h, idx) => {
  if (h === 'COUPLING FLEXIBLE') grvTargets[idx] = 'coupling';
  if (h === 'WYE TRUE') grvTargets[idx] = 'wye';
  if (h === 'FLANGE ADAPTER GROOVE X FLANGE [150 PSI]') grvTargets[idx] = 'flange';
  if (h === 'NIPPLE BARBED HOSE GROOVE X MALE') grvTargets[idx] = 'nipple';
});

for (let i = 1; i < grvData.length; i++) {
  const row = grvData[i];
  if (!row || !row[0]) continue;
  const dia = stdDia(row[0]);
  if (!dia) continue;

  for (const [colIdx, fittingType] of Object.entries(grvTargets)) {
    const val = parseNum(row[Number(colIdx)]);
    if (val !== null && val > 0) {
      addRow(fittingType, dia, val);
    }
  }
}

// ==========================================
// 4. CU STD WT Standard Fittings (for union)
// ==========================================
const cuSheet = wb.Sheets['CU STD WT Standard Fittings'];
const cuData = XLSX.utils.sheet_to_json(cuSheet, { header: 1, defval: null });
const cuHeaders = cuData[0];

const cuTargets = {};
cuHeaders.forEach((h, idx) => {
  if (h === 'UNION') cuTargets[idx] = 'union';
  if (h === 'COUPLING') cuTargets[idx] = 'coupling';
});

for (let i = 1; i < cuData.length; i++) {
  const row = cuData[i];
  if (!row) continue;
  const dia = stdDia(row[0]);
  if (!dia) continue;

  for (const [colIdx, fittingType] of Object.entries(cuTargets)) {
    const val = parseNum(row[Number(colIdx)]);
    if (val !== null && val > 0) {
      addRow(fittingType, dia, val);
    }
  }
}

// ==========================================
// 5. BW Pipe Carbon Steel (Extra Heavy 21 FT column)
// ==========================================
const bwPipeSheet = wb.Sheets['BW Pipe Carbon Steel'];
const bwPipeData = XLSX.utils.sheet_to_json(bwPipeSheet, { header: 1, defval: null });
// Col 3: EXTRA HEAVY 21 FT

for (let i = 1; i < bwPipeData.length; i++) {
  const row = bwPipeData[i];
  if (!row) continue;
  const dia = stdDia(row[0]);
  if (!dia) continue;

  const val = parseNum(row[3]); // EXTRA HEAVY 21 FT
  if (val !== null && val > 0) {
    addRow('pipe', dia, val, 'LF');
  }
}

// ==========================================
// 6. Derived rates for valve and bushing
// ==========================================
// Valves: ~1.2x the 90° elbow rate
rows.filter(r => r.fitting_type === '90_elbow').forEach(r => {
  addRow('valve', r.pipe_diameter, +(r.hours_per_unit * 1.2).toFixed(4));
});

// Bushings: same as coupling
rows.filter(r => r.fitting_type === 'coupling').forEach(r => {
  addRow('bushing', r.pipe_diameter, r.hours_per_unit);
});

// ==========================================
// Generate SQL
// ==========================================
let sql = `-- Migration: Seed piping productivity rates from Piping Productivity Rates spreadsheet
-- Auto-generated by backend/scripts/extractProductivityRates.js
-- Source: Estimate Templates/Piping Productivty Rates.xlsx

-- Clear existing data for tenant 1 (idempotent)
DELETE FROM piping_productivity_rates WHERE tenant_id = 1;

INSERT INTO piping_productivity_rates (tenant_id, fitting_type, pipe_diameter, hours_per_unit, unit) VALUES\n`;

const valueLines = rows.map(r => {
  return `(1, '${r.fitting_type}', '${r.pipe_diameter}', ${r.hours_per_unit}, '${r.unit}')`;
});

sql += valueLines.join(',\n') + ';\n';

const outPath = path.join(__dirname, '../src/migrations/127_seed_piping_productivity_rates.sql');
fs.writeFileSync(outPath, sql);

console.log(`Generated ${rows.length} productivity rate rows`);
console.log(`Output: ${outPath}`);

// Summary by fitting type
const summary = {};
rows.forEach(r => {
  if (!summary[r.fitting_type]) summary[r.fitting_type] = [];
  summary[r.fitting_type].push(r.pipe_diameter);
});
console.log('\nFitting types:');
Object.entries(summary).sort().forEach(([k, v]) => console.log(`  ${k}: ${v.length} sizes (${v.slice(0,5).join(', ')}...)`));
