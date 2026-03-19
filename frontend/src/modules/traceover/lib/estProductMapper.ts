import type { SystemFittingType, ReducingFittingType, JointMethod, SystemMaterial } from '../types/pipingSystem';

// ─── EST Product shape from the API ───

export interface EstProductRate {
  size: string;
  size_normalized: string;
  labor_time: number;
  product_id: string;
  product: string;
  description: string;
  group_name?: string;
  cost?: number | null;
}

export interface EstRatesForSpec {
  pipeRates: EstProductRate[];
  fittingProducts: EstProductRate[];
  schedules: string[];
  summary: { total: number; perFt: number; perEach: number };
}

// ─── Fitting type detection from product description ───

export type DetectedCategory = 'fitting' | 'reducing' | 'reducing_tee' | 'unknown';

export type DetectedType =
  | { kind: 'fitting'; type: SystemFittingType }
  | { kind: 'reducing'; type: ReducingFittingType; mainSize?: string; reducingSize?: string }
  | { kind: 'reducing_tee' }
  | { kind: 'unknown' };

// ── Reducing patterns (checked first — more specific) ──

const REDUCING_PATTERNS: [RegExp, ReducingFittingType | 'reducing_tee'][] = [
  // Reducing tees: "CS Reducing Tee", "CS Tee Reducing"
  [/\breducing\b.*\btee\b|\btee\b.*\breducing\b/i, 'reducing_tee'],
  // Reducing elbows: "CS Reducing Elbow 90", "CS Elbow 90 Red."
  [/\breducing\b.*\b(90|90°)?\s*(elbow|ell)\b/i, 'elbow_90_reducing'],
  [/\b(elbow|ell)\b.*\b(90|90°)\b.*\bred\.?\b/i, 'elbow_90_reducing'],
  [/\belbow\b.*\bred\b/i, 'elbow_90_reducing'],
  // Concentric reducer (incl. "Recucer" typo in data)
  [/\b(reducer|recucer)\b.*\bconcentric\b|\bconcentric\b.*\b(reducer|recucer)\b/i, 'reducer_concentric'],
  // Eccentric reducer
  [/\b(reducer|recucer)\b.*\beccentric\b|\beccentric\b.*\b(reducer|recucer)\b/i, 'reducer_eccentric'],
];

// ── Standard fitting patterns ──

const FITTING_PATTERNS: [RegExp, SystemFittingType][] = [
  // Elbows — check specific angles before generic
  [/\b(90|90°)\b.*\b(elbow|ell)\b/i, 'elbow_90'],
  [/\b(elbow|ell)\b.*\b(90|90°)\b/i, 'elbow_90'],
  [/\belbow\s+90\b/i, 'elbow_90'],
  [/\b(45|45°)\b.*\b(elbow|ell)\b/i, 'elbow_45'],
  [/\b(elbow|ell)\b.*\b(45|45°)\b/i, 'elbow_45'],
  [/\belbow\s+45\b/i, 'elbow_45'],
  // Tee (but NOT "reducing tee" — those are caught above)
  [/\b(straight\s+)?tee\b(?!.*reducing)/i, 'tee'],
  // Cap / Plug
  [/\bcap\b/i, 'cap'],
  [/\bplug\b/i, 'cap'],
  // Coupling
  [/\bcoupling\b/i, 'coupling'],
  // Cross
  [/\bcross\b(?!.*reducing)/i, 'cross'],
  // Union
  [/\bunion\b/i, 'union'],
  // Lateral
  [/\blateral\b/i, 'lateral'],
  // Stub end
  [/\bstub\s*end\b/i, 'stub_end'],
  // Flanges
  [/\bblind\b.*\bflange\b|\bflange\b.*\bblind\b/i, 'flange_blind'],
  [/\blap\s*joint\b.*\bflange\b|\bflange\b.*\blap\s*joint\b/i, 'flange_lap_joint'],
  [/\bslip[\s-]?on\b.*\bflange\b|\bflange\b.*\bslip[\s-]?on\b/i, 'flange_slip_on'],
  [/\bsocket\s*weld\b.*\bflange\b|\bflange\b.*\bsocket\s*weld\b/i, 'flange_socket_weld'],
  [/\bweld\s*neck\b.*\bflange\b|\bflange\b.*\bweld\s*neck\b/i, 'flange_weld_neck'],
  [/\bthreaded\b.*\bflange\b|\bflange\b.*\bthreaded\b/i, 'flange_threaded'],
  [/\bplate\b.*\bflange\b|\bflange\b.*\bplate\b/i, 'flange_plate'],
  // Olets
  [/\bweldolet\b/i, 'weldolet'],
  [/\bthreadolet\b/i, 'threadolet'],
  [/\bsockolet\b/i, 'sockolet'],
  [/\blatrolet\b/i, 'latrolet'],
  // Valves — "No33.5 - Gate Valve (BW)" patterns
  [/\bgate\b.*\bvalve\b|\bvalve\b.*\bgate\b/i, 'valve_gate'],
  [/\bglobe\b.*\bvalve\b|\bvalve\b.*\bglobe\b/i, 'valve_globe'],
  [/\bball\b.*\bvalve\b|\bvalve\b.*\bball\b/i, 'valve_ball'],
  [/\bbutterfly\b.*\bgear\b/i, 'valve_butterfly_gear'],
  [/\bbutterfly\b.*\bvalve\b|\bvalve\b.*\bbutterfly\b/i, 'valve_butterfly'],
  [/\bcheck\b.*\bvalve\b|\bvalve\b.*\bcheck\b/i, 'valve_check'],
  [/\bstop\b.*\bcheck\b/i, 'valve_check'],
  [/\btilting\b.*\bdisc\b.*\bcheck\b/i, 'valve_check'],
  [/\bswing\b.*\bcheck\b/i, 'valve_check'],
];

/**
 * Parse compound sizes like "3"x1-1/2"" or "8''x4''" into [mainSize, reducingSize]
 */
function parseCompoundSize(size: string): [string, string] | null {
  // Remove inch marks and trim
  const clean = size.replace(/[''""]+/g, '').trim();
  const match = clean.match(/^([\d\s\-\/]+)\s*x\s*([\d\s\-\/]+)/i);
  if (match) {
    return [match[1].trim(), match[2].trim()];
  }
  return null;
}

/**
 * Parse compound sizes from EST product data (uses size + size_normalized).
 * Returns [mainNormalized, reducingNormalized] or null if not compound.
 *
 * EST products store compound sizes as "4x2" in `size` and sometimes just
 * the main size in `size_normalized`. We try the raw size first, then fall
 * back to size_normalized if it also contains a separator.
 */
export function parseCompoundSizeNormalized(
  size: string | null | undefined,
  sizeNormalized: string | null | undefined,
): [string, string] | null {
  // Try raw size first (e.g., "4x2", "3"x1-1/2"")
  if (size) {
    const parsed = parseCompoundSize(size);
    if (parsed) return parsed;
  }
  // Try size_normalized (e.g., "4.0x2.0" or "4.0|2.0")
  if (sizeNormalized) {
    const sepMatch = sizeNormalized.match(/^([\d.]+)\s*[x|]\s*([\d.]+)/);
    if (sepMatch) return [sepMatch[1], sepMatch[2]];
  }
  return null;
}

/**
 * Extract schedule/weight from an EST product description.
 * e.g., "CS Elbow 90 LR STD (BV)" → "STD"
 */
export function extractSchedule(description: string): string | null {
  const match = description.match(/\b(STD|XS|XXS|SCH\s*5|SCH\s*10|SCH\s*20|SCH\s*30|SCH\s*40|SCH\s*60|SCH\s*80|SCH\s*100|SCH\s*120|SCH\s*140|SCH\s*160)\b/i);
  if (match) {
    return match[1].toUpperCase().replace(/\s+/g, '');
  }
  return null;
}

/**
 * Detect the fitting type from an EST product's description and product fields.
 */
export function detectFittingType(product: EstProductRate): DetectedType {
  const text = `${product.description || ''} ${product.product || ''}`;

  // Check reducing patterns first (more specific)
  for (const [pattern, type] of REDUCING_PATTERNS) {
    if (pattern.test(text)) {
      if (type === 'reducing_tee') {
        return { kind: 'reducing_tee' };
      }
      const sizes = parseCompoundSize(product.size || '');
      return {
        kind: 'reducing',
        type: type as ReducingFittingType,
        mainSize: sizes?.[0],
        reducingSize: sizes?.[1],
      };
    }
  }

  // Check standard fitting patterns
  for (const [pattern, type] of FITTING_PATTERNS) {
    if (pattern.test(text)) {
      return { kind: 'fitting', type };
    }
  }

  return { kind: 'unknown' };
}

// ─── Joint method → install type mapping (for dropdown pre-selection) ───

export const JOINT_METHOD_TO_INSTALL_TYPES: Record<JointMethod, string[]> = {
  BW: ['Butt Weld', 'Butt Welded', 'Buttweld'],
  GRV: ['Grooved', 'Grooved Coupling'],
  THD: ['Threaded'],
  CU: ['Soldered', 'Solder'],
};

export const MATERIAL_TO_EST_KEYWORDS: Record<SystemMaterial, string[]> = {
  carbon_steel: ['Carbon Steel'],
  stainless_steel: ['Stainless Steel', '304 Stainless Steel', '316 Stainless Steel'],
  copper: ['Copper', 'Wrot Copper'],
  pvc: ['PVC'],
  cpvc: ['CPVC'],
  cast_iron: ['Cast Iron'],
  ductile_iron: ['Ductile Iron'],
};

/**
 * Get the best-matching EST install_type for a joint method code.
 * Used to pre-select the dropdown.
 */
export function jointMethodToInstallType(jm: JointMethod): string {
  return JOINT_METHOD_TO_INSTALL_TYPES[jm][0];
}

/**
 * Get the best-matching EST material string for a SystemMaterial.
 * Used to pre-select the dropdown.
 */
export function systemMaterialToEstMaterial(mat: SystemMaterial): string {
  return MATERIAL_TO_EST_KEYWORDS[mat][0];
}

/**
 * Find the best matching install_type from available options.
 * Returns the value if an exact or alias match is found, otherwise null.
 */
export function findBestInstallType(
  jointMethod: JointMethod,
  availableTypes: { value: string; count: number }[]
): string | null {
  const aliases = JOINT_METHOD_TO_INSTALL_TYPES[jointMethod];
  for (const alias of aliases) {
    const match = availableTypes.find(t => t.value.toLowerCase() === alias.toLowerCase());
    if (match) return match.value;
  }
  return null;
}

/**
 * Find the best matching material from available options.
 * Returns the value if an exact or keyword match is found, otherwise null.
 */
export function findBestMaterial(
  systemMaterial: SystemMaterial,
  availableMaterials: { value: string; count: number }[]
): string | null {
  const keywords = MATERIAL_TO_EST_KEYWORDS[systemMaterial];
  for (const keyword of keywords) {
    const match = availableMaterials.find(m => m.value.toLowerCase() === keyword.toLowerCase());
    if (match) return match.value;
  }
  return null;
}
