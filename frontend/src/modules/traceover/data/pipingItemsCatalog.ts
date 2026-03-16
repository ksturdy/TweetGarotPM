import type { PlaceableItemDef } from '../types/placeableItem';

export const PIPING_ITEMS_CATALOG: PlaceableItemDef[] = [
  // ─── Valves ───
  { id: 'valve_gate',       name: 'Gate Valve',       abbreviation: 'GV',  category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_gate' },
  { id: 'valve_globe',      name: 'Globe Valve',      abbreviation: 'GLV', category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_globe' },
  { id: 'valve_ball',       name: 'Ball Valve',       abbreviation: 'BV',  category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_ball' },
  { id: 'valve_butterfly',  name: 'Butterfly Valve',  abbreviation: 'BFV', category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_butterfly' },
  { id: 'valve_check',      name: 'Check Valve',      abbreviation: 'CV',  category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_check' },
  { id: 'valve_relief',     name: 'Relief / Safety Valve', abbreviation: 'RV', category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_relief' },
  { id: 'valve_control',    name: 'Control Valve',    abbreviation: 'CTV', category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_control' },
  { id: 'valve_balancing',  name: 'Balancing Valve',  abbreviation: 'BAL', category: 'piping_item', subcategory: 'Valves', shape: 'diamond', color: '#10b981', takeoffCategory: 'accessories', takeoffComponentType: 'valve', unit: 'ea', iconType: 'svg:valve_balancing' },

  // ─── Caps & Plugs ───
  { id: 'cap',  name: 'Cap',  abbreviation: 'CAP', category: 'piping_item', subcategory: 'Caps & Plugs', shape: 'circle', color: '#6366f1', takeoffCategory: 'piping', takeoffComponentType: 'pipe_fitting', unit: 'ea', fittingType: 'cap', iconType: 'svg:cap' },
  { id: 'plug', name: 'Plug', abbreviation: 'PLG', category: 'piping_item', subcategory: 'Caps & Plugs', shape: 'circle', color: '#6366f1', takeoffCategory: 'piping', takeoffComponentType: 'pipe_fitting', unit: 'ea', iconType: 'svg:plug' },

  // ─── Olets ───
  { id: 'olet_weldolet',   name: 'Weldolet',   abbreviation: 'WOL', category: 'piping_item', subcategory: 'Olets', shape: 'circle', color: '#f59e0b', takeoffCategory: 'piping', takeoffComponentType: 'pipe_fitting', unit: 'ea', iconType: 'svg:weldolet', needsOutletSize: true },
  { id: 'olet_threadolet', name: 'Threadolet', abbreviation: 'TOL', category: 'piping_item', subcategory: 'Olets', shape: 'circle', color: '#f59e0b', takeoffCategory: 'piping', takeoffComponentType: 'pipe_fitting', unit: 'ea', iconType: 'svg:threadolet', needsOutletSize: true },
  { id: 'olet_sockolet',   name: 'Sockolet',   abbreviation: 'SOL', category: 'piping_item', subcategory: 'Olets', shape: 'circle', color: '#f59e0b', takeoffCategory: 'piping', takeoffComponentType: 'pipe_fitting', unit: 'ea', iconType: 'svg:sockolet', needsOutletSize: true },
  { id: 'olet_latrolet',   name: 'Latrolet',   abbreviation: 'LOL', category: 'piping_item', subcategory: 'Olets', shape: 'circle', color: '#f59e0b', takeoffCategory: 'piping', takeoffComponentType: 'pipe_fitting', unit: 'ea', iconType: 'svg:latrolet', needsOutletSize: true },

  // ─── Strainers ───
  { id: 'strainer_y',      name: 'Y-Strainer',      abbreviation: 'YS', category: 'piping_item', subcategory: 'Strainers', shape: 'diamond', color: '#ec4899', takeoffCategory: 'accessories', takeoffComponentType: 'filter', unit: 'ea', iconType: 'svg:strainer_y' },
  { id: 'strainer_basket',  name: 'Basket Strainer', abbreviation: 'BS', category: 'piping_item', subcategory: 'Strainers', shape: 'diamond', color: '#ec4899', takeoffCategory: 'accessories', takeoffComponentType: 'filter', unit: 'ea', iconType: 'svg:strainer_basket' },

  // ─── Traps ───
  { id: 'trap_steam', name: 'Steam Trap', abbreviation: 'ST', category: 'piping_item', subcategory: 'Traps', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'accessories', takeoffComponentType: 'other_accessory', unit: 'ea', iconType: 'svg:trap_steam' },
  { id: 'trap_p',     name: 'P-Trap',     abbreviation: 'PT', category: 'piping_item', subcategory: 'Traps', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'accessories', takeoffComponentType: 'other_accessory', unit: 'ea', iconType: 'svg:trap_p' },

  // ─── Expansion & Flex ───
  { id: 'expansion_joint', name: 'Expansion Joint', abbreviation: 'EJ', category: 'piping_item', subcategory: 'Expansion & Flex', shape: 'rectangle', color: '#8b5cf6', takeoffCategory: 'accessories', takeoffComponentType: 'other_accessory', unit: 'ea', iconType: 'svg:expansion_joint' },
  { id: 'flex_connector',  name: 'Flex Connector',  abbreviation: 'FX', category: 'piping_item', subcategory: 'Expansion & Flex', shape: 'rectangle', color: '#8b5cf6', takeoffCategory: 'accessories', takeoffComponentType: 'other_accessory', unit: 'ea', iconType: 'svg:flex_connector' },

  // ─── Specialties ───
  { id: 'flow_meter',      name: 'Flow Meter',      abbreviation: 'FM', category: 'piping_item', subcategory: 'Specialties', shape: 'circle', color: '#06b6d4', takeoffCategory: 'accessories', takeoffComponentType: 'sensor', unit: 'ea', iconType: 'svg:flow_meter' },
  { id: 'pressure_gauge',  name: 'Pressure Gauge',  abbreviation: 'PG', category: 'piping_item', subcategory: 'Specialties', shape: 'circle', color: '#06b6d4', takeoffCategory: 'accessories', takeoffComponentType: 'sensor', unit: 'ea', iconType: 'svg:pressure_gauge' },
  { id: 'thermometer',     name: 'Thermometer',     abbreviation: 'TH', category: 'piping_item', subcategory: 'Specialties', shape: 'circle', color: '#06b6d4', takeoffCategory: 'accessories', takeoffComponentType: 'sensor', unit: 'ea', iconType: 'svg:thermometer' },
  { id: 'air_separator',   name: 'Air Separator',   abbreviation: 'AS', category: 'piping_item', subcategory: 'Specialties', shape: 'circle', color: '#06b6d4', takeoffCategory: 'accessories', takeoffComponentType: 'other_accessory', unit: 'ea', iconType: 'svg:air_separator' },
  { id: 'expansion_tank',  name: 'Expansion Tank',  abbreviation: 'ET', category: 'piping_item', subcategory: 'Specialties', shape: 'circle', color: '#06b6d4', takeoffCategory: 'accessories', takeoffComponentType: 'other_accessory', unit: 'ea', iconType: 'svg:expansion_tank' },
];
