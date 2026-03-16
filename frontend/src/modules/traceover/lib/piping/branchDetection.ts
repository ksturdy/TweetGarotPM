import type { Point2D, TraceoverRun, BranchSnapResult } from '../../types';

const BRANCH_SNAP_THRESHOLD_PX = 15;

export function findNearestRunPoint(
  cursor: Point2D,
  runs: TraceoverRun[],
  threshold: number = BRANCH_SNAP_THRESHOLD_PX,
): BranchSnapResult | null {
  let best: BranchSnapResult | null = null;

  for (const run of runs) {
    if (!run.isComplete) continue;
    for (const seg of run.segments) {
      const proj = projectPointOnSegment(cursor, seg.startPoint, seg.endPoint);
      if (proj.distance < threshold && (!best || proj.distance < best.distance)) {
        best = {
          runId: run.id,
          segmentId: seg.id,
          connectionPoint: proj.point,
          distance: proj.distance,
        };
      }
    }
  }

  return best;
}

function projectPointOnSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D,
): { point: Point2D; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
    return { point: { x: a.x, y: a.y }, distance: d };
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  const d = Math.sqrt((p.x - proj.x) ** 2 + (p.y - proj.y) ** 2);

  return { point: proj, distance: d };
}
