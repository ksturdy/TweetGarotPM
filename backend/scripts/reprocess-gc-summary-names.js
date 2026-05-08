// One-shot cleanup: re-derive summary-row names from the stored raw.line
// using the current parser logic. Earlier parser versions stripped a
// leading number ("500") from summary rows, garbling the WBS-code prefix.
// Run this once after migrating; idempotent — running twice is fine.

require('dotenv').config();
const db = require('../src/config/database');

async function main() {
  const r = await db.query(
    `SELECT id, activity_name, raw
     FROM gc_schedule_activities
     WHERE is_summary = TRUE AND raw IS NOT NULL`
  );
  console.log(`Reprocessing ${r.rows.length} summary rows...`);
  let fixed = 0;

  for (const row of r.rows) {
    const line = row.raw && row.raw.line;
    if (!line) continue;

    // Replicate the (corrected) summary-name extraction from parsePDF.
    const dup = String(line).match(/^\s*([^\t]{2,200}?)\s*\t\s*\1\s*(?:\t|$)/);
    let name;
    if (dup) {
      name = dup[1].trim();
    } else {
      // Fallback: strip dates, A/* flags, trailing numbers, but DO NOT
      // strip the leading WBS-code number for summaries.
      const dateRe = /\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)-\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi;
      let n = String(line).normalize('NFKC').replace(dateRe, '').replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      let prev;
      do {
        prev = n;
        n = n
          .replace(/\s+A(?=\s|$)/g, '')
          .replace(/\s+\*(?=\s|$)/g, '')
          .replace(/\s+-?\d+(?:\.\d+)?\s*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
      } while (n !== prev);
      name = n;
    }

    if (name && name !== row.activity_name) {
      await db.query(`UPDATE gc_schedule_activities SET activity_name = $1 WHERE id = $2`, [name, row.id]);
      fixed++;
    }
  }

  console.log(`Fixed ${fixed} of ${r.rows.length} summary names.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
