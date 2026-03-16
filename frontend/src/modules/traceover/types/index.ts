export type { PdfDocument, PdfPageMeta } from './pdf';
export type { Point2D, MeasurementUnit, ScaleCalibration, Measurement } from './measurement';
export type {
  ComponentCategory, ComponentType, EquipmentType, DuctworkType,
  PipingType, TerminalDeviceType, AccessoryType, BoundingBox, TakeoffItem,
} from './takeoff';
export { CATEGORY_LABELS, CATEGORY_COLORS } from './takeoff';
export type { BOMEntry, BOMSection } from './bom';
export type { UnitPrice, CostLineItem, CostConfig, CostEstimate } from './cost';
export type { ToolType, CanvasViewport, ActiveDrawing } from './canvas';
export type {
  PlaceableItemDef, PlaceableItemShape, PlaceableItemCategory, PlacedItemRenderMeta,
} from './placeableItem';
export type {
  AiAnalysisRequest, AiDetectedComponent, AiAnalysisResponse, AiAnalysisStatus,
} from './ai';
export type {
  PipeMaterial, PipeServiceType, JointType, FittingType, BranchDirection,
  PipeSize, JointSpecRule, JointSpecFamily, TraceoverConfig, TraceoverSegment,
  BranchConnection, TraceoverRun, ActiveTraceover, BranchSnapResult, RunningTotals,
} from './piping';
export type {
  PageMetadata, BuildingLevel, BuildingArea, AlternateGroup, AddendumGroup, PageKey,
} from './pageMetadata';
export { makePageKey, parsePageKey, DEFAULT_PAGE_METADATA } from './pageMetadata';
export type {
  AssemblyRun, AssemblyBranch, AssemblyPlacedItem, AssemblyConnectionPoint,
  AssemblyDefinition, AssemblyInstance,
} from './assembly';
export type {
  JointMethod, PipeSchedule, SystemMaterial, SystemFittingType, ReducingFittingType,
  PipeSpec, ServiceSizeRule, PipingService, ProjectSystem,
} from './pipingSystem';
export {
  JOINT_METHOD_LABELS, PIPE_SCHEDULE_LABELS, SYSTEM_MATERIAL_LABELS,
  SYSTEM_FITTING_TYPE_LABELS, SYSTEM_FITTING_TYPES,
  REDUCING_FITTING_TYPE_LABELS, REDUCING_FITTING_TYPES,
  SYSTEM_PRESETS, resolveSpecIdForSize, resolveSpecIdForSystem,
} from './pipingSystem';
export { LEGACY_SERVICE_TYPE_MAP, migrateServiceType } from './piping';
