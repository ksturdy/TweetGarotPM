export interface MarketOption {
  value: string;
  label: string;
  icon: string;
}

/**
 * Vista/VP markets — single source of truth for all market dropdowns across Titan.
 * These match the primary_market values imported from Vista.
 */
export const MARKETS: MarketOption[] = [
  { value: 'Amusement/Recreation', icon: '🎢', label: 'Amusement/Recreation' },
  { value: 'Communication', icon: '📡', label: 'Communication' },
  { value: 'Conservation/Development', icon: '🌲', label: 'Conservation/Development' },
  { value: 'Educational', icon: '🏫', label: 'Educational' },
  { value: 'Health Care', icon: '🏥', label: 'Health Care' },
  { value: 'Highway/Street', icon: '🛣️', label: 'Highway/Street' },
  { value: 'Lodging', icon: '🏨', label: 'Lodging' },
  { value: 'Manufacturing', icon: '🏭', label: 'Manufacturing' },
  { value: 'MFG-Food', icon: '🍔', label: 'MFG-Food' },
  { value: 'MFG-Other', icon: '🏭', label: 'MFG-Other' },
  { value: 'MFG-Paper', icon: '📄', label: 'MFG-Paper' },
  { value: 'Office', icon: '🏢', label: 'Office' },
  { value: 'Power', icon: '⚡', label: 'Power' },
  { value: 'Public Safety', icon: '🚔', label: 'Public Safety' },
  { value: 'Religious', icon: '⛪', label: 'Religious' },
  { value: 'Residential', icon: '🏠', label: 'Residential' },
  { value: 'Sewage/Waste Disposal', icon: '♻️', label: 'Sewage/Waste Disposal' },
  { value: 'Transportation', icon: '🚚', label: 'Transportation' },
  { value: 'Water Supply', icon: '💧', label: 'Water Supply' },
];

/** Simple string array for components that only need market names */
export const MARKET_VALUES = MARKETS.map(m => m.value);
