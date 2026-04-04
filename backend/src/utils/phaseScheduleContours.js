/**
 * Port of frontend/src/utils/contours.ts getContourMultipliers()
 * Used by phaseSchedulePdfGenerator.js to compute monthly distributions server-side.
 */

function getContourMultipliers(months, contour) {
  const multipliers = [];

  for (let i = 0; i < months; i++) {
    const position = months > 1 ? i / (months - 1) : 0.5;
    let weight;

    switch (contour) {
      case 'front':
        weight = 2 - position * 1.5;
        break;
      case 'back':
        weight = 0.5 + position * 1.5;
        break;
      case 'bell':
        weight = Math.exp(-Math.pow((position - 0.5) * 3, 2)) * 1.5 + 0.5;
        break;
      case 'turtle':
        weight = Math.exp(-Math.pow((position - 0.5) * 2, 2)) * 0.8 + 0.6;
        break;
      case 'double': {
        const peak1 = Math.exp(-Math.pow((position - 0.25) * 5, 2));
        const peak2 = Math.exp(-Math.pow((position - 0.75) * 5, 2));
        weight = (peak1 + peak2) * 0.8 + 0.4;
        break;
      }
      case 'early':
        weight = Math.exp(-Math.pow((position - 0.2) * 4, 2)) * 1.8 + 0.2;
        break;
      case 'late':
        weight = Math.exp(-Math.pow((position - 0.8) * 4, 2)) * 1.8 + 0.2;
        break;
      case 'scurve':
        weight = Math.exp(-Math.pow((position - 0.5) * 2.5, 2)) * 1.2 + 0.4;
        break;
      case 'rampup':
        weight = 0.1 + position * 1.9;
        break;
      case 'rampdown':
        weight = 2 - position * 1.9;
        break;
      case 'flat':
      default:
        weight = 1;
        break;
    }
    multipliers.push(weight);
  }

  const sum = multipliers.reduce((a, b) => a + b, 0);
  return multipliers.map(w => (w / sum) * months);
}

module.exports = { getContourMultipliers };
