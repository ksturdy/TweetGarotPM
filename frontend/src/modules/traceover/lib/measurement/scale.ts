import type { Point2D, MeasurementUnit, ScaleCalibration } from '../../types';
import { distance } from './geometry';

export interface CalibrationResult {
  pixelDistance: number;
  pixelsPerUnit: number;
}

export function createCalibration(
  start: Point2D,
  end: Point2D,
  realDistance: number,
  unit: MeasurementUnit
): CalibrationResult {
  if (realDistance <= 0) {
    throw new Error(`Real distance must be positive. Received: ${realDistance} ${unit}`);
  }

  const pixelDistance = distance(start, end);

  if (pixelDistance === 0) {
    throw new Error('Start and end points are identical. Cannot create calibration.');
  }

  const pixelsPerUnit = pixelDistance / realDistance;

  return { pixelDistance, pixelsPerUnit };
}

export function pixelsToReal(pixels: number, calibration: ScaleCalibration): number {
  if (calibration.pixelsPerUnit === 0) {
    throw new Error('Invalid calibration: pixelsPerUnit is zero.');
  }
  return pixels / calibration.pixelsPerUnit;
}

export function realToPixels(real: number, calibration: ScaleCalibration): number {
  return real * calibration.pixelsPerUnit;
}

const UNIT_LABELS: Record<MeasurementUnit, string> = {
  ft: 'ft',
  in: 'inch',
  m: 'm',
  mm: 'mm',
};

const PDF_DPI = 72;
const PDF_RENDER_SCALE = 2.0;
const RENDERED_DPI = PDF_DPI * PDF_RENDER_SCALE;

export interface ScalePreset {
  label: string;
  feetPerInch: number;
  group: 'architectural' | 'engineering';
}

export const SCALE_PRESETS: ScalePreset[] = [
  { label: 'Full Size (1" = 1")',          feetPerInch: 1 / 12,   group: 'architectural' },
  { label: '3" = 1\'-0"',                  feetPerInch: 1 / 3,    group: 'architectural' },
  { label: '1-1/2" = 1\'-0"',              feetPerInch: 2 / 3,    group: 'architectural' },
  { label: '1" = 1\'-0"',                  feetPerInch: 1,        group: 'architectural' },
  { label: '3/4" = 1\'-0"',                feetPerInch: 4 / 3,    group: 'architectural' },
  { label: '1/2" = 1\'-0"',                feetPerInch: 2,        group: 'architectural' },
  { label: '3/8" = 1\'-0"',                feetPerInch: 8 / 3,    group: 'architectural' },
  { label: '1/4" = 1\'-0"',                feetPerInch: 4,        group: 'architectural' },
  { label: '3/16" = 1\'-0"',               feetPerInch: 16 / 3,   group: 'architectural' },
  { label: '1/8" = 1\'-0"',                feetPerInch: 8,        group: 'architectural' },
  { label: '3/32" = 1\'-0"',               feetPerInch: 32 / 3,   group: 'architectural' },
  { label: '1/16" = 1\'-0"',               feetPerInch: 16,       group: 'architectural' },
  { label: '1" = 10\'',                    feetPerInch: 10,       group: 'engineering' },
  { label: '1" = 20\'',                    feetPerInch: 20,       group: 'engineering' },
  { label: '1" = 30\'',                    feetPerInch: 30,       group: 'engineering' },
  { label: '1" = 40\'',                    feetPerInch: 40,       group: 'engineering' },
  { label: '1" = 50\'',                    feetPerInch: 50,       group: 'engineering' },
  { label: '1" = 60\'',                    feetPerInch: 60,       group: 'engineering' },
  { label: '1" = 100\'',                   feetPerInch: 100,      group: 'engineering' },
];

export function presetToPixelsPerFoot(preset: ScalePreset): number {
  return RENDERED_DPI / preset.feetPerInch;
}

export function getScaleRatio(calibration: ScaleCalibration): string {
  if (calibration.pixelsPerUnit === 0) return 'No scale set';

  if (calibration.unit === 'ft') {
    for (const preset of SCALE_PRESETS) {
      const expectedPpf = presetToPixelsPerFoot(preset);
      const ratio = calibration.pixelsPerUnit / expectedPpf;
      if (ratio > 0.99 && ratio < 1.01) {
        return preset.label;
      }
    }
  }

  if (calibration.unit === 'ft') {
    const feetPerInch = RENDERED_DPI / calibration.pixelsPerUnit;
    const formatted = parseFloat(feetPerInch.toFixed(2));
    return `1" = ${formatted}'`;
  }

  const unitLabel = UNIT_LABELS[calibration.unit] || calibration.unit;
  const formatted = parseFloat(calibration.realDistance.toFixed(4));
  return `1 inch = ${formatted} ${unitLabel}`;
}
