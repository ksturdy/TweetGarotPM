/**
 * BOM Store — adapted for Titan PM.
 *
 * In Titan Takeoff, the BOM store used hardcoded rate tables via
 * lookupPipeRate/lookupFittingRate. In Titan PM, rates come from
 * PipeSpec objects loaded from the PostgreSQL API.
 *
 * The generateBom action now accepts an optional PipeSpec to
 * resolve labor hours at BOM aggregation level.
 */

import { create } from 'zustand';
import type {
  TakeoffItem,
  BOMEntry,
  UnitPrice,
  CostEstimate,
  CostConfig,
  CostLineItem,
} from '../types';
import type { JointType, FittingType, PipeMaterial } from '../types/piping';
import type { PipeSpec } from '../types/pipingSystem';
import { generateId } from '../lib/utils/idGen';
import {
  lookupPipeRateFromSpec,
  lookupFittingRateFromSpec,
} from '../lib/piping/productivityLookup';

interface BomState {
  bomEntries: BOMEntry[];
  unitPrices: UnitPrice[];
  costEstimate: CostEstimate | null;
  // Actions
  generateBom: (items: TakeoffItem[], spec?: PipeSpec) => void;
  updateUnitPrice: (id: string, updates: Partial<UnitPrice>) => void;
  addUnitPrice: (price: Omit<UnitPrice, 'id' | 'updatedAt'>) => void;
  removeUnitPrice: (id: string) => void;
  generateCostEstimate: (projectName: string, config: CostConfig) => void;
  clearBom: () => void;
  restoreState: (bomEntries: BOMEntry[], unitPrices: UnitPrice[], costEstimate: CostEstimate | null) => void;
  clearAll: () => void;
}

function bomGroupKey(item: TakeoffItem): string {
  return [
    item.category,
    item.componentType,
    item.size ?? '',
    item.material ?? '',
  ].join('|');
}

export const useBomStore = create<BomState>()((set, get) => ({
  bomEntries: [],
  unitPrices: [],
  costEstimate: null,

  generateBom: (items, spec) => {
    const groupMap = new Map<
      string,
      {
        category: TakeoffItem['category'];
        componentType: TakeoffItem['componentType'];
        description: string;
        size?: string;
        material?: string;
        quantity: number;
        unit: string;
        sourceItemIds: string[];
        pages: Set<number>;
        latestCreatedAt: number;
        jointType?: JointType;
        fittingType?: FittingType;
        pipeMaterial?: PipeMaterial;
        reducingSize?: string;
      }
    >();

    for (const item of items) {
      const key = bomGroupKey(item);
      const existing = groupMap.get(key);
      const createdTime = item.createdAt.getTime();

      if (existing) {
        existing.quantity += item.quantity;
        existing.sourceItemIds.push(item.id);
        existing.pages.add(item.pageNumber);
        if (createdTime > existing.latestCreatedAt) existing.latestCreatedAt = createdTime;
        if (!existing.jointType && item.jointType) existing.jointType = item.jointType;
        if (!existing.fittingType && item.fittingType) existing.fittingType = item.fittingType;
        if (!existing.pipeMaterial && item.pipeMaterial) existing.pipeMaterial = item.pipeMaterial;
        if (!existing.reducingSize && item.reducingSize) existing.reducingSize = item.reducingSize;
      } else {
        groupMap.set(key, {
          category: item.category,
          componentType: item.componentType,
          description: item.label,
          size: item.size,
          material: item.material,
          quantity: item.quantity,
          unit: item.unit,
          sourceItemIds: [item.id],
          pages: new Set([item.pageNumber]),
          latestCreatedAt: createdTime,
          jointType: item.jointType,
          fittingType: item.fittingType,
          pipeMaterial: item.pipeMaterial,
          reducingSize: item.reducingSize,
        });
      }
    }

    const bomEntries: BOMEntry[] = Array.from(groupMap.values())
      .sort((a, b) => b.latestCreatedAt - a.latestCreatedAt)
      .map((group) => {
        const entry: BOMEntry = {
          id: generateId(),
          category: group.category,
          componentType: group.componentType,
          description: group.description,
          size: group.size,
          material: group.material,
          quantity: group.quantity,
          unit: group.unit,
          sourceItemIds: group.sourceItemIds,
          pages: Array.from(group.pages).sort((a, b) => a - b),
          fittingType: group.fittingType,
          reducingSize: group.reducingSize,
          jointType: group.jointType,
        };

        // PipeSpec-based rate lookup at BOM level
        if (spec && group.size) {
          if (group.componentType === 'pipe_segment') {
            const result = lookupPipeRateFromSpec(spec, group.size);
            if (result.found) {
              entry.laborHoursPerUnit = result.hours;
              entry.totalLaborHours = Math.round(result.hours * group.quantity * 1000) / 1000;
            } else {
              entry.laborHoursError = result.error;
            }
          } else if (group.componentType === 'pipe_fitting' && group.fittingType) {
            const result = group.reducingSize
              ? lookupFittingRateFromSpec(spec, group.fittingType, group.size, group.reducingSize)
              : lookupFittingRateFromSpec(spec, group.fittingType, group.size);
            if (result.found) {
              entry.laborHoursPerUnit = result.hours;
              entry.totalLaborHours = Math.round(result.hours * group.quantity * 1000) / 1000;
            } else {
              entry.laborHoursError = result.error;
            }
          }
        }

        return entry;
      });

    set({ bomEntries });
  },

  updateUnitPrice: (id, updates) =>
    set({
      unitPrices: get().unitPrices.map((price) =>
        price.id === id ? { ...price, ...updates, updatedAt: new Date() } : price
      ),
    }),

  addUnitPrice: (price) => {
    const newPrice: UnitPrice = {
      ...price,
      id: generateId(),
      updatedAt: new Date(),
    };
    set({ unitPrices: [...get().unitPrices, newPrice] });
  },

  removeUnitPrice: (id) =>
    set({ unitPrices: get().unitPrices.filter((p) => p.id !== id) }),

  generateCostEstimate: (projectName, config) => {
    const { bomEntries, unitPrices } = get();

    const lineItems: CostLineItem[] = bomEntries.map((entry) => {
      const matchingPrice = unitPrices.find(
        (p) =>
          p.componentType === entry.componentType &&
          (!entry.size || !p.size || p.size === entry.size)
      );

      const materialUnitCost = matchingPrice?.materialCostPerUnit ?? 0;
      const laborUnitCost = matchingPrice?.laborCostPerUnit ?? 0;
      const materialTotal = materialUnitCost * entry.quantity;
      const laborTotal = laborUnitCost * entry.quantity;

      return {
        id: generateId(),
        bomEntryId: entry.id,
        description: entry.description,
        quantity: entry.quantity,
        unit: entry.unit,
        materialUnitCost,
        laborUnitCost,
        materialTotal,
        laborTotal,
        lineTotal: materialTotal + laborTotal,
      };
    });

    const materialSubtotal = lineItems.reduce((sum, item) => sum + item.materialTotal, 0);
    const laborSubtotal = lineItems.reduce((sum, item) => sum + item.laborTotal, 0);
    const subtotal = materialSubtotal + laborSubtotal;
    const taxAmount = subtotal * config.taxRate;
    const overheadAmount = subtotal * config.overheadRate;
    const profitAmount = subtotal * config.profitRate;
    const grandTotal = subtotal + taxAmount + overheadAmount + profitAmount;

    const now = new Date();
    const costEstimate: CostEstimate = {
      id: generateId(),
      projectName,
      lineItems,
      materialSubtotal,
      laborSubtotal,
      subtotal,
      taxRate: config.taxRate,
      taxAmount,
      overheadRate: config.overheadRate,
      overheadAmount,
      profitRate: config.profitRate,
      profitAmount,
      grandTotal,
      createdAt: now,
      updatedAt: now,
    };

    set({ costEstimate });
  },

  clearBom: () => set({ bomEntries: [], costEstimate: null }),

  restoreState: (bomEntries, unitPrices, costEstimate) =>
    set({ bomEntries, unitPrices, costEstimate }),

  clearAll: () =>
    set({ bomEntries: [], unitPrices: [], costEstimate: null }),
}));
