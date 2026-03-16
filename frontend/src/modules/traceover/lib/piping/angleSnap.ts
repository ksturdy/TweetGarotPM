import type { Point2D, FittingType } from '../../types';

const ALLOWED_ANGLES_RAD = [
  0,
  Math.PI / 4,
  Math.PI / 2,
  (3 * Math.PI) / 4,
  Math.PI,
  -(3 * Math.PI) / 4,
  -Math.PI / 2,
  -Math.PI / 4,
];

export interface SnapResult {
  snappedPoint: Point2D;
  snappedAngleRad: number;
  snappedAngleDeg: number;
}

export function snapToAngle(start: Point2D, rawCursor: Point2D): SnapResult {
  const rawAngle = Math.atan2(rawCursor.y - start.y, rawCursor.x - start.x);
  const dist = Math.sqrt(
    (rawCursor.x - start.x) ** 2 + (rawCursor.y - start.y) ** 2,
  );

  let bestAngle = ALLOWED_ANGLES_RAD[0];
  let bestDiff = Infinity;

  for (const a of ALLOWED_ANGLES_RAD) {
    let diff = Math.abs(rawAngle - a);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAngle = a;
    }
  }

  const snappedAngleDeg = Math.round((bestAngle * 180) / Math.PI);

  return {
    snappedPoint: {
      x: Math.round((start.x + dist * Math.cos(bestAngle)) * 100) / 100,
      y: Math.round((start.y + dist * Math.sin(bestAngle)) * 100) / 100,
    },
    snappedAngleRad: bestAngle,
    snappedAngleDeg,
  };
}

export interface FittingDetectResult {
  turnAngleDeg: number;
  fittingType: FittingType | null;
}

export function detectFitting(
  prevAngleRad: number,
  currentAngleRad: number,
): FittingDetectResult {
  let diff = currentAngleRad - prevAngleRad;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const absDeg = Math.abs(Math.round((diff * 180) / Math.PI));

  if (absDeg < 5) return { turnAngleDeg: 0, fittingType: null };
  if (Math.abs(absDeg - 45) < 10) return { turnAngleDeg: 45, fittingType: 'elbow_45' };
  if (Math.abs(absDeg - 90) < 10) return { turnAngleDeg: 90, fittingType: 'elbow_90' };
  if (Math.abs(absDeg - 135) < 10) return { turnAngleDeg: 135, fittingType: 'elbow_45' };

  return { turnAngleDeg: absDeg, fittingType: null };
}
