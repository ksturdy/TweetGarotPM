import type { Point2D } from './types';

/** Convert Konva stage pixel coords → normalized 0–1 fractions */
export function toNormalized(
  x: number,
  y: number,
  pageWidthPx: number,
  pageHeightPx: number
): Point2D {
  return { x: x / pageWidthPx, y: y / pageHeightPx };
}

/** Convert normalized 0–1 fractions → Konva stage pixel coords */
export function toPixel(
  nx: number,
  ny: number,
  pageWidthPx: number,
  pageHeightPx: number
): Point2D {
  return { x: nx * pageWidthPx, y: ny * pageHeightPx };
}

/** Normalize a flat [x,y,x,y,...] array */
export function normalizePoints(
  pts: number[],
  pageWidthPx: number,
  pageHeightPx: number
): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    out.push(pts[i] / pageWidthPx, pts[i + 1] / pageHeightPx);
  }
  return out;
}

/** Denormalize a flat [nx,ny,nx,ny,...] array back to pixel coords */
export function denormalizePoints(
  pts: number[],
  pageWidthPx: number,
  pageHeightPx: number
): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    out.push(pts[i] * pageWidthPx, pts[i + 1] * pageHeightPx);
  }
  return out;
}

/** Normalize an array of Point2D objects */
export function normalizePointArray(
  pts: Point2D[],
  pageWidthPx: number,
  pageHeightPx: number
): Point2D[] {
  return pts.map(p => toNormalized(p.x, p.y, pageWidthPx, pageHeightPx));
}

/** Denormalize an array of Point2D objects */
export function denormalizePointArray(
  pts: Point2D[],
  pageWidthPx: number,
  pageHeightPx: number
): Point2D[] {
  return pts.map(p => toPixel(p.x, p.y, pageWidthPx, pageHeightPx));
}
