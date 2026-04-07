export interface LocationGroupOption {
  value: string;
  label: string;
  prefix: string;
  longLabel: string;
  color: string;
}

/**
 * Location groups — single source of truth for all location group dropdowns across Titan.
 * These match Vista department code prefixes used in the Labor Forecast.
 */
export const LOCATION_GROUPS: LocationGroupOption[] = [
  { value: 'NEW', label: 'NEW', prefix: '10', longLabel: 'NE Wisconsin', color: '#3b82f6' },
  { value: 'CW',  label: 'CW',  prefix: '20', longLabel: 'Central WI',   color: '#8b5cf6' },
  { value: 'WW',  label: 'WW',  prefix: '30', longLabel: 'Western WI',   color: '#f59e0b' },
  { value: 'AZ',  label: 'AZ',  prefix: '40', longLabel: 'Tempe, AZ',    color: '#ef4444' },
];

/** Simple string array for components that only need group codes */
export const LOCATION_GROUP_VALUES = LOCATION_GROUPS.map(g => g.value);
