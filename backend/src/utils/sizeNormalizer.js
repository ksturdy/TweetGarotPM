/**
 * Normalizes pipe/duct/fitting size strings from the EST Map Prod Database.
 *
 * Handles formats like: "1-1/2", "0.5''", "1''", "1.5", '2"', '6 x 4"', '3/4x1/2'
 * Returns a cleaned string suitable for consistent filtering and sorting.
 */

// Common fraction-to-decimal mappings
const FRACTIONS = {
  '1/8': '0.125',
  '1/4': '0.25',
  '3/8': '0.375',
  '1/2': '0.5',
  '5/8': '0.625',
  '3/4': '0.75',
  '7/8': '0.875',
};

/**
 * Convert a single size token to a normalized form.
 * Examples:
 *   "1-1/2" -> "1.5"
 *   "0.5''" -> "0.5"
 *   '3/4"'  -> "0.75"
 *   "2"     -> "2"
 *   "12"    -> "12"
 */
function normalizeSingleSize(raw) {
  if (!raw) return null;

  let s = String(raw).trim();

  // Strip trailing inch marks: '', ", "
  s = s.replace(/[''""]+$/g, '').trim();

  // If it's already a clean decimal or integer, return as-is
  if (/^\d+(\.\d+)?$/.test(s)) {
    return s;
  }

  // Handle mixed number: "1-1/2", "2-1/4", etc.
  const mixedMatch = s.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const num = parseInt(mixedMatch[2], 10);
    const den = parseInt(mixedMatch[3], 10);
    if (den !== 0) {
      const result = whole + num / den;
      return cleanDecimal(result);
    }
  }

  // Handle plain fraction: "1/2", "3/4"
  const fracMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10);
    const den = parseInt(fracMatch[2], 10);
    if (den !== 0) {
      return cleanDecimal(num / den);
    }
  }

  // If nothing matched, return the cleaned string as-is (for complex sizes like "6 x 4")
  return s;
}

/**
 * Clean a decimal number: remove trailing zeros.
 * 1.5 -> "1.5", 2.0 -> "2", 0.75 -> "0.75"
 */
function cleanDecimal(num) {
  const str = num.toString();
  if (str.includes('.')) {
    return str.replace(/\.?0+$/, '');
  }
  return str;
}

/**
 * Normalize a size string from the EST spreadsheet.
 * Handles simple sizes and compound sizes (e.g., "6 x 4", "3/4x1/2").
 * Returns null for empty/dash/missing values.
 */
function normalizeSize(raw) {
  if (!raw || raw === '-' || raw === 'None' || raw === '') return null;

  const s = String(raw).trim();

  // Check for compound sizes with separators: " x ", "x", " X ", " - "
  // But be careful: "1-1/2" is a mixed number, not a compound size
  // Compound sizes: "6 x 4", "3/4x1/2", "6"-4"", "12"-6""

  // If it contains " x " or " X " — split on that
  if (/\s+[xX]\s+/.test(s)) {
    const parts = s.split(/\s+[xX]\s+/);
    return parts.map(p => normalizeSingleSize(p)).filter(Boolean).join(' x ');
  }

  // If it contains "x" between size-like tokens (but not in a mixed fraction context)
  // e.g., "3/4x1/2" but NOT "1x3/4" which could be ambiguous
  if (/^\d[\d/]*x\d[\d/]*$/.test(s.replace(/[''""]/g, ''))) {
    const parts = s.replace(/[''""]/g, '').split('x');
    return parts.map(p => normalizeSingleSize(p)).filter(Boolean).join('x');
  }

  // Simple single size
  return normalizeSingleSize(s);
}

module.exports = { normalizeSize, normalizeSingleSize };
