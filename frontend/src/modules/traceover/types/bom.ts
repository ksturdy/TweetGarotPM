import type { ComponentCategory, ComponentType } from './takeoff';
import type { JointType, FittingType } from './piping';

export interface BOMEntry {
  id: string;
  category: ComponentCategory;
  componentType: ComponentType;
  description: string;
  size?: string;
  material?: string;
  quantity: number;
  unit: string;
  sourceItemIds: string[];
  pages: number[];
  laborHoursPerUnit?: number;
  totalLaborHours?: number;
  laborHoursError?: string;
  materialCostPerUnit?: number;
  totalMaterialCost?: number;
  fittingType?: FittingType;
  reducingSize?: string;
  jointType?: JointType;
}

export interface BOMSection {
  category: ComponentCategory;
  label: string;
  entries: BOMEntry[];
  subtotalItems: number;
}
