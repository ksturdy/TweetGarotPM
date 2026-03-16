import type { PlaceableItemDef } from '../types/placeableItem';

export const EQUIPMENT_CATALOG: PlaceableItemDef[] = [
  // ─── Air Handling ───
  { id: 'equip_ahu',  name: 'Air Handling Unit', abbreviation: 'AHU',  category: 'equipment', subcategory: 'Air Handling', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'AHU',  unit: 'ea', iconType: 'svg:ahu' },
  { id: 'equip_rtu',  name: 'Rooftop Unit',      abbreviation: 'RTU',  category: 'equipment', subcategory: 'Air Handling', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'RTU',  unit: 'ea', iconType: 'svg:rtu' },
  { id: 'equip_crac', name: 'CRAC Unit',          abbreviation: 'CRAC', category: 'equipment', subcategory: 'Air Handling', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'CRAC', unit: 'ea', iconType: 'svg:crac' },
  { id: 'equip_mau',  name: 'Makeup Air Unit',    abbreviation: 'MAU',  category: 'equipment', subcategory: 'Air Handling', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'MAU',  unit: 'ea', iconType: 'svg:mau' },

  // ─── Terminal Units ───
  { id: 'equip_vav', name: 'VAV Box',       abbreviation: 'VAV', category: 'equipment', subcategory: 'Terminal Units', shape: 'rectangle', color: '#f59e0b', takeoffCategory: 'equipment', takeoffComponentType: 'VAV', unit: 'ea', iconType: 'svg:vav' },
  { id: 'equip_fcu', name: 'Fan Coil Unit', abbreviation: 'FCU', category: 'equipment', subcategory: 'Terminal Units', shape: 'rectangle', color: '#f59e0b', takeoffCategory: 'equipment', takeoffComponentType: 'FCU', unit: 'ea', iconType: 'svg:fcu' },

  // ─── Chillers & Cooling ───
  { id: 'equip_chiller',       name: 'Chiller',       abbreviation: 'CH', category: 'equipment', subcategory: 'Chillers & Cooling', shape: 'rectangle', color: '#3b82f6', takeoffCategory: 'equipment', takeoffComponentType: 'chiller',       unit: 'ea', iconType: 'svg:chiller' },
  { id: 'equip_cooling_tower', name: 'Cooling Tower', abbreviation: 'CT', category: 'equipment', subcategory: 'Chillers & Cooling', shape: 'rectangle', color: '#3b82f6', takeoffCategory: 'equipment', takeoffComponentType: 'cooling_tower', unit: 'ea', iconType: 'svg:cooling_tower' },

  // ─── Heating ───
  { id: 'equip_boiler',         name: 'Boiler',         abbreviation: 'BLR',  category: 'equipment', subcategory: 'Heating', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'boiler',         unit: 'ea', iconType: 'svg:boiler' },
  { id: 'equip_heat_exchanger', name: 'Heat Exchanger', abbreviation: 'HX',   category: 'equipment', subcategory: 'Heating', shape: 'rectangle', color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'heat_exchanger', unit: 'ea', iconType: 'svg:heat_exchanger' },
  { id: 'equip_coil',           name: 'Coil',           abbreviation: 'COIL', category: 'equipment', subcategory: 'Heating', shape: 'circle',    color: '#ef4444', takeoffCategory: 'equipment', takeoffComponentType: 'coil',           unit: 'ea', iconType: 'svg:coil' },

  // ─── Pumps ───
  { id: 'equip_pump', name: 'Pump', abbreviation: 'PMP', category: 'equipment', subcategory: 'Pumps', shape: 'circle', color: '#10b981', takeoffCategory: 'equipment', takeoffComponentType: 'pump', unit: 'ea', iconType: 'svg:pump' },
  { id: 'equip_vfd',  name: 'VFD',  abbreviation: 'VFD', category: 'equipment', subcategory: 'Pumps', shape: 'rectangle', color: '#10b981', takeoffCategory: 'equipment', takeoffComponentType: 'VFD',  unit: 'ea', iconType: 'svg:vfd' },

  // ─── Fans ───
  { id: 'equip_exhaust_fan', name: 'Exhaust Fan', abbreviation: 'EF', category: 'equipment', subcategory: 'Fans', shape: 'circle', color: '#8b5cf6', takeoffCategory: 'equipment', takeoffComponentType: 'exhaust_fan', unit: 'ea', iconType: 'svg:exhaust_fan' },
  { id: 'equip_supply_fan',  name: 'Supply Fan',  abbreviation: 'SF', category: 'equipment', subcategory: 'Fans', shape: 'circle', color: '#8b5cf6', takeoffCategory: 'equipment', takeoffComponentType: 'supply_fan',  unit: 'ea', iconType: 'svg:supply_fan' },

  // ─── Heat Pumps ───
  { id: 'equip_heat_pump', name: 'Heat Pump', abbreviation: 'HP', category: 'equipment', subcategory: 'Heat Pumps', shape: 'rectangle', color: '#ec4899', takeoffCategory: 'equipment', takeoffComponentType: 'heat_pump', unit: 'ea', iconType: 'svg:heat_pump' },
];
