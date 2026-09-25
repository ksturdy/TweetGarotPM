import React from 'react';

// Work Contour types - define how work is distributed over time
export type ContourType = 'flat' | 'front' | 'back' | 'bell' | 'turtle' | 'double' | 'early' | 'late' | 'scurve' | 'rampup' | 'rampdown' | 'gradual';

export const contourOptions: { value: ContourType; label: string; icon: string }[] = [
  { value: 'flat',     label: 'Flat',     icon: '▬' },
  { value: 'front',    label: 'Front',    icon: '▼' },
  { value: 'back',     label: 'Back',     icon: '▲' },
  { value: 'bell',     label: 'Bell',     icon: '◆' },
  { value: 'turtle',   label: 'Turtle',   icon: '◈' },
  { value: 'double',   label: 'Double',   icon: '⋈' },
  { value: 'early',    label: 'Early Pk', icon: '◣' },
  { value: 'late',     label: 'Late Pk',  icon: '◢' },
  { value: 'scurve',   label: 'S-Curve',  icon: '∫' },
  { value: 'rampup',   label: 'Ramp Up',  icon: '⟋' },
  { value: 'rampdown', label: 'Ramp Dn',  icon: '⟍' },
  { value: 'gradual',  label: 'Gradual',  icon: '◠' },
];

// Generate contour multipliers for distributing work over N months.
// All non-flat contours use sin(π·position) as an envelope so they reach 0
// at the first and last month (position = 0 and position = 1).
export const getContourMultipliers = (months: number, contour: ContourType): number[] => {
  const multipliers: number[] = [];

  for (let i = 0; i < months; i++) {
    const x = months > 1 ? i / (months - 1) : 0.5; // 0 → 1
    const env = Math.sin(x * Math.PI); // base envelope: 0 at both ends, 1 at center
    let weight: number;

    switch (contour) {
      case 'front':
        // Peaks at ~30%, tapers to 0 at both ends
        weight = env * Math.exp(-x * 2);
        break;
      case 'back':
        // Peaks at ~70%, 0 at both ends
        weight = env * Math.exp(-(1 - x) * 2);
        break;
      case 'bell':
        // Symmetric bell, 0 at both ends
        weight = env;
        break;
      case 'turtle':
        // Very broad/flat top, 0 at both ends
        weight = Math.pow(env, 0.3);
        break;
      case 'double':
        // Two equal humps, 0 at start/center/end
        weight = 0.5 - 0.5 * Math.cos(x * 4 * Math.PI);
        break;
      case 'early':
        // Sharp peak at ~20%, long tail to 0
        weight = env * Math.exp(-x * 4);
        break;
      case 'late':
        // Long lead-in, sharp peak at ~80%
        weight = env * Math.exp(-(1 - x) * 4);
        break;
      case 'scurve':
        // Steeper bell — represents S-curve spending rate
        weight = Math.pow(env, 1.5);
        break;
      case 'rampup':
        // Slow start, peaks at ~60%, ends at 0
        weight = x * env;
        break;
      case 'rampdown':
        // Peaks at ~40%, long slow wind-down to 0
        weight = (1 - x) * env;
        break;
      case 'gradual':
        // Gentle sin² bell — softer than bell
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
};

// Get default contour based on % complete
export const getDefaultContour = (pctComplete: number): ContourType => {
  if (pctComplete < 15) {
    return 'scurve';
  } else if (pctComplete < 40) {
    return 'bell';
  } else if (pctComplete < 70) {
    return 'back';
  } else if (pctComplete < 90) {
    return 'rampdown';
  } else {
    return 'flat';
  }
};

// SVG polyline points for contour visualization
// y=16 = zero activity (bottom), y=2 = peak (top), y=8 = flat/average
export const getContourPoints = (contour: ContourType): string => {
  switch (contour) {
    case 'flat':
      return '0,8 24,8';
    case 'front':
      return '0,16 6,3 24,16';
    case 'back':
      return '0,16 18,3 24,16';
    case 'bell':
      return '0,16 12,2 24,16';
    case 'turtle':
      return '0,16 3,7 8,3 16,3 21,7 24,16';
    case 'double':
      return '0,16 6,3 12,16 18,3 24,16';
    case 'early':
      return '0,16 5,2 14,11 24,16';
    case 'late':
      return '0,16 10,11 19,2 24,16';
    case 'scurve':
      return '0,16 8,10 12,2 16,10 24,16';
    case 'rampup':
      return '0,16 14,3 24,16';
    case 'rampdown':
      return '0,16 10,3 24,16';
    case 'gradual':
      return '0,16 6,12 12,4 18,12 24,16';
    default:
      return '0,8 24,8';
  }
};

// Mini SVG visualization of contour shape
export const ContourVisual: React.FC<{ contour: ContourType }> = ({ contour }) => {
  const points = getContourPoints(contour);

  return React.createElement('svg', {
    width: 24,
    height: 16,
    style: { verticalAlign: 'middle', marginRight: '4px' }
  },
    React.createElement('polyline', {
      points,
      fill: 'none',
      stroke: '#3b82f6',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    })
  );
};
