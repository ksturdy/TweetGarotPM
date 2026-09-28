/**
 * Server-side port of frontend/src/utils/contours.ts — contour multiplier math.
 * Kept in sync with the frontend so both surfaces distribute hours identically.
 */
function getContourMultipliers(months, contour) {
  const multipliers = [];
  for (let i = 0; i < months; i++) {
    const x = months > 1 ? i / (months - 1) : 0.5;
    const env = Math.sin(x * Math.PI);
    let weight;
    switch (contour) {
      case 'front':    weight = env * Math.exp(-x * 2); break;
      case 'back':     weight = env * Math.exp(-(1 - x) * 2); break;
      case 'bell':     weight = env; break;
      case 'turtle':   weight = Math.pow(env, 0.3); break;
      case 'double':   weight = 0.5 - 0.5 * Math.cos(x * 4 * Math.PI); break;
      case 'early':    weight = env * Math.exp(-x * 4); break;
      case 'late':     weight = env * Math.exp(-(1 - x) * 4); break;
      case 'scurve':   weight = Math.pow(env, 1.5); break;
      case 'rampup':   weight = x * env; break;
      case 'rampdown': weight = (1 - x) * env; break;
      case 'gradual':  weight = env * env; break;
      case 'flat':
      default:         weight = 1; break;
    }
    multipliers.push(weight);
  }
  const sum = multipliers.reduce((a, b) => a + b, 0);
  if (sum === 0) return multipliers.map(() => 1);
  return multipliers.map(w => (w / sum) * months);
}

function autoContour(pctComplete) {
  if (pctComplete < 15) return 'scurve';
  if (pctComplete < 40) return 'bell';
  if (pctComplete < 70) return 'back';
  if (pctComplete < 90) return 'rampdown';
  return 'flat';
}

module.exports = { getContourMultipliers, autoContour };
