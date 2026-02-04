/**
 * One-time script to re-import work orders with corrected numeric parsing
 * Run from backend directory: node scripts/reimport-work-orders.js
 */

const XLSX = require('xlsx');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tweetgarot_pm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Helper function to convert Excel serial date to JS Date
const excelDateToJS = (excelDate) => {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
  return jsDate.toISOString().split('T')[0];
};

// Helper function to parse numbers, preserving 0 values
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

async function reimportWorkOrders() {
  const client = await pool.connect();

  try {
    console.log('Reading Excel file...');
    const workbook = XLSX.readFile('../VP Data/Titan Power Queries 2-3-26.xlsx');

    const workOrderSheetName = 'TGPBI_SMWorkOrderStatus';
    if (!workbook.SheetNames.includes(workOrderSheetName)) {
      throw new Error(`Sheet ${workOrderSheetName} not found`);
    }

    const worksheet = workbook.Sheets[workOrderSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${data.length} work orders to update`);

    // Get tenant ID from the actual work orders
    const tenantResult = await client.query('SELECT DISTINCT tenant_id FROM vp_work_orders LIMIT 1');
    const tenantId = tenantResult.rows[0]?.tenant_id || 1;
    console.log(`Using tenant ID: ${tenantId}`);

    let updated = 0;
    let errors = 0;

    // Sample some data to verify parsing (try with and without spaces in column names)
    console.log('\nSample data verification:');
    for (let i = 0; i < 5; i++) {
      const row = data[i];
      // Try both versions of column name
      const contractAmt = parseNumber(row['Contract Amt'] ?? row[' Contract Amt ']);
      const grossProfit = parseNumber(row['Gross Profit %']);
      console.log(`  WO ${row['Work Order']}: Contract Amt = ${contractAmt}, GP% = ${grossProfit}`);
    }

    console.log('\nUpdating work orders...');

    await client.query('BEGIN');

    for (const row of data) {
      const workOrderNumber = String(row['Work Order'] || '').trim();
      if (!workOrderNumber) continue;

      // Try column names with and without spaces (Excel quirk)
      const contractAmt = parseNumber(row['Contract Amt'] ?? row[' Contract Amt ']);
      const actualCost = parseNumber(row['Actual Cost']);
      const billedAmt = parseNumber(row['Billed Amt'] ?? row[' Billed Amt ']);
      const receivedAmt = parseNumber(row['Received Amt']);
      const backlog = parseNumber(row['Backlog']);
      const grossProfitPercent = parseNumber(row['Gross Profit %']);
      const pfHoursJtd = parseNumber(row['PF/SF/PF Hours JTD']);
      const smHoursJtd = parseNumber(row['SM Hours JTD']);
      const mepJtd = parseNumber(row['MEP JTD']);
      const materialJtd = parseNumber(row['Material JTD']);
      const subcontractsJtd = parseNumber(row['Subcontracts JTD']);
      const rentalsJtd = parseNumber(row['Rentals JTD']);

      try {
        const result = await client.query(`
          UPDATE vp_work_orders
          SET
            contract_amount = $1,
            actual_cost = $2,
            billed_amount = $3,
            received_amount = $4,
            backlog = $5,
            gross_profit_percent = $6,
            pf_hours_jtd = $7,
            sm_hours_jtd = $8,
            mep_jtd = $9,
            material_jtd = $10,
            subcontracts_jtd = $11,
            rentals_jtd = $12,
            updated_at = NOW()
          WHERE work_order_number = $13 AND tenant_id = $14
        `, [
          contractAmt,
          actualCost,
          billedAmt,
          receivedAmt,
          backlog,
          grossProfitPercent,
          pfHoursJtd,
          smHoursJtd,
          mepJtd,
          materialJtd,
          subcontractsJtd,
          rentalsJtd,
          workOrderNumber,
          tenantId
        ]);

        if (result.rowCount > 0) {
          updated++;
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`Error updating WO ${workOrderNumber}:`, err.message);
        }
      }

      if (updated % 10000 === 0 && updated > 0) {
        console.log(`  Updated ${updated} work orders...`);
      }
    }

    await client.query('COMMIT');

    console.log(`\nCompleted!`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Errors: ${errors}`);

    // Verify some updates
    console.log('\nVerification - checking some records in database:');
    const verifyResult = await client.query(`
      SELECT work_order_number, contract_amount, gross_profit_percent
      FROM vp_work_orders
      WHERE contract_amount IS NOT NULL AND contract_amount > 0
      LIMIT 5
    `);
    for (const row of verifyResult.rows) {
      console.log(`  WO ${row.work_order_number}: Contract = $${row.contract_amount}, GP% = ${row.gross_profit_percent}`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

reimportWorkOrders();
