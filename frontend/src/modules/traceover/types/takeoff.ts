import type { Point2D } from './measurement';
import type { JointType, FittingType, PipeMaterial } from './piping';

export type ComponentCategory =
  | 'equipment'
  | 'ductwork'
  | 'piping'
  | 'terminal_devices'
  | 'accessories';

export type EquipmentType =
  | 'AHU' | 'RTU' | 'VAV' | 'FCU' | 'heat_pump'
  | 'boiler' | 'chiller' | 'exhaust_fan' | 'pump'
  | 'cooling_tower' | 'CRAC' | 'heat_exchanger' | 'coil'
  | 'VFD' | 'MAU' | 'supply_fan' | 'other_equipment';

export type DuctworkType =
  | 'rectangular' | 'round' | 'flex' | 'oval'
  | 'duct_fitting' | 'other_ductwork';

export type PipingType =
  | 'refrigerant' | 'hydronic' | 'condensate'
  | 'steam' | 'gas' | 'pipe_fitting' | 'pipe_segment'
  | 'other_piping';

export type TerminalDeviceType =
  | 'diffuser' | 'grille' | 'register' | 'louver'
  | 'other_terminal';

export type AccessoryType =
  | 'damper' | 'valve' | 'control' | 'thermostat'
  | 'sensor' | 'filter' | 'other_accessory';

export type ComponentType =
  | EquipmentType
  | DuctworkType
  | PipingType
  | TerminalDeviceType
  | AccessoryType;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TakeoffItem {
  id: string;
  documentId: string;
  pageNumber: number;
  category: ComponentCategory;
  componentType: ComponentType;
  label: string;
  description: string;
  quantity: number;
  unit: string;
  size?: string;
  capacity?: string;
  material?: string;
  boundingBox?: BoundingBox;
  centerPoint?: Point2D;
  source: 'ai' | 'manual' | 'traceover';
  confidence?: number;
  aiNotes?: string;
  verified: boolean;
  userNotes?: string;
  traceoverRunId?: string;
  jointType?: JointType;
  fittingType?: FittingType;
  pipeMaterial?: PipeMaterial;
  reducingSize?: string;
  laborHours?: number;
  laborHoursError?: string;
  alternateId?: string | null;
  addendumId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  equipment: 'Equipment',
  ductwork: 'Ductwork',
  piping: 'Piping',
  terminal_devices: 'Terminal Devices',
  accessories: 'Accessories',
};

export const CATEGORY_COLORS: Record<ComponentCategory, string> = {
  equipment: '#ef4444',
  ductwork: '#3b82f6',
  piping: '#10b981',
  terminal_devices: '#f59e0b',
  accessories: '#8b5cf6',
};
