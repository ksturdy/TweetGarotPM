import type { Point2D, ScaleCalibration } from '../../types';
import { distance } from './geometry';
import { pixelsToReal } from './scale';

export interface LinearMeasurementResult {
  pixelDistance: number;
  scaledDistance: number | null;
  unit: string;
}

export function computeLinearMeasurement(
  start: Point2D,
  end: Point2D,
  calibration: ScaleCalibration | null
): LinearMeasurementResult {
  const pixelDistance = distance(start, end);

  if (!calibration) {
    return { pixelDistance, scaledDistance: null, unit: 'px' };
  }

  const scaledDistance = pixelsToReal(pixelDistance, calibration);
  return { pixelDistance, scaledDistance, unit: calibration.unit };
}
