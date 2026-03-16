import type { JointType, PipeMaterial, PipeServiceType } from './piping';

// ─── Joint Method (productivity table categories) ───

export type JointMethod = 'BW' | 'GRV' | 'THD' | 'CU';

export const JOINT_METHOD_LABELS: Record<JointMethod, string> = {
  BW: 'Butt Weld (BW)',
  GRV: 'Grooved (GRV)',
  THD: 'Threaded (THD)',
  CU: 'Copper Solder (CU)',
};

/** Auto-derive the traceover JointType from the spec's JointMethod */
export const JOINT_METHOD_TO_JOINT_TYPE: Record<JointMethod, JointType> = {
  BW: 'welded',
  GRV: 'grooved',
  THD: 'threaded',
  CU: 'soldered_9505',
};

/** Auto-derive the traceover PipeMaterial from the spec's SystemMaterial */
export function materialToTraceover(mat: SystemMaterial): PipeMaterial {
  switch (mat) {
    case 'carbon_steel': return 'carbon_steel';
    case 'stainless_steel': return 'stainless_steel';
    case 'copper': return 'copper_type_l';
    case 'pvc': return 'pvc_sch40';
    case 'cpvc': return 'cpvc';
    case 'cast_iron': return 'cast_iron';
    case 'ductile_iron': return 'ductile_iron';
    default: return 'carbon_steel';
  }
}

// ─── Pipe Schedule / Weight ───

export type PipeSchedule =
  | 'STD'
  | 'XH'
  | 'XXH'
  | 'SCH_5'
  | 'SCH_10'
  | 'SCH_20'
  | 'SCH_30'
  | 'SCH_40'
  | 'SCH_60'
  | 'SCH_80'
  | 'SCH_100'
  | 'SCH_120'
  | 'SCH_140'
  | 'SCH_160'
  | 'TYPE_K'
  | 'TYPE_L'
  | 'TYPE_M';

export const PIPE_SCHEDULE_LABELS: Record<PipeSchedule, string> = {
  STD: 'Standard Weight',
  XH: 'Extra Heavy',
  XXH: 'Double Extra Heavy',
  SCH_5: 'Schedule 5',
  SCH_10: 'Schedule 10',
  SCH_20: 'Schedule 20',
  SCH_30: 'Schedule 30',
  SCH_40: 'Schedule 40',
  SCH_60: 'Schedule 60',
  SCH_80: 'Schedule 80',
  SCH_100: 'Schedule 100',
  SCH_120: 'Schedule 120',
  SCH_140: 'Schedule 140',
  SCH_160: 'Schedule 160',
  TYPE_K: 'Type K',
  TYPE_L: 'Type L',
  TYPE_M: 'Type M',
};

// ─── System Material ───

export type SystemMaterial =
  | 'carbon_steel'
  | 'stainless_steel'
  | 'copper'
  | 'pvc'
  | 'cpvc'
  | 'cast_iron'
  | 'ductile_iron';

export const SYSTEM_MATERIAL_LABELS: Record<SystemMaterial, string> = {
  carbon_steel: 'Carbon Steel',
  stainless_steel: 'Stainless Steel',
  copper: 'Copper',
  pvc: 'PVC',
  cpvc: 'CPVC',
  cast_iron: 'Cast Iron',
  ductile_iron: 'Ductile Iron',
};

// ─── System Fitting Types ───

export type SystemFittingType =
  // Standard fittings
  | 'elbow_90'
  | 'elbow_45'
  | 'tee'
  | 'cap'
  | 'coupling'
  | 'cross'
  | 'lateral'
  | 'stub_end'
  | 'union'
  // Flanges
  | 'flange_blind'
  | 'flange_lap_joint'
  | 'flange_plate'
  | 'flange_plate_split'
  | 'flange_slip_on'
  | 'flange_socket_weld'
  | 'flange_threaded'
  | 'flange_weld_neck'
  // Olets
  | 'weldolet'
  | 'threadolet'
  | 'sockolet'
  | 'latrolet'
  // Valves
  | 'valve_gate'
  | 'valve_globe'
  | 'valve_ball'
  | 'valve_butterfly'
  | 'valve_butterfly_gear'
  | 'valve_check';

export const SYSTEM_FITTING_TYPE_LABELS: Record<SystemFittingType, string> = {
  // Standard
  elbow_90: '90° Elbow',
  elbow_45: '45° Elbow',
  tee: 'Tee',
  cap: 'Cap',
  coupling: 'Coupling',
  cross: 'Cross',
  lateral: 'Lateral',
  stub_end: 'Stub End',
  union: 'Union',
  // Flanges
  flange_blind: 'Blind Flange',
  flange_lap_joint: 'Lap Joint Flange',
  flange_plate: 'Plate Flange',
  flange_plate_split: 'Plate Split Flange',
  flange_slip_on: 'Slip-On Flange',
  flange_socket_weld: 'Socket Weld Flange',
  flange_threaded: 'Threaded Flange',
  flange_weld_neck: 'Weld Neck Flange',
  // Olets
  weldolet: 'Weldolet',
  threadolet: 'Threadolet',
  sockolet: 'Sockolet',
  latrolet: 'Latrolet',
  // Valves
  valve_gate: 'Gate Valve',
  valve_globe: 'Globe Valve',
  valve_ball: 'Ball Valve',
  valve_butterfly: 'Butterfly Valve',
  valve_butterfly_gear: 'Butterfly Valve (Gear)',
  valve_check: 'Check Valve',
};

export const SYSTEM_FITTING_TYPES: SystemFittingType[] = [
  'elbow_90', 'elbow_45', 'tee', 'cap', 'coupling', 'cross', 'lateral', 'stub_end', 'union',
  'flange_blind', 'flange_lap_joint', 'flange_plate', 'flange_plate_split', 'flange_slip_on', 'flange_socket_weld', 'flange_threaded', 'flange_weld_neck',
  'weldolet', 'threadolet', 'sockolet', 'latrolet',
  'valve_gate', 'valve_globe', 'valve_ball', 'valve_butterfly', 'valve_butterfly_gear', 'valve_check',
];

// ─── Fitting Type Groups (for UI sub-tabs) ───

export type FittingTypeGroup = 'standard' | 'flanges' | 'olets' | 'valves';

export const FITTING_TYPE_GROUPS: { key: FittingTypeGroup; label: string; types: SystemFittingType[] }[] = [
  { key: 'standard', label: 'Standard', types: ['elbow_90', 'elbow_45', 'tee', 'cap', 'coupling', 'cross', 'lateral', 'stub_end', 'union'] },
  { key: 'flanges', label: 'Flanges', types: ['flange_blind', 'flange_lap_joint', 'flange_plate', 'flange_plate_split', 'flange_slip_on', 'flange_socket_weld', 'flange_threaded', 'flange_weld_neck'] },
  { key: 'olets', label: 'Olets', types: ['weldolet', 'threadolet', 'sockolet', 'latrolet'] },
  { key: 'valves', label: 'Valves', types: ['valve_gate', 'valve_globe', 'valve_ball', 'valve_butterfly', 'valve_butterfly_gear', 'valve_check'] },
];

// ─── Reducing Fitting Types ───

export type ReducingFittingType =
  | 'elbow_90_reducing'
  | 'reducer_concentric'
  | 'reducer_eccentric';

export const REDUCING_FITTING_TYPE_LABELS: Record<ReducingFittingType, string> = {
  elbow_90_reducing: '90° Elbow Reducing',
  reducer_concentric: 'Reducer Concentric',
  reducer_eccentric: 'Reducer Eccentric',
};

export const REDUCING_FITTING_TYPES: ReducingFittingType[] = [
  'elbow_90_reducing', 'reducer_concentric', 'reducer_eccentric',
];

// ─── Pipe Spec (matches database pipe_specs table) ───

export interface PipeSpec {
  id: string;
  name: string;
  jointMethod: JointMethod;
  material: SystemMaterial;
  stockPipeLength: number;
  pipeRates: Record<string, number>;
  fittingRates: Record<string, Record<string, number>>;
  reducingFittingRates: Partial<Record<ReducingFittingType, Record<string, number>>>;
  reducingTeeRates: Record<string, number>;
  crossReducingRates: Record<string, number>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Derive the traceover JointType from a spec */
export function specJointType(spec: PipeSpec): JointType {
  return JOINT_METHOD_TO_JOINT_TYPE[spec.jointMethod];
}

/** Derive the traceover PipeMaterial from a spec */
export function specPipeMaterial(spec: PipeSpec): PipeMaterial {
  return materialToTraceover(spec.material);
}

// ─── Service Size Rule ───

export interface ServiceSizeRule {
  id: string;
  maxSizeInches: number;
  pipeSpecId: string;
}

// ─── Piping Service (Global) ───

export interface PipingService {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  serviceCategory: PipeServiceType;
  sizeRules: ServiceSizeRule[];
  defaultPipeSpecId: string;
  fittingTypes: string[];
  valveTypes: string[];
  accessories: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Project System (Per-Takeoff) ───

export interface ProjectSystem {
  id: string;
  name: string;
  abbreviation: string;
  serviceId: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Rate Tables ───

export interface RateTableColumn {
  id: string;
  columnKey: string;
  columnLabel: string;
  sortOrder: number;
  rates: Record<string, number>;
}

export interface RateTable {
  id: string;
  name: string;
  category: string;
  notes: string;
  columns: RateTableColumn[];
  createdAt: string;
  updatedAt: string;
}

export const RATE_TABLE_CATEGORIES = [
  'fittings', 'flanges', 'flanges_orifice', 'valves', 'branch_connections',
  'pipe', 'joints', 'hydrotesting', 'preheat', 'stress_relieving',
  'tig_root', 'cut_tables', 'drilling_holes', 'machine_bevel', 'nipples',
  'hvac_specialties', 'plumbing_specialties', 'refrigeration_specialties',
  'other',
] as const;

export type RateTableCategory = (typeof RATE_TABLE_CATEGORIES)[number];

export const RATE_TABLE_CATEGORY_LABELS: Record<RateTableCategory, string> = {
  fittings: 'Fittings',
  flanges: 'Flanges',
  flanges_orifice: 'Flanges Orifice',
  valves: 'Valves',
  branch_connections: 'Branch Connections',
  pipe: 'Pipe',
  joints: 'Joints',
  hydrotesting: 'Hydrotesting',
  preheat: 'Preheat',
  stress_relieving: 'Stress Relieving',
  tig_root: 'TIG Root',
  cut_tables: 'Cut Tables',
  drilling_holes: 'Drilling Holes',
  machine_bevel: 'Machine Bevel',
  nipples: 'Nipples',
  hvac_specialties: 'HVAC Specialties',
  plumbing_specialties: 'Plumbing Specialties',
  refrigeration_specialties: 'Refrigeration Specialties',
  other: 'Other',
};

// ─── System Presets ───

export const SYSTEM_PRESETS: Record<PipeServiceType, { name: string; abbreviation: string; color: string }> = {
  heating_water: { name: 'Heating Water', abbreviation: 'HW', color: '#ef4444' },
  chilled_water: { name: 'Chilled Water', abbreviation: 'CHW', color: '#06b6d4' },
  condenser_water: { name: 'Condenser Water', abbreviation: 'CW', color: '#14b8a6' },
  refrigerant_liquid: { name: 'Refrigerant Liquid', abbreviation: 'RL', color: '#ec4899' },
  refrigerant_suction: { name: 'Refrigerant Suction', abbreviation: 'RS', color: '#f472b6' },
  refrigerant_hot_gas: { name: 'Refrigerant Hot Gas', abbreviation: 'RHG', color: '#f97316' },
  condensate: { name: 'Condensate', abbreviation: 'COND', color: '#84cc16' },
  steam: { name: 'Steam', abbreviation: 'STM', color: '#f97316' },
  natural_gas: { name: 'Natural Gas', abbreviation: 'NG', color: '#eab308' },
  fuel_oil: { name: 'Fuel Oil', abbreviation: 'FO', color: '#a3a3a3' },
  domestic_hot: { name: 'Domestic Hot Water', abbreviation: 'DHW', color: '#dc2626' },
  domestic_cold: { name: 'Domestic Cold Water', abbreviation: 'DCW', color: '#2563eb' },
  other: { name: 'Other', abbreviation: 'OTH', color: '#10b981' },
};

// ─── Helpers ───

export function resolveSpecIdForSize(
  service: PipingService,
  sizeInches: number,
): string {
  for (const rule of service.sizeRules) {
    if (sizeInches <= rule.maxSizeInches) {
      return rule.pipeSpecId;
    }
  }
  return service.defaultPipeSpecId;
}

export function resolveSpecIdForSystem(
  system: ProjectSystem,
  services: PipingService[],
  sizeInches: number,
): string | undefined {
  const service = services.find((s) => s.id === system.serviceId);
  if (!service) return undefined;
  return resolveSpecIdForSize(service, sizeInches);
}
