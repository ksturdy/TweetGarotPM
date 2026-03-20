/**
 * Cost enrichment for takeoff items at export time.
 *
 * When items are generated from traceover runs, they snapshot the PipeSpec's
 * cost data at that moment. If the user later imports EST catalog costs, the
 * existing items won't reflect the new pricing. This module re-looks up
 * material costs from the *current* PipeSpec data at export time so exports
 * always show up-to-date pricing.
 */

import type { TakeoffItem } from '../../types/takeoff';
import type { TraceoverRun } from '../../types/piping';
import type { PipeSpec } from '../../types/pipingSystem';
import { resolveSpecForRun } from '../piping/specResolver';
import { useSettingsStore } from '../../stores/useSettingsStore';
import {
  lookupPipeCostFromSpec,
  lookupFittingCostFromSpec,
  lookupPipeRateFromSpec,
  lookupFittingRateFromSpec,
  normalizeSize,
} from '../piping/productivityLookup';

/**
 * Fallback: find the best spec from ALL available specs that has a cost
 * matching the given pipe size. Used when normal spec resolution fails.
 */
function findSpecWithCostForSize(size: string): PipeSpec | undefined {
  const specs = useSettingsStore.getState().pipeSpecs;
  const normSize = normalizeSize(size);
  for (const spec of specs) {
    if (spec.pipeCosts?.[normSize] !== undefined) return spec;
    // Also check fitting costs
    if (spec.fittingCosts) {
      for (const table of Object.values(spec.fittingCosts)) {
        if (table[normSize] !== undefined) return spec;
      }
    }
  }
  return undefined;
}

/**
 * Returns a new array of TakeoffItems with material costs (and labor hours)
 * re-looked up from the current PipeSpec data in the settings store.
 */
export function enrichItemsWithCurrentCosts(
  items: TakeoffItem[],
  runs: TraceoverRun[],
): TakeoffItem[] {
  const runMap = new Map(runs.map((r) => [r.id, r]));

  // Cache resolved specs by run ID to avoid redundant lookups
  const specCache = new Map<string, PipeSpec | undefined>();
  function getSpec(runId: string, size?: string) {
    if (specCache.has(runId)) return specCache.get(runId);
    const run = runMap.get(runId);
    // Primary path: resolve via run config → system → service → spec
    let spec = run ? resolveSpecForRun(run) : undefined;
    // Fallback: if resolution fails, find any spec with costs for this size
    if (!spec && size) {
      spec = findSpecWithCostForSize(size);
    }
    specCache.set(runId, spec);
    return spec;
  }

  return items.map((item) => {
    if (!item.traceoverRunId || !item.size) return item;

    const spec = getSpec(item.traceoverRunId, item.size);
    if (!spec) return item;

    let materialCost: number | undefined = item.materialCost;
    let materialCostTotal: number | undefined = item.materialCostTotal;
    let laborHours: number | undefined = item.laborHours;

    if (item.componentType === 'pipe_segment') {
      const costResult = lookupPipeCostFromSpec(spec, item.size);
      if (costResult.found) {
        materialCost = costResult.cost;
        materialCostTotal = Math.round(costResult.cost * item.quantity * 100) / 100;
      }
      // Also refresh labor hours in case rates were updated
      const rateResult = lookupPipeRateFromSpec(spec, item.size);
      if (rateResult.found) {
        laborHours = Math.round(rateResult.hours * item.quantity * 1000) / 1000;
      }
    } else if (item.componentType === 'pipe_fitting' && item.fittingType) {
      const costResult = item.reducingSize
        ? lookupFittingCostFromSpec(spec, item.fittingType, item.size, item.reducingSize)
        : lookupFittingCostFromSpec(spec, item.fittingType, item.size);
      if (costResult.found) {
        materialCost = costResult.cost;
        materialCostTotal = Math.round(costResult.cost * item.quantity * 100) / 100;
      }
      // Also refresh labor hours
      const rateResult = item.reducingSize
        ? lookupFittingRateFromSpec(spec, item.fittingType, item.size, item.reducingSize)
        : lookupFittingRateFromSpec(spec, item.fittingType, item.size);
      if (rateResult.found) {
        laborHours = Math.round(rateResult.hours * item.quantity * 1000) / 1000;
      }
    }

    // Only create new object if something changed
    if (
      materialCost === item.materialCost &&
      materialCostTotal === item.materialCostTotal &&
      laborHours === item.laborHours
    ) {
      return item;
    }

    return { ...item, materialCost, materialCostTotal, laborHours };
  });
}
