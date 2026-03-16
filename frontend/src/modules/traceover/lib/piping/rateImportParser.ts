/**
 * Pure parsing logic for importing productivity rates from pasted tabular data.
 * No React dependencies — all functions are stateless.
 */
import type { SystemFittingType } from '../../types/pipingSystem';
import { SYSTEM_FITTING_TYPE_LABELS } from '../../types/pipingSystem';

// ─── Column header → SystemFittingType auto-detection aliases ───

const COLUMN_ALIASES: Record<string, SystemFittingType> = {
  // Standard fittings
  '90 elbow': 'elbow_90',
  '90° elbow': 'elbow_90',
  '90 deg elbow': 'elbow_90',
  '45 elbow': 'elbow_45',
  '45° elbow': 'elbow_45',
  '45 deg elbow': 'elbow_45',
  'tee': 'tee',
  'cap': 'cap',
  'coupling': 'coupling',
  'cross': 'cross',
  'lateral': 'lateral',
  'stub end': 'stub_end',
  'union': 'union',
  // Flanges
  'blind': 'flange_blind',
  'blind flange': 'flange_blind',
  'lap joint': 'flange_lap_joint',
  'lap joint flange': 'flange_lap_joint',
  'plate': 'flange_plate',
  'plate flange': 'flange_plate',
  'plate, split': 'flange_plate_split',
  'plate split': 'flange_plate_split',
  'split plate': 'flange_plate_split',
  'slip-on': 'flange_slip_on',
  'slip on': 'flange_slip_on',
  'slip-on flange': 'flange_slip_on',
  'socket weld': 'flange_socket_weld',
  'socket weld flange': 'flange_socket_weld',
  'threaded': 'flange_threaded',
  'threaded flange': 'flange_threaded',
  'weld neck': 'flange_weld_neck',
  'weld neck flange': 'flange_weld_neck',
  'welding neck': 'flange_weld_neck',
  'standard bore': 'flange_weld_neck',
  // Olets
  'weldolet': 'weldolet',
  'threadolet': 'threadolet',
  'sockolet': 'sockolet',
  'latrolet': 'latrolet',
  // Valves
  'gate valve': 'valve_gate',
  'gate': 'valve_gate',
  'globe valve': 'valve_globe',
  'globe': 'valve_globe',
  'ball valve': 'valve_ball',
  'ball': 'valve_ball',
  'butterfly valve': 'valve_butterfly',
  'butterfly': 'valve_butterfly',
  'butterfly lever': 'valve_butterfly',
  'lever butterfly': 'valve_butterfly',
  'butterfly gear': 'valve_butterfly_gear',
  'gear butterfly': 'valve_butterfly_gear',
  'gear operated': 'valve_butterfly_gear',
  'gear operated butterfly': 'valve_butterfly_gear',
  'check valve': 'valve_check',
  'check': 'valve_check',
};

// ─── Types ───

export interface ColumnMapping {
  columnIndex: number;
  columnHeader: string;
  fittingType: string | null;       // SystemFittingType or custom user-defined type
  enabled: boolean;
  autoDetected: boolean;
}

export interface SizeRow {
  rowIndex: number;
  rawSize: string;
  normalizedSize: string;
  enabled: boolean;
}

export interface ParsedRate {
  fitting_type: string;
  pipe_size: string;
  hours_per_unit: number;
}

export interface ParseResult {
  grid: string[][];
  headerRow: string[];
  sizeColumnIndex: number;
  columns: ColumnMapping[];
  sizes: SizeRow[];
}

// ─── Parsing ───

/**
 * Parse tab-separated text into a 2D grid.
 */
export function parseTabSeparatedText(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ''));
}

/**
 * Detect which column contains pipe sizes.
 */
export function detectSizeColumn(grid: string[][]): number {
  if (grid.length === 0) return 0;
  const header = grid[0];

  // Check headers for "dia", "size", "nom"
  for (let i = 0; i < header.length; i++) {
    const h = header[i].toLowerCase();
    if (h.includes('dia') || h.includes('size') || h.includes('nom')) return i;
  }

  // Fallback: find the column where most data rows look like pipe sizes
  const sizePattern = /^\d+(?:\s?\d\/\d+)?(?:\s*")?$/;
  let bestCol = 0;
  let bestCount = 0;
  for (let col = 0; col < header.length; col++) {
    let count = 0;
    for (let row = 1; row < grid.length; row++) {
      if (grid[row][col] && sizePattern.test(grid[row][col])) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestCol = col;
    }
  }
  return bestCol;
}

/**
 * Normalize a pasted pipe size string to the DB format.
 * "1/2" → "1/2", "1 1/4" → "1 1/4", "1-1/4" → "1 1/4"
 */
export function normalizePastedSize(raw: string): string {
  return raw.replace(/"/g, '').replace(/-/g, ' ').trim();
}

/**
 * Check if a string looks like a pipe size (e.g. "1/2", "3 1/2", "14", "60").
 */
export function looksLikePipeSize(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  // Must start with a digit. Allow digits, spaces, fractions, hyphens, quote marks, periods.
  return /^\d/.test(s) && /^[\d\s\/\-".]+$/.test(s);
}

/**
 * Auto-detect what SystemFittingType a column header maps to.
 * directOnly=true skips substring matching (used for sub-header labels to avoid
 * false positives like "Weld Neck - Schedule 40 Bore" matching "weld neck").
 */
export function autoDetectColumnType(header: string, directOnly = false): SystemFittingType | null {
  const norm = header.toLowerCase().trim();
  if (!norm) return null;

  // Direct match
  if (COLUMN_ALIASES[norm]) return COLUMN_ALIASES[norm];

  if (directOnly) return null;

  // Substring match — check if any alias is contained in the header
  for (const [alias, type] of Object.entries(COLUMN_ALIASES)) {
    if (norm.includes(alias)) return type;
  }

  return null;
}

/**
 * Detect sub-header rows between the main header and the first data row.
 * Sub-header rows contain text labels (e.g. bore schedules) but not pipe sizes.
 * Returns the extracted labels and the index of the first real data row.
 */
function detectSubHeaders(
  grid: string[][],
  sizeColumnIndex: number,
): { labels: { name: string; group: string }[]; firstDataRow: number } {
  const labels: { name: string; group: string }[] = [];
  let firstDataRow = 1;

  for (let r = 1; r < grid.length; r++) {
    const sizeCell = (grid[r][sizeColumnIndex] || '').trim();

    // If the size cell looks like a pipe size, this is the first data row
    if (looksLikePipeSize(sizeCell)) {
      firstDataRow = r;
      break;
    }

    // This row is a sub-header — extract label
    // Primary label is in the size column cell (e.g. "Double Extra Heavy Bore")
    // Group name may be in the next cell (e.g. "Weld Neck")
    if (sizeCell) {
      const groupCell = grid[r].find((c, i) => i !== sizeColumnIndex && c.trim())?.trim() || '';
      labels.push({ name: sizeCell, group: groupCell });
    }

    firstDataRow = r + 1;
  }

  return { labels, firstDataRow };
}

/**
 * Parse the full grid into column mappings and size rows.
 * Handles multi-row headers (e.g. "Weld Neck" spanning sub-columns with bore schedules).
 */
export function analyzeGrid(grid: string[][]): ParseResult {
  if (grid.length < 2) {
    return { grid, headerRow: grid[0] || [], sizeColumnIndex: 0, columns: [], sizes: [] };
  }

  const sizeColumnIndex = detectSizeColumn(grid);

  // Find max column count across ALL rows (data rows often wider than header)
  const maxCols = grid.reduce((max, row) => Math.max(max, row.length), 0);

  // Detect sub-header rows (bore schedules, etc.) between header and first data row
  const { labels: subHeaderLabels, firstDataRow } = detectSubHeaders(grid, sizeColumnIndex);

  // Build extended header row covering all columns
  const headerRow = [...grid[0]];
  while (headerRow.length < maxCols) headerRow.push('');

  // Assign sub-header labels to unnamed columns
  if (subHeaderLabels.length > 0) {
    // Find the last named column in the original header — this is the "group" header
    // (e.g. "Weld Neck" spanning multiple sub-columns)
    const origLen = grid[0].length;
    const unnamedCount = maxCols - origLen;

    if (subHeaderLabels.length === unnamedCount + 1) {
      // Sub-headers cover the last named column + all unnamed columns
      // e.g. "Weld Neck" col 8 + 11 unnamed cols = 12 sub-headers
      for (let i = 0; i < subHeaderLabels.length; i++) {
        const colIdx = origLen - 1 + i;
        const { name, group } = subHeaderLabels[i];
        headerRow[colIdx] = group ? `${group} - ${name}` : name;
      }
    } else if (subHeaderLabels.length === unnamedCount) {
      // Sub-headers cover only the unnamed columns
      for (let i = 0; i < subHeaderLabels.length; i++) {
        const colIdx = origLen + i;
        const { name, group } = subHeaderLabels[i];
        headerRow[colIdx] = group ? `${group} - ${name}` : name;
      }
    } else {
      // Best-effort: assign sequentially to unnamed columns
      const startCol = origLen;
      for (let i = 0; i < subHeaderLabels.length && startCol + i < maxCols; i++) {
        const { name, group } = subHeaderLabels[i];
        headerRow[startCol + i] = group ? `${group} - ${name}` : name;
      }
    }
  }

  // Build column mappings for ALL columns (not just original header width)
  const columns: ColumnMapping[] = [];
  const origHeaderLen = grid[0].length;

  for (let i = 0; i < maxCols; i++) {
    if (i === sizeColumnIndex) continue;
    const isSubHeaderColumn = i >= origHeaderLen || (subHeaderLabels.length > 0 && i === origHeaderLen - 1);
    // Use direct-only matching for sub-header columns to avoid false positives
    const detected = isSubHeaderColumn
      ? autoDetectColumnType(headerRow[i], true)
      : autoDetectColumnType(headerRow[i]);
    columns.push({
      columnIndex: i,
      columnHeader: headerRow[i],
      fittingType: detected,
      enabled: detected !== null,
      autoDetected: detected !== null,
    });
  }

  // Build size rows — only include rows with valid pipe sizes
  const sizes: SizeRow[] = [];
  for (let r = firstDataRow; r < grid.length; r++) {
    const rawSize = (grid[r][sizeColumnIndex] || '').trim();
    if (!rawSize || !looksLikePipeSize(rawSize)) continue;
    sizes.push({
      rowIndex: r,
      rawSize,
      normalizedSize: normalizePastedSize(rawSize),
      enabled: true,
    });
  }

  return { grid, headerRow, sizeColumnIndex, columns, sizes };
}

/**
 * Build the final rates array from enabled columns and sizes.
 */
export function buildRates(
  grid: string[][],
  columns: ColumnMapping[],
  sizes: SizeRow[],
): ParsedRate[] {
  const rates: ParsedRate[] = [];

  for (const col of columns) {
    if (!col.enabled || !col.fittingType) continue;

    for (const sz of sizes) {
      if (!sz.enabled) continue;

      const cell = grid[sz.rowIndex]?.[col.columnIndex];
      if (!cell || cell === '--' || cell === '-' || cell === '') continue;

      const value = parseFloat(cell);
      if (isNaN(value) || value <= 0) continue;

      rates.push({
        fitting_type: col.fittingType,
        pipe_size: sz.normalizedSize,
        hours_per_unit: value,
      });
    }
  }

  // Deduplicate: if multiple columns map to the same fitting_type, last value wins
  const seen = new Map<string, number>();
  const deduped: ParsedRate[] = [];
  for (const r of rates) {
    const key = `${r.fitting_type}::${r.pipe_size}`;
    const existing = seen.get(key);
    if (existing !== undefined) {
      deduped[existing] = r; // overwrite with later value
    } else {
      seen.set(key, deduped.length);
      deduped.push(r);
    }
  }

  return deduped;
}

/**
 * Get all SystemFittingType options for the column mapping dropdown.
 */
export function getFittingTypeOptions(): { value: SystemFittingType; label: string }[] {
  return (Object.entries(SYSTEM_FITTING_TYPE_LABELS) as [SystemFittingType, string][]).map(
    ([value, label]) => ({ value, label }),
  );
}
