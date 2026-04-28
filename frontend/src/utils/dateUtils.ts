/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight instead of UTC midnight.
 * Prevents the off-by-one-day bug when displaying dates in US timezones.
 *
 * new Date("2026-04-01")       → UTC midnight → displays as 3/31 in US timezones
 * parseLocalDate("2026-04-01") → local midnight → displays as 4/1 correctly
 */
export function parseLocalDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(NaN);
  const str = String(dateStr);
  // If it already has a time component, parse normally
  if (str.includes('T') || str.includes(' ')) return new Date(str);
  // Append T00:00:00 to force local timezone interpretation
  return new Date(str + 'T00:00:00');
}

/**
 * Format a date-only string for display, avoiding UTC timezone shift.
 */
export function formatLocalDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '-';
  const date = parseLocalDate(dateStr);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', options || { month: 'numeric', day: 'numeric', year: 'numeric' });
}
