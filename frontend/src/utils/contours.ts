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

// Mini SVG visualization — computed from actual multipliers so it matches the real distribution.
export const ContourVisual: React.FC<{ contour: ContourType }> = ({ contour }) => {
  const N = 22;
  const W = 34, H = 14, pad = 1.5;
  const mults = getContourMultipliers(N, contour);
  const maxM = Math.max(...mults, 0.001);

  const pts = mults.map((m, i) => ({
    x: (i / (N - 1)) * W,
    y: H - pad - (m / maxM) * (H - 2 * pad),
  }));

  // Smooth cubic bezier path using midpoint control points (catmull-rom style).
  let curvePath = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = ((p.x + c.x) / 2).toFixed(1);
    curvePath += ` C ${mx},${p.y.toFixed(1)} ${mx},${c.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }

  const areaPath = `${curvePath} L${W},${H} L0,${H} Z`;

  return React.createElement('svg', {
    width: 36,
    height: 18,
    viewBox: `0 0 ${W} ${H}`,
    style: { verticalAlign: 'middle', flexShrink: 0, display: 'block' },
  },
    React.createElement('path', { d: areaPath, fill: '#bfdbfe', stroke: 'none' }),
    React.createElement('path', { d: curvePath, fill: 'none', stroke: '#2563eb', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  );
};
