/**
 * PipeSpec resolution for traceover runs.
 *
 * Extracted as a standalone utility so it can be used from both PdfViewer
 * (interactive) and the PDF/XLSX export functions (non-component context).
 */

import type { TraceoverRun } from '../../types/piping';
import type { PipeSpec } from '../../types/pipingSystem';
import { resolveSpecIdForSize } from '../../types/pipingSystem';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { normalizeSize } from './productivityLookup';

/**
 * Fallback: find the best PipeSpec from ALL available specs that has
 * pipe rates matching the given size. Used when normal resolution
 * (direct spec / system / service chain) fails.
 */
function findSpecWithRateForSize(size: string): PipeSpec | undefined {
  const specs = useSettingsStore.getState().pipeSpecs;
  const normSize = normalizeSize(size);
  for (const spec of specs) {
    if (spec.pipeRates[normSize] !== undefined) return spec;
  }
  return undefined;
}

/**
 * Resolve the PipeSpec for a traceover run via its config.
 * Uses the current state of the settings store (works outside React components).
 */
export function resolveSpecForRun(run: TraceoverRun): PipeSpec | undefined {
  const settings = useSettingsStore.getState();

  // Direct spec reference (set when user picks a spec or system resolves one)
  if (run.config.pipeSpecId) {
    const spec = settings.getPipeSpec(run.config.pipeSpecId);
    if (spec) return spec;
  }

  // System -> service -> spec chain
  if (run.config.projectSystemId) {
    const system = settings.getSystem(run.config.projectSystemId);
    if (system) {
      const service = settings.getService(system.serviceId);
      if (service) {
        const specId = resolveSpecIdForSize(service, run.config.pipeSize.nominalInches);
        const spec = settings.getPipeSpec(specId);
        if (spec) return spec;
      }
    }
  }

  // Legacy fallback: old runs with pipingServiceId pointing directly to a service
  if (run.config.pipingServiceId) {
    const service = settings.getService(run.config.pipingServiceId);
    if (service) {
      const specId = resolveSpecIdForSize(service, run.config.pipeSize.nominalInches);
      const spec = settings.getPipeSpec(specId);
      if (spec) return spec;
    }
  }

  // Last-resort fallback: find any spec with rates for this pipe size
  return findSpecWithRateForSize(run.config.pipeSize.nominal);
}
