import type { ComponentType } from './takeoff';

export interface UnitPrice {
  id: string;
  componentType: ComponentType;
  description: string;
  size?: string;
  materialCostPerUnit: number;
  laborCostPerUnit: number;
  laborHoursPerUnit: number;
  unit: string;
  source: 'manual' | 'imported';
  updatedAt: Date;
}

export interface CostLineItem {
  id: string;
  bomEntryId: string;
  description: string;
  quantity: number;
  unit: string;
  materialUnitCost: number;
  laborUnitCost: number;
  materialTotal: number;
  laborTotal: number;
  lineTotal: number;
}

export interface CostConfig {
  laborRatePerHour: number;
  taxRate: number;
  overheadRate: number;
  profitRate: number;
}

export interface CostEstimate {
  id: string;
  projectName: string;
  lineItems: CostLineItem[];
  materialSubtotal: number;
  laborSubtotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  overheadRate: number;
  overheadAmount: number;
  profitRate: number;
  profitAmount: number;
  grandTotal: number;
  createdAt: Date;
  updatedAt: Date;
}
