/**
 * Productivity Rate Lookup — adapted for Titan PM.
 *
 * All rate lookups go through PipeSpec objects (loaded from PostgreSQL API)
 * instead of the hardcoded rate tables from the standalone Titan Takeoff.
 */

import type { JointType, FittingType, PipeMaterial } from '../../types';
import type { PipeSpec, SystemFittingType } from '../../types/pipingSystem';

// ─── Result type ─────────────────────────────────────────

export type ProductivityRateResult =
  | { found: true; hours: number }
  | { found: false; error: string };

// ─── Joint method mapping ────────────────────────────────

type JointMethod = 'BW' | 'CU' | 'GRV' | 'THD';

const JOINT_TYPE_TO_METHOD: Partial<Record<JointType, JointMethod>> = {
  welded: 'BW',
  soldered_9505: 'CU',
  grooved: 'GRV',
  victaulic: 'GRV',
  threaded: 'THD',
};

export function jointTypeToMethod(jointType: JointType): JointMethod | null {
  return JOINT_TYPE_TO_METHOD[jointType] ?? null;
}

// ─── Default joint type by material ─────────────────────

const DEFAULT_MATERIAL_JOINT_TYPE: Record<PipeMaterial, JointType | null> = {
  copper_type_k: 'soldered_9505',
  copper_type_l: 'soldered_9505',
  copper_type_m: 'soldered_9505',
  carbon_steel: 'welded',
  black_steel: 'welded',
  stainless_steel: 'welded',
  galvanized_steel: 'threaded',
  cast_iron: 'grooved',
  ductile_iron: 'grooved',
  pvc_sch40: 'solvent_weld',
  pvc_sch80: 'solvent_weld',
  cpvc: 'solvent_weld',
  pex: 'press_fit',
  polypropylene: 'welded',
};

export function defaultJointTypeForMaterial(material: PipeMaterial): JointType | null {
  return DEFAULT_MATERIAL_JOINT_TYPE[material] ?? null;
}

// ─── Size normalization ──────────────────────────────────

/**
 * Normalize an app pipe size string to match the database format.
 * App format:  `1/2"`, `1-1/4"`, `2-1/2"`
 * DB format:   `1/2`,  `1 1/4`,  `2 1/2`
 */
export function normalizeSize(appSize: string): string {
  return appSize.replace(/"/g, '').replace(/-/g, ' ').trim();
}

// ─── Spec-based lookups (primary path in Titan PM) ───────

/**
 * Look up pipe rate from a PipeSpec (hours per linear foot).
 */
export function lookupPipeRateFromSpec(
  spec: PipeSpec,
  size: string,
): ProductivityRateResult {
  const normSize = normalizeSize(size);
  const hours = spec.pipeRates[normSize];
  if (hours === undefined) {
    return { found: false, error: `No pipe rate in "${spec.name}" for size "${normSize}"` };
  }
  return { found: true, hours };
}

/**
 * Map a FittingType (from traceover) to the SystemFittingType used in PipeSpec rate tables.
 */
function fittingTypeToSystemType(fittingType: FittingType): SystemFittingType | null {
  const map: Partial<Record<FittingType, SystemFittingType>> = {
    elbow_90: 'elbow_90',
    elbow_45: 'elbow_45',
    tee: 'tee',
    cap: 'cap',
    coupling: 'coupling',
    union: 'union',
    flange: 'flange_weld_neck',
  };
  return map[fittingType] ?? null;
}

/**
 * Look up fitting rate from a PipeSpec (hours per each).
 * Handles standard fittings, reducing fittings, and reducing tees.
 */
export function lookupFittingRateFromSpec(
  spec: PipeSpec,
  fittingType: FittingType,
  size: string,
  reducingSize?: string,
): ProductivityRateResult {
  const normSize = normalizeSize(size);

  // ── Reducing fitting ──
  if (reducingSize) {
    const normReducing = normalizeSize(reducingSize);

    if (fittingType === 'tee') {
      const key = `${normSize}|${normReducing}`;
      const hours = spec.reducingTeeRates[key];
      if (hours === undefined) {
        return { found: false, error: `No reducing tee rate in "${spec.name}" for ${normSize} x ${normReducing}` };
      }
      return { found: true, hours };
    }

    if (fittingType === 'elbow_90') {
      const table = spec.reducingFittingRates.elbow_90_reducing;
      if (!table) {
        return { found: false, error: `No reducing elbow rates in "${spec.name}"` };
      }
      const key = `${normSize}|${normReducing}`;
      const hours = table[key];
      if (hours === undefined) {
        return { found: false, error: `No reducing elbow rate in "${spec.name}" for ${normSize} x ${normReducing}` };
      }
      return { found: true, hours };
    }

    if (fittingType === 'reducer') {
      const key = `${normSize}|${normReducing}`;
      const concentric = spec.reducingFittingRates.reducer_concentric;
      if (concentric) {
        const hours = concentric[key];
        if (hours !== undefined) return { found: true, hours };
      }
      const eccentric = spec.reducingFittingRates.reducer_eccentric;
      if (eccentric) {
        const hours = eccentric[key];
        if (hours !== undefined) return { found: true, hours };
      }
      return { found: false, error: `No reducer rate in "${spec.name}" for ${normSize} x ${normReducing}` };
    }

    return { found: false, error: `No reducing ${fittingType} rates in "${spec.name}"` };
  }

  // ── Standard fitting ──
  const sysType = fittingTypeToSystemType(fittingType);
  if (!sysType) {
    return { found: false, error: `No rate mapping for fitting type "${fittingType}"` };
  }

  const table = spec.fittingRates[sysType];
  if (!table) {
    return { found: false, error: `No ${sysType} rates in "${spec.name}"` };
  }

  const hours = table[normSize];
  if (hours === undefined) {
    return { found: false, error: `No ${sysType} rate in "${spec.name}" for size "${normSize}"` };
  }
  return { found: true, hours };
}

// ─── Alternative fitting suggestions ─────────────────────

export interface TeeReducerCombo {
  type: 'tee_reducer_combo';
  intermediateSize: string;
  intermediateSizeDisplay: string;
  teeHours: number;
  reducerHours: number;
  totalHours: number;
}

export interface FishmouthOption {
  type: 'fishmouth';
}

export type FittingAlternative = TeeReducerCombo | FishmouthOption;

/**
 * When a reducing tee lookup fails, find alternative fitting combinations
 * using a PipeSpec's rate tables.
 */
export function findAlternativeFittingsFromSpec(
  spec: PipeSpec,
  mainSize: string,
  targetSize: string,
): FittingAlternative[] {
  const normMain = normalizeSize(mainSize);
  const normTarget = normalizeSize(targetSize);

  const alternatives: FittingAlternative[] = [];

  const concentric = spec.reducingFittingRates.reducer_concentric;

  // Find tee entries that have normMain as the main size
  for (const [key, teeHours] of Object.entries(spec.reducingTeeRates)) {
    const parts = key.split('|');
    if (parts[0] !== normMain) continue;
    const intermed = parts[parts.length - 1];
    if (intermed === normTarget || intermed === normMain) continue;

    // Check if reducer from intermediate → target exists
    if (!concentric) continue;
    const reducerKey = `${intermed}|${normTarget}`;
    const reducerHours = concentric[reducerKey];
    if (reducerHours === undefined) continue;

    alternatives.push({
      type: 'tee_reducer_combo',
      intermediateSize: intermed,
      intermediateSizeDisplay: `${intermed}"`,
      teeHours,
      reducerHours,
      totalHours: Math.round((teeHours + reducerHours) * 1000) / 1000,
    });
  }

  alternatives.sort((a, b) => {
    if (a.type !== 'tee_reducer_combo' || b.type !== 'tee_reducer_combo') return 0;
    return a.totalHours - b.totalHours;
  });

  alternatives.push({ type: 'fishmouth' });

  return alternatives;
}
