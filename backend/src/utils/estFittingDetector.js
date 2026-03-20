/**
 * EST product fitting-type detection.
 *
 * Ported from the frontend estProductMapper.ts so that the backend can
 * auto-classify EST products (fittings, reducing fittings, reducing tees,
 * pipe, etc.) when building cost maps.
 */

// ── Reducing patterns (checked first — more specific) ──

const REDUCING_PATTERNS = [
  // Reducing tees: "CS Reducing Tee", "CS Tee Reducing"
  [/\breducing\b.*\btee\b|\btee\b.*\breducing\b/i, 'reducing_tee'],
  // Reducing elbows
  [/\breducing\b.*\b(90|90°)?\s*(elbow|ell)\b/i, 'elbow_90_reducing'],
  [/\b(elbow|ell)\b.*\b(90|90°)\b.*\bred\.?\b/i, 'elbow_90_reducing'],
  [/\belbow\b.*\bred\b/i, 'elbow_90_reducing'],
  // Concentric reducer (incl. "Recucer" typo in data)
  [/\b(reducer|recucer)\b.*\bconcentric\b|\bconcentric\b.*\b(reducer|recucer)\b/i, 'reducer_concentric'],
  // Eccentric reducer
  [/\b(reducer|recucer)\b.*\beccentric\b|\beccentric\b.*\b(reducer|recucer)\b/i, 'reducer_eccentric'],
];

// ── Standard fitting patterns ──

const FITTING_PATTERNS = [
  // Elbows — check specific angles before generic
  [/\b(90|90°)\b.*\b(elbow|ell)\b/i, 'elbow_90'],
  [/\b(elbow|ell)\b.*\b(90|90°)\b/i, 'elbow_90'],
  [/\belbow\s+90\b/i, 'elbow_90'],
  [/\b(45|45°)\b.*\b(elbow|ell)\b/i, 'elbow_45'],
  [/\b(elbow|ell)\b.*\b(45|45°)\b/i, 'elbow_45'],
  [/\belbow\s+45\b/i, 'elbow_45'],
  // Tee (but NOT "reducing tee")
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
  // Valves
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
 * Parse compound sizes like "3x1-1/2" or "4x2" into [mainSize, reducingSize].
 */
function parseCompoundSize(size) {
  if (!size) return null;
  const clean = size.replace(/[''""]+/g, '').trim();
  const match = clean.match(/^([\d\s\-\/]+)\s*x\s*([\d\s\-\/]+)/i);
  if (match) return [match[1].trim(), match[2].trim()];
  return null;
}

/**
 * Detect the fitting type from an EST product's description and product fields.
 *
 * Returns one of:
 *   { kind: 'pipe' }
 *   { kind: 'fitting', type: SystemFittingType }
 *   { kind: 'reducing', type: ReducingFittingType, mainSize?, reducingSize? }
 *   { kind: 'reducing_tee' }
 *   { kind: 'unknown' }
 */
function detectFittingType(row) {
  const text = `${row.description || ''} ${row.product || ''}`;

  // Check reducing patterns first (more specific)
  for (const [pattern, type] of REDUCING_PATTERNS) {
    if (pattern.test(text)) {
      if (type === 'reducing_tee') {
        return { kind: 'reducing_tee' };
      }
      const sizes = parseCompoundSize(row.size || '');
      return {
        kind: 'reducing',
        type,
        mainSize: sizes ? sizes[0] : undefined,
        reducingSize: sizes ? sizes[1] : undefined,
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

module.exports = { detectFittingType, parseCompoundSize };
