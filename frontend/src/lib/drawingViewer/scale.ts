import type { MeasurementUnit, DrawingScaleCalibration } from './types';
import { distance } from './geometry';
import type { Point2D } from './types';

export interface CalibrationResult {
  pixelDistance: number;
  pixelsPerUnit: number;
}

/**
 * Computes pixelsPerUnit from two pixel-space points and a known real-world distance.
 * Used during calibration tool: points are in current page pixels, not normalized.
 */
export function createCalibration(
  start: Point2D,
  end: Point2D,
  realDistance: number,
): CalibrationResult {
  if (realDistance <= 0) throw new Error('Real distance must be positive.');
  const pixelDistance = distance(start, end);
  if (pixelDistance === 0) throw new Error('Start and end points are identical.');
  return { pixelDistance, pixelsPerUnit: pixelDistance / realDistance };
}

/**
 * Derives pixelsPerUnit from a stored DrawingScaleCalibration and the current
 * rendered page dimensions. Normalized coords → pixel distance / real_world_value.
 */
export function computePixelsPerUnit(
  cal: DrawingScaleCalibration,
  pageWidthPx: number,
  pageHeightPx: number
): number {
  const x1 = cal.x1 * pageWidthPx;
  const y1 = cal.y1 * pageHeightPx;
  const x2 = cal.x2 * pageWidthPx;
  const y2 = cal.y2 * pageHeightPx;
  const pixelDist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  return cal.real_world_value > 0 ? pixelDist / cal.real_world_value : 0;
}

export function pixelsToReal(pixels: number, pixelsPerUnit: number): number {
  if (pixelsPerUnit === 0) return 0;
  return pixels / pixelsPerUnit;
}

export function realToPixels(real: number, pixelsPerUnit: number): number {
  return real * pixelsPerUnit;
}

export interface ScalePreset {
  label: string;
  feetPerInch: number;
  group: 'architectural' | 'engineering';
}

export const SCALE_PRESETS: ScalePreset[] = [
  { label: 'Full Size (1" = 1")',   feetPerInch: 1 / 12, group: 'architectural' },
  { label: '3" = 1\'-0"',           feetPerInch: 1 / 3,  group: 'architectural' },
  { label: '1-1/2" = 1\'-0"',       feetPerInch: 2 / 3,  group: 'architectural' },
  { label: '1" = 1\'-0"',           feetPerInch: 1,      group: 'architectural' },
  { label: '3/4" = 1\'-0"',         feetPerInch: 4 / 3,  group: 'architectural' },
  { label: '1/2" = 1\'-0"',         feetPerInch: 2,      group: 'architectural' },
  { label: '3/8" = 1\'-0"',         feetPerInch: 8 / 3,  group: 'architectural' },
  { label: '1/4" = 1\'-0"',         feetPerInch: 4,      group: 'architectural' },
  { label: '3/16" = 1\'-0"',        feetPerInch: 16 / 3, group: 'architectural' },
  { label: '1/8" = 1\'-0"',         feetPerInch: 8,      group: 'architectural' },
  { label: '1/16" = 1\'-0"',        feetPerInch: 16,     group: 'architectural' },
  { label: '1" = 10\'',             feetPerInch: 10,     group: 'engineering' },
  { label: '1" = 20\'',             feetPerInch: 20,     group: 'engineering' },
  { label: '1" = 30\'',             feetPerInch: 30,     group: 'engineering' },
  { label: '1" = 40\'',             feetPerInch: 40,     group: 'engineering' },
  { label: '1" = 50\'',             feetPerInch: 50,     group: 'engineering' },
  { label: '1" = 60\'',             feetPerInch: 60,     group: 'engineering' },
  { label: '1" = 100\'',            feetPerInch: 100,    group: 'engineering' },
];

export function formatMeasurement(value: number, unit: MeasurementUnit): string {
  if (unit === 'ft') {
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 12);
    if (inches === 0) return `${feet}'`;
    return `${feet}'-${inches}"`;
  }
  if (unit === 'in') return `${value.toFixed(2)}"`;
  if (unit === 'm') return `${value.toFixed(3)} m`;
  if (unit === 'mm') return `${value.toFixed(1)} mm`;
  return `${value.toFixed(2)} ${unit}`;
}
