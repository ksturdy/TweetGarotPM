// Parses uploaded GC schedule files into a normalized activity list.
//
// Supported now:
//   - .xlsx / .xls / .csv  → header-mapped row parser
//   - .xer                 → Primavera P6 tab-delimited export (TASK + PROJWBS)
//   - .pdf                 → text extraction + heuristic row detection (lossy)
//
// Deferred (Phase 2): MS Project .xml (Project XML schema) — requires a real
// XML parser dep. Until then we throw a clear error pointing users to export
// the schedule to Excel from MS Project.
//
// Returned shape per activity:
//   {
//     activity_id, activity_name, wbs_code, wbs_path,
//     start_date, finish_date, baseline_start, baseline_finish,
//     duration_days, percent_complete, status,
//     predecessors, successors, responsible,
//     trade, is_mechanical, is_milestone, is_summary,
//     raw, display_order
//   }

const XLSX = require('xlsx');
const { PDFParse } = require('pdf-parse');

// ─── Header mapping (Excel/CSV) ───────────────────────────────────────────

const HEADER_ALIASES = {
  activity_id:    ['activity id', 'activity_id', 'id', 'task id', 'unique id', 'wbs id', 'task code'],
  activity_name:  ['activity name', 'task name', 'name', 'description', 'activity description', 'task description'],
  wbs_code:       ['wbs', 'wbs code', 'wbs path', 'phase'],
  start_date:     ['start', 'start date', 'scheduled start', 'early start', 'planned start'],
  finish_date:    ['finish', 'finish date', 'end', 'end date', 'scheduled finish', 'early finish', 'planned finish'],
  baseline_start: ['baseline start', 'bl start', 'bl1 start'],
  baseline_finish:['baseline finish', 'bl finish', 'bl1 finish'],
  duration_days:  ['duration', 'original duration', 'orig duration', 'dur'],
  percent_complete:['% complete', 'percent complete', '% comp', 'physical % complete', 'progress'],
  status:         ['status', 'activity status'],
  predecessors:   ['predecessors', 'preds'],
  successors:     ['successors', 'succs'],
  responsible:    ['responsible', 'resource', 'resources', 'responsibility', 'sub', 'subcontractor', 'assigned to', 'trade', 'crew'],
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim();

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((h, idx) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(n)) {
        if (map[field] === undefined) map[field] = idx;
        break;
      }
    }
  });
  return map;
}

// ─── Date / number coercion ───────────────────────────────────────────────

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12' };

function coerceDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  // xlsx serial date number
  if (typeof v === 'number' && v > 25569 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim().replace(/\s+A$/i, '').trim(); // strip P6 actual-suffix
  if (!s) return null;
  // ISO yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Primavera default: DD-MMM-YY (e.g. 04-Aug-25)
  const dmy = s.match(/^(\d{1,2})[\-\s]([A-Za-z]{3,4})[\-\s](\d{2,4})/);
  if (dmy) {
    const mm = MONTHS[dmy[2].toLowerCase()];
    if (mm) {
      const yyyy = dmy[3].length === 2 ? (parseInt(dmy[3], 10) >= 70 ? '19' + dmy[3] : '20' + dmy[3]) : dmy[3];
      return `${yyyy}-${mm}-${dmy[1].padStart(2, '0')}`;
    }
  }
  // M/D/YYYY or M-D-YYYY (US)
  const us = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (us) {
    const yyyy = us[3].length === 2 ? '20' + us[3] : us[3];
    return `${yyyy}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function coerceNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[%,d ]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Trade detection ──────────────────────────────────────────────────────

// rules: array of { trade, keyword, match_field } where match_field is
//   'name' | 'wbs' | 'responsible' | 'all'.
function detectTrade(activity, rules) {
  const name = (activity.activity_name || '').toUpperCase();
  const wbs = (activity.wbs_code || '').toUpperCase();
  const resp = (activity.responsible || '').toUpperCase();
  for (const r of rules) {
    const kw = r.keyword.toUpperCase();
    let hit = false;
    switch (r.match_field) {
      case 'name': hit = name.includes(kw); break;
      case 'wbs': hit = wbs.includes(kw); break;
      case 'responsible': hit = resp.includes(kw); break;
      case 'all':
      default:
        hit = name.includes(kw) || wbs.includes(kw) || resp.includes(kw);
    }
    if (hit) return r.trade;
  }
  return null;
}

function applyTradeDetection(activities, rules) {
  for (const a of activities) {
    const trade = detectTrade(a, rules);
    a.trade = trade;
    a.is_mechanical = trade === 'mechanical';
  }
  return activities;
}

// ─── Excel / CSV ──────────────────────────────────────────────────────────

function parseSpreadsheet(buffer, filename) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  // Find the most populated sheet — GC schedules sometimes ship with extra
  // "Notes" / "Cover" sheets. Fall back to first sheet.
  let chosen = wb.SheetNames[0];
  let bestCount = 0;
  for (const name of wb.SheetNames) {
    const ref = wb.Sheets[name]['!ref'];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const cells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    if (cells > bestCount) { bestCount = cells; chosen = name; }
  }

  const sheet = wb.Sheets[chosen];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  if (rows.length < 2) {
    return { activities: [], warnings: ['Sheet had no rows.'] };
  }

  // Find the header row — first row with ≥3 known aliases. Some GC exports
  // have a title row above the headers.
  let headerIdx = -1;
  let headerMap = {};
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const map = buildHeaderMap(rows[i] || []);
    if (Object.keys(map).length >= 2 && (map.activity_name !== undefined || map.activity_id !== undefined)) {
      headerIdx = i;
      headerMap = map;
      break;
    }
  }
  if (headerIdx === -1) {
    return { activities: [], warnings: ['Could not detect a header row. Expected columns like "Activity ID" / "Activity Name" / "Start" / "Finish".'] };
  }

  const headers = rows[headerIdx].map((h) => String(h || ''));
  const activities = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((v) => v === null || v === '')) continue;
    const get = (field) => (headerMap[field] !== undefined ? r[headerMap[field]] : null);

    const name = String(get('activity_name') || '').trim();
    const id = String(get('activity_id') || '').trim();
    if (!name && !id) continue;

    const raw = {};
    headers.forEach((h, idx) => {
      if (h && r[idx] !== null && r[idx] !== '') raw[h] = r[idx];
    });

    activities.push({
      activity_id: id || null,
      activity_name: name || (id ? `Activity ${id}` : 'Unnamed'),
      wbs_code: String(get('wbs_code') || '').trim() || null,
      wbs_path: null,
      start_date: coerceDate(get('start_date')),
      finish_date: coerceDate(get('finish_date')),
      baseline_start: coerceDate(get('baseline_start')),
      baseline_finish: coerceDate(get('baseline_finish')),
      duration_days: coerceNumber(get('duration_days')),
      percent_complete: coerceNumber(get('percent_complete')),
      status: String(get('status') || '').trim() || null,
      predecessors: String(get('predecessors') || '').trim() || null,
      successors: String(get('successors') || '').trim() || null,
      responsible: String(get('responsible') || '').trim() || null,
      is_milestone: false,
      is_summary: false,
      raw,
      display_order: activities.length,
    });
  }
  return { activities, warnings: [] };
}

// ─── Primavera XER ────────────────────────────────────────────────────────

function parseXER(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);
  const tables = {};
  let currentTable = null;
  let currentFields = null;

  for (const line of lines) {
    if (!line) continue;
    const cols = line.split('\t');
    const tag = cols[0];
    if (tag === '%T') {
      currentTable = cols[1];
      tables[currentTable] = { fields: [], rows: [] };
    } else if (tag === '%F' && currentTable) {
      currentFields = cols.slice(1);
      tables[currentTable].fields = currentFields;
    } else if (tag === '%R' && currentTable && currentFields) {
      const obj = {};
      currentFields.forEach((f, i) => { obj[f] = cols[i + 1]; });
      tables[currentTable].rows.push(obj);
    }
  }

  // Build WBS path lookup
  const wbsById = {};
  if (tables.PROJWBS) {
    for (const w of tables.PROJWBS.rows) {
      wbsById[w.wbs_id] = { code: w.wbs_short_name, name: w.wbs_name, parentId: w.parent_wbs_id };
    }
  }
  const wbsPath = (id) => {
    const parts = [];
    let cur = wbsById[id];
    let guard = 0;
    while (cur && guard++ < 50) {
      parts.unshift(cur.name || cur.code);
      cur = wbsById[cur.parentId];
    }
    return parts.join(' > ');
  };

  if (!tables.TASK) {
    return { activities: [], warnings: ['XER file has no TASK table.'] };
  }

  const activities = [];
  for (const t of tables.TASK.rows) {
    const wbsId = t.wbs_id;
    const wbs = wbsById[wbsId];
    activities.push({
      activity_id: t.task_code || null,
      activity_name: t.task_name || `Task ${t.task_id}`,
      wbs_code: wbs ? wbs.code : null,
      wbs_path: wbsId ? wbsPath(wbsId) : null,
      start_date: coerceDate(t.act_start_date || t.early_start_date || t.target_start_date),
      finish_date: coerceDate(t.act_end_date || t.early_end_date || t.target_end_date),
      baseline_start: coerceDate(t.bl1_start_date),
      baseline_finish: coerceDate(t.bl1_end_date),
      duration_days: coerceNumber(t.target_drtn_hr_cnt) ? coerceNumber(t.target_drtn_hr_cnt) / 8 : null,
      percent_complete: coerceNumber(t.phys_complete_pct),
      status: t.status_code || null,
      predecessors: null,
      successors: null,
      responsible: null,
      is_milestone: t.task_type === 'TT_Mile' || t.task_type === 'TT_FinMile',
      is_summary: t.task_type === 'TT_WBS',
      raw: t,
      display_order: activities.length,
    });
  }

  return { activities, warnings: [] };
}

// ─── PDF (best-effort) ────────────────────────────────────────────────────
// PDF Gantt printouts are spatially laid out — we can only do a heuristic
// pass here. Strategy: extract text by line, look for lines that contain
// at least one date pattern; treat the date-bearing chunks as start/finish
// and the leading text as the activity name. This is intentionally lossy
// and the upload UI warns the user.

async function parsePDF(buffer) {
  const parser = new PDFParse({ data: buffer });
  let text = '';
  try {
    const result = await parser.getText();
    text = (result && result.text) || '';
  } finally {
    if (typeof parser.destroy === 'function') await parser.destroy().catch(() => {});
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return parsePdfLines(lines);
}

// Per-line PDF parser logic, factored out so the re-parse script (which
// reads stored raw.line values from a prior import) can run the same logic
// without re-extracting text from a PDF buffer.
function parsePdfLines(lines) {
  // Match: 04-Aug-25, 4-Aug-2025, 8/15/26, 2026-08-15
  const dateRe = /\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)-\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi;
  // Some PDFs (e.g. BDW lookahead) prepend a row-index column before the
  // activity ID: "7 \tDCC.B1.3827 \t...". Strip that first so the ID regex
  // can anchor on the ID itself.
  const rowPrefixRe = /^\s*\d{1,5}\s+/;
  // Multi-segment IDs like DCC.B1.3827, BDW.PRE.1180, EQPTRK.400.900.000.G00.0001.
  // Requires at least one separator-segment pair, and at least one digit
  // somewhere — so plain alpha tokens don't get classified as activity IDs.
  const multiSegIdRe = /^([A-Z][A-Z0-9]*(?:[.\-][A-Z0-9]+){1,10})\b/;
  // P6 / common GC single-segment patterns: A####, CROC####, CROC.####, AA-####.
  const singleSegIdRe = /^([A-Z]{1,6}[\.\-]?\d{3,6})\b/;

  const activities = [];
  const warnings = ['PDF parsing is best-effort — review and correct rows. For accurate import, ask the GC for an Excel, CSV, or P6 XER export.'];
  let lastSummaryOrder = null;

  for (const line of lines) {
    const dates = line.match(dateRe);
    if (!dates || dates.length === 0) continue;

    let activity_id = null;
    let rest = line;
    const stripped = line.replace(rowPrefixRe, '');
    let idMatch = stripped.match(multiSegIdRe);
    if (idMatch && /\d/.test(idMatch[1])) {
      activity_id = idMatch[1];
      rest = stripped.slice(idMatch[0].length).trim();
    } else if ((idMatch = stripped.match(singleSegIdRe))) {
      activity_id = idMatch[1];
      rest = stripped.slice(idMatch[0].length).trim();
    }

    // Strip dates from the rest to leave the name. P6 PDF rows look like:
    //   "<name>  <dur>  <start> [A]  <finish> [A]  <float>  <variance>"
    // We need to drop the trailing duration / float / variance numbers and
    // the 'A' actual-flag and '*' constraint markers. Run an iterative pass
    // so it doesn't matter whether a row has 1, 2, or 3 trailing columns —
    // we strip the rightmost token until nothing more matches. This makes
    // the output deterministic across different P6 print layouts so the
    // diff doesn't flag phantom name changes between uploads.
    // Rows with no Activity ID are WBS / summary headers. P6 PDFs print
    // them as "wbs_code\twbs_name" where the two halves are identical
    // (e.g. "GP - Crossett Converting\tGP - Crossett Converting"). We
    // detect that pattern up front so we can keep one clean copy of the
    // name, mark the row as a summary, and skip the leading-number strip
    // (which would clobber WBS codes like "500 - ...").
    const isSummary = !activity_id;
    let name = rest.normalize('NFKC');

    if (isSummary) {
      // P6 prints "wbs_code\twbs_name" where halves are usually identical;
      // allow trailing whitespace on either half so a "X\tX " row matches.
      const dup = rest.match(/^\s*([^\t]{2,200}?)\s*\t\s*\1\s*(?:\t|$)/);
      if (dup) name = dup[1].trim();
    }

    for (const d of dates) name = name.replace(d, '');
    name = name.replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    let prev;
    do {
      prev = name;
      name = name
        .replace(/\s+A(?=\s|$)/g, '')          // 'A' actual flag tokens
        .replace(/\s+\*(?=\s|$)/g, '')          // '*' constraint flag tokens
        .replace(/\s+-?\d+(?:\.\d+)?\s*$/, '')  // trailing number (dur/float/variance)
        .replace(/\s+/g, ' ')
        .trim();
    } while (name !== prev);
    if (!isSummary) {
      // Only strip a leading lone number on task rows — for summaries the
      // leading number is usually part of the WBS code ("500 - ...") and
      // must be preserved.
      name = name.replace(/^-?\d+(?:\.\d+)?\s+/, '').trim();
    }
    if (!name && !activity_id) continue;

    let start = coerceDate(dates[0]);
    let finish = dates.length > 1 ? coerceDate(dates[1]) : null;
    // Column order varies by PDF (P6 prints start→finish; BDW lookahead
    // prints finish→start). If we have both and they're out of order, swap.
    if (start && finish && start > finish) {
      const tmp = start; start = finish; finish = tmp;
    }
    const display_order = activities.length;
    const parent_summary_order = isSummary ? null : (lastSummaryOrder != null ? lastSummaryOrder : null);

    activities.push({
      activity_id,
      activity_name: name || (activity_id ? `Activity ${activity_id}` : 'Unnamed'),
      wbs_code: null,
      wbs_path: null,
      start_date: start,
      finish_date: finish,
      baseline_start: null,
      baseline_finish: null,
      duration_days: null,
      percent_complete: null,
      status: null,
      predecessors: null,
      successors: null,
      responsible: null,
      is_milestone: false,
      is_summary: isSummary,
      outline_level: isSummary ? 1 : 0,
      parent_summary_order,
      raw: { line },
      display_order,
    });

    if (isSummary) lastSummaryOrder = display_order;
  }

  if (activities.length === 0) {
    warnings.push('No date-bearing rows detected in the PDF. The file may be image-based (scanned) or use a non-standard layout.');
  }
  return { activities, warnings };
}

// ─── Format detection + dispatcher ────────────────────────────────────────

function detectFormat(filename, mimetype) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xer')) return 'xer';
  if (lower.endsWith('.xml')) return 'mspxml';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (mimetype && mimetype.includes('spreadsheet')) return 'xlsx';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'text/csv') return 'csv';
  return null;
}

async function parseGCSchedule({ buffer, filename, mimetype, tradeRules }) {
  const format = detectFormat(filename, mimetype);
  if (!format) {
    throw new Error('Unsupported file type. Use .xlsx, .csv, .xer, or .pdf.');
  }
  let result;
  switch (format) {
    case 'xlsx':
    case 'csv':
      result = parseSpreadsheet(buffer, filename);
      break;
    case 'xer':
      result = parseXER(buffer);
      break;
    case 'pdf':
      result = await parsePDF(buffer);
      break;
    case 'mspxml':
      throw new Error('MS Project XML import is not yet supported. Export the schedule to Excel from MS Project (File → Export → Save as Excel) and upload that.');
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  applyTradeDetection(result.activities, tradeRules || []);
  // Backfill duration_days from start→finish where missing (PDFs don't have
  // a duration column; some Excel exports omit it too).
  for (const a of result.activities) {
    if (a.duration_days == null && a.start_date && a.finish_date) {
      const ms = new Date(a.finish_date + 'T00:00:00').getTime() - new Date(a.start_date + 'T00:00:00').getTime();
      if (!Number.isNaN(ms) && ms >= 0) a.duration_days = Math.round(ms / 86400000);
    }
  }
  return { format, activities: result.activities, warnings: result.warnings || [] };
}

module.exports = {
  parseGCSchedule,
  detectFormat,
  // exported for tests
  parseSpreadsheet,
  parseXER,
  parsePDF,
  parsePdfLines,
  applyTradeDetection,
  detectTrade,
};
