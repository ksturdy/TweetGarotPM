import type { Point2D, ScaleCalibration } from '../../types';
import { polygonArea } from './geometry';

export interface AreaMeasurementResult {
  pixelArea: number;
  scaledArea: number | null;
  unit: string;
}

const AREA_UNIT_LABELS: Record<string, string> = {
  ft: 'sq ft',
  in: 'sq in',
  m: 'sq m',
  mm: 'sq mm',
};

export function computeAreaMeasurement(
  points: Point2D[],
  calibration: ScaleCalibration | null
): AreaMeasurementResult {
  const pixelArea = polygonArea(points);

  if (!calibration) {
    return { pixelArea, scaledArea: null, unit: 'sq px' };
  }

  const pixelsPerUnitSquared = calibration.pixelsPerUnit * calibration.pixelsPerUnit;
  const scaledArea = pixelArea / pixelsPerUnitSquared;
  const unit = AREA_UNIT_LABELS[calibration.unit] || `sq ${calibration.unit}`;

  return { pixelArea, scaledArea, unit };
}
