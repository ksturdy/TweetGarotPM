import React from 'react';

// Work Contour types - define how work is distributed over time
export type ContourType = 'flat' | 'front' | 'back' | 'bell' | 'turtle' | 'double' | 'early' | 'late' | 'scurve' | 'rampup' | 'rampdown';

export const contourOptions: { value: ContourType; label: string; icon: string }[] = [
  { value: 'flat', label: 'Flat', icon: '▬' },
  { value: 'front', label: 'Front', icon: '▼' },
  { value: 'back', label: 'Back', icon: '▲' },
  { value: 'bell', label: 'Bell', icon: '◆' },
  { value: 'turtle', label: 'Turtle', icon: '◈' },
  { value: 'double', label: 'Double', icon: '⋈' },
  { value: 'early', label: 'Early Pk', icon: '◣' },
  { value: 'late', label: 'Late Pk', icon: '◢' },
  { value: 'scurve', label: 'S-Curve', icon: '∫' },
  { value: 'rampup', label: 'Ramp Up', icon: '⟋' },
  { value: 'rampdown', label: 'Ramp Dn', icon: '⟍' },
];

// Generate contour multipliers for distributing work over N months
export const getContourMultipliers = (months: number, contour: ContourType): number[] => {
  const multipliers: number[] = [];

  for (let i = 0; i < months; i++) {
    const position = months > 1 ? i / (months - 1) : 0.5; // 0 to 1
    let weight: number;

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

  // Normalize so weights sum to months (so total equals backlog)
  const sum = multipliers.reduce((a, b) => a + b, 0);
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
export const getContourPoints = (contour: ContourType): string => {
  switch (contour) {
    case 'flat':
      return '0,8 24,8';
    case 'front':
      return '0,2 24,14';
    case 'back':
      return '0,14 24,2';
    case 'bell':
      return '0,14 6,10 12,2 18,10 24,14';
    case 'turtle':
      return '0,12 4,10 8,6 12,5 16,6 20,10 24,12';
    case 'double':
      return '0,12 4,6 8,10 12,14 16,10 20,6 24,12';
    case 'early':
      return '0,10 4,2 8,6 12,10 18,12 24,14';
    case 'late':
      return '0,14 6,12 12,10 16,6 20,2 24,10';
    case 'scurve':
      return '0,13 4,12 8,8 12,4 16,4 20,8 24,13';
    case 'rampup':
      return '0,14 24,2';
    case 'rampdown':
      return '0,2 24,14';
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
