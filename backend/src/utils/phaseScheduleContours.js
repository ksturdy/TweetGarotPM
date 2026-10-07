/**
 * Exact port of frontend/src/utils/contours.ts getContourMultipliers()
 * Used by forecastProjections.js, phaseSchedulePdfGenerator.js, and other
 * backend utilities to compute monthly distributions server-side.
 *
 * IMPORTANT: Keep in sync with frontend/src/utils/contours.ts.
 */

function getContourMultipliers(months, contour) {
  const multipliers = [];

  for (let i = 0; i < months; i++) {
    const x = months > 1 ? i / (months - 1) : 0.5; // 0 → 1
    const env = Math.sin(x * Math.PI); // base envelope: 0 at both ends, 1 at center
    let weight;

    switch (contour) {
      case 'front':
        weight = env * Math.exp(-x * 2);
        break;
      case 'back':
        weight = env * Math.exp(-(1 - x) * 2);
        break;
      case 'bell':
        weight = env;
        break;
      case 'turtle':
        weight = Math.pow(env, 0.3);
        break;
      case 'double':
        weight = 0.5 - 0.5 * Math.cos(x * 4 * Math.PI);
        break;
      case 'early':
        weight = env * Math.exp(-x * 4);
        break;
      case 'late':
        weight = env * Math.exp(-(1 - x) * 4);
        break;
      case 'scurve':
        weight = Math.pow(env, 1.5);
        break;
      case 'rampup':
        weight = x * env;
        break;
      case 'rampdown':
        weight = (1 - x) * env;
        break;
      case 'gradual':
        weight = env * env;
        break;
      case 'flat':
      default:
        weight = 1;
        break;
    }
    multipliers.push(weight);
  }

  const sum = multipliers.reduce((a, b) => a + b, 0);
  if (sum === 0) return multipliers.map(() => 1); // edge case: fallback to flat
  return multipliers.map(w => (w / sum) * months);
}

module.exports = { getContourMultipliers };
