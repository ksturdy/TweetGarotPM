import type { Point2D } from './measurement';
import type {
  TraceoverConfig, TraceoverSegment, BranchConnection,
  FittingType, PipeSize, JointType, PipeMaterial,
} from './piping';
import type { ComponentCategory, ComponentType } from './takeoff';
import type { PlacedItemRenderMeta } from './placeableItem';

// ─── Assembly Template Types ───

export interface AssemblyRun {
  localId: string;
  config: TraceoverConfig;
  segments: TraceoverSegment[];
  branches: AssemblyBranch[];
  fittingCounts: Record<FittingType, number>;
  totalScaledLength: number;
  totalPixelLength: number;
  verticalPipeLength: number;
  branchParentPipeSize: PipeSize | null;
}

export interface AssemblyBranch {
  id: string;
  parentLocalRunId: string;
  parentSegmentId: string;
  connectionPoint: Point2D;
  direction: 'top' | 'bottom';
  childLocalRunId: string;
  teeId: string;
  parentPipeSize: PipeSize;
}

export interface AssemblyPlacedItem {
  localId: string;
  category: ComponentCategory;
  componentType: ComponentType;
  label: string;
  description: string;
  size?: string;
  material?: string;
  unit: string;
  relativePosition: Point2D;
  renderMeta: PlacedItemRenderMeta;
  snapLocalRunId?: string;
  snapSegmentId?: string;
  fittingType?: FittingType;
  jointType?: JointType;
  pipeMaterial?: PipeMaterial;
}

export interface AssemblyConnectionPoint {
  id: string;
  relativePosition: Point2D;
  localRunId: string;
  endpoint: 'start' | 'end';
  label: string;
}

export interface AssemblyDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  boundingBox: { width: number; height: number };
  runs: AssemblyRun[];
  placedItems: AssemblyPlacedItem[];
  connectionPoints: AssemblyConnectionPoint[];
  thumbnailDataUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssemblyInstance {
  id: string;
  assemblyId: string;
  assemblyName: string;
  origin: Point2D;
  documentId: string;
  pageNumber: number;
  runIds: string[];
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}
