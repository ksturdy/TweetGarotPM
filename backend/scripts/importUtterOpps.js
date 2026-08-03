// One-time import: Greg Utter Hard Pursuits from "Utter Opps.xlsx"
// Status: Lead (stage_id=1), assigned to Gregory Utter (user_id=39)
require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Pre-resolved GC/CM → customer_id map (confirmed with user)
const GC_MAP = {
  'kiewit':            3963, // Kiewit Power Constructors Co
  'kiewit/ph':         3963, // Joint venture → map to Kiewit
  'mcdonnel':          5185, // The McDonnel Group LLC
  'patterson horth':   4546, // Patterson Horth-Inc
  'superior buildings': 5100, // Superior Building Systems
  'veritas':           5356, // Veritas Steel LLC
  // 'lexicon' and 'moore industries' inserted dynamically below
};

const LEAD_STAGE_ID      = 1;
const UTTER_USER_ID      = 39;   // users.id for Gregory Utter (used for created_by FK → users)
const UTTER_EMPLOYEE_ID  = 4809; // employees.id for Gregory Utter (used for assigned_to FK → employees)
const HEADER_ROW_IDX  = 145; // row 146 in spreadsheet = index 145 (0-based)
const DATA_START_IDX  = 146; // row 147 onwards
const DATE_COL_START  = 8;   // 0-based index of first date column (col 9)
const DATE_COL_END    = 35;  // 0-based index of last date column (col 36)

function excelDateToString(val) {
  // xlsx raw mode returns Excel serial numbers for date cells
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${d.y}-${m}-${day}`;
    }
  }
  if (typeof val === 'string' && val.includes('/')) {
    // Format: "11/1/2025"
    const [mo, dy, yr] = val.split('/');
    return `${yr}-${mo.padStart(2, '0')}-${dy.padStart(2, '0')}`;
  }
  return null;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Moore Industries and Lexicon as inactive prospects
    const newProspects = ['Moore Industries', 'Lexicon'];
    for (const name of newProspects) {
      const res = await client.query(
        `INSERT INTO customers (name, customer_owner, active_customer, market, tenant_id, customer_type)
         VALUES ($1, $1, false, 'Power', 1, 'prospect')
         RETURNING id`,
        [name]
      );
      const id = res.rows[0].id;
      GC_MAP[name.toLowerCase()] = id;
      console.log(`Added prospect: ${name} → customer id ${id}`);
    }

    // 2. Read spreadsheet
    const filePath = path.join(__dirname, '../../Utter Opps.xlsx');
    const wb = XLSX.readFile(filePath, { raw: true, cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    const headerRow = allRows[HEADER_ROW_IDX];

    // Build col-index → ISO date string map for revenue columns
    const dateColMap = {};
    for (let i = DATE_COL_START; i <= DATE_COL_END; i++) {
      const iso = excelDateToString(headerRow[i]);
      if (iso) dateColMap[i] = iso;
    }

    // 3. Filter to Utter rows
    const utterRows = allRows.slice(DATA_START_IDX).filter(
      row => row[3] && String(row[3]).includes('Utter')
    );
    console.log(`\nFound ${utterRows.length} Utter rows\n`);

    let inserted = 0;
    let skipped  = 0;

    for (const row of utterRows) {
      const gcCmRaw = String(row[0] || '').trim();
      const title   = String(row[1] || '').trim();
      const market  = String(row[2] || '').trim();
      const projRev = row[4];

      if (!title) continue;

      // Derive start / end from first and last month with revenue > 0
      let startDate = null;
      let endDate   = null;
      for (let i = DATE_COL_START; i <= DATE_COL_END; i++) {
        if (row[i] && Number(row[i]) !== 0 && dateColMap[i]) {
          if (!startDate) startDate = dateColMap[i];
          endDate = dateColMap[i];
        }
      }

      // Resolve customer id
      const gcKey       = gcCmRaw.toLowerCase();
      const gcCustomerId = GC_MAP[gcKey] ?? null;
      if (!gcCustomerId) {
        console.warn(`  !! No customer match for GC/CM: "${gcCmRaw}" — will import without gc_customer_id`);
      }

      // Duplicate check
      const dup = await client.query(
        'SELECT id FROM opportunities WHERE title ILIKE $1',
        [title]
      );
      if (dup.rows.length) {
        console.log(`  SKIP (duplicate): ${title}`);
        skipped++;
        continue;
      }

      // Resolve display name for general_contractor text field (what the list view renders)
      let gcDisplayName = gcCmRaw;
      if (gcCustomerId) {
        const gcRow = await client.query(
          `SELECT COALESCE(name, customer_facility, customer_owner) as nm FROM customers WHERE id = $1`,
          [gcCustomerId]
        );
        if (gcRow.rows[0]?.nm) gcDisplayName = gcRow.rows[0].nm;
      }

      await client.query(
        `INSERT INTO opportunities
           (title, client_company, general_contractor, gc_customer_id, market,
            estimated_value, estimated_start_date, estimated_end_date,
            stage_id, assigned_to, created_by, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)`,
        [
          title,
          gcCmRaw,
          gcDisplayName,
          gcCustomerId,
          market,
          projRev,
          startDate,
          endDate,
          LEAD_STAGE_ID,
          UTTER_EMPLOYEE_ID,
          UTTER_USER_ID,
        ]
      );
      inserted++;
      console.log(`  OK  [${gcCmRaw}] ${title} | $${Number(projRev).toLocaleString()} | ${startDate} → ${endDate}`);
    }

    await client.query('COMMIT');
    console.log(`\nCommitted. ${inserted} inserted, ${skipped} skipped.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ROLLBACK:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
