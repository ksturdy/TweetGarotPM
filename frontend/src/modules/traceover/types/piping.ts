import type { Point2D, MeasurementUnit } from './measurement';

// ─── Reference Data Types ───

export type PipeMaterial =
  | 'copper_type_l'
  | 'copper_type_m'
  | 'copper_type_k'
  | 'black_steel'
  | 'galvanized_steel'
  | 'stainless_steel'
  | 'pvc_sch40'
  | 'pvc_sch80'
  | 'cpvc'
  | 'cast_iron'
  | 'ductile_iron'
  | 'pex'
  | 'polypropylene'
  | 'carbon_steel';

export type PipeServiceType =
  | 'heating_water'
  | 'chilled_water'
  | 'condenser_water'
  | 'refrigerant_liquid'
  | 'refrigerant_suction'
  | 'refrigerant_hot_gas'
  | 'condensate'
  | 'steam'
  | 'natural_gas'
  | 'fuel_oil'
  | 'domestic_hot'
  | 'domestic_cold'
  | 'other';

/** Maps old supply/return service type values to their collapsed equivalents */
export const LEGACY_SERVICE_TYPE_MAP: Record<string, PipeServiceType> = {
  hydronic_supply: 'heating_water',
  hydronic_return: 'heating_water',
  chilled_water_supply: 'chilled_water',
  chilled_water_return: 'chilled_water',
  condenser_water_supply: 'condenser_water',
  condenser_water_return: 'condenser_water',
  steam_supply: 'steam',
  steam_return: 'steam',
};

/** Migrate a raw service type string to the current PipeServiceType enum */
export function migrateServiceType(raw: string): PipeServiceType {
  return (LEGACY_SERVICE_TYPE_MAP[raw] ?? raw) as PipeServiceType;
}

export type JointType =
  | 'soldered_9505'
  | 'soldered_5050'
  | 'brazed'
  | 'welded'
  | 'threaded'
  | 'grooved'
  | 'press_fit'
  | 'solvent_weld'
  | 'flanged'
  | 'compression'
  | 'push_fit'
  | 'victaulic';

export type FittingType =
  | 'elbow_90'
  | 'elbow_45'
  | 'tee'
  | 'reducer'
  | 'coupling'
  | 'cap'
  | 'union'
  | 'flange'
  | 'fishmouth';

export type BranchDirection = 'top' | 'bottom';

// ─── Pipe Size ───

export interface PipeSize {
  nominal: string;
  nominalInches: number;
  displayLabel: string;
}

// ─── Joint Spec Family ───

export interface JointSpecRule {
  id: string;
  maxSizeInches: number;
  jointType: JointType;
}

export interface JointSpecFamily {
  id: string;
  name: string;
  material: PipeMaterial;
  rules: JointSpecRule[];
  defaultJointType: JointType;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Traceover Configuration ───

export interface TraceoverConfig {
  material: PipeMaterial;
  pipeSize: PipeSize;
  serviceType: PipeServiceType;
  /** @deprecated Use projectSystemId instead */
  jointSpecFamilyId: string | null;
  /** @deprecated Use projectSystemId instead */
  pipingServiceId: string | null;
  /** ID of the ProjectSystem (per-project) driving this config */
  projectSystemId: string | null;
  color: string;
  label: string;
  startingElevation: number;
}

// ─── Traceover Segment ───

export interface TraceoverSegment {
  id: string;
  startPoint: Point2D;
  endPoint: Point2D;
  pixelLength: number;
  scaledLength: number;
  unit: MeasurementUnit | 'px';
  angleRad: number;
  angleFromPrevious: number | null;
  fitting: FittingType | null;
  jointType: JointType | null;
  /** Elevation (height) at the endpoint of this segment, in the calibration unit. */
  elevation: number;
}

// ─── Branch Connection ───

export interface BranchConnection {
  id: string;
  parentRunId: string;
  parentSegmentId: string;
  connectionPoint: Point2D;
  direction: BranchDirection;
  childRunId: string;
  teeId: string;
  /** Parent run's pipe size — used for reducing tee labels (e.g., 12x12x4). */
  parentPipeSize: PipeSize;
}

// ─── Traceover Run ───

export interface TraceoverRun {
  id: string;
  /** Server-side DB ID (from traceover_runs table) */
  serverId?: number;
  documentId: string;
  pageNumber: number;
  config: TraceoverConfig;
  segments: TraceoverSegment[];
  branches: BranchConnection[];
  isComplete: boolean;
  totalPixelLength: number;
  totalScaledLength: number;
  /** Additional vertical pipe length from elevation changes. */
  verticalPipeLength: number;
  fittingCounts: Record<FittingType, number>;
  generatedTakeoffItemIds: string[];
  /** If this run is a branch, the parent run's pipe size for reducing tee labeling. */
  branchParentPipeSize: PipeSize | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Active Traceover (in-progress) ───

export interface ActiveTraceover {
  config: TraceoverConfig;
  points: Point2D[];
  segments: TraceoverSegment[];
  snappedCursorPos: Point2D | null;
  /** Current working elevation — applied to the next segment added. */
  currentElevation: number;
  branchConnection: {
    parentRunId: string;
    parentSegmentId: string;
    connectionPoint: Point2D;
    direction: BranchDirection;
    parentPipeSize: PipeSize;
  } | null;
}

// ─── Branch snap result ───

export interface BranchSnapResult {
  runId: string;
  segmentId: string;
  connectionPoint: Point2D;
  distance: number;
}

// ─── Floating Running Totals ───

export interface RunningTotals {
  totalLength: number;
  unit: string;
  elbow90Count: number;
  elbow45Count: number;
  teeCount: number;
  jointType: JointType | null;
  material: string;
  pipeSize: string;
}
