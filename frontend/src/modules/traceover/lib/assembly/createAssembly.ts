import type { Point2D } from '../../types/measurement';
import type { TraceoverRun } from '../../types/piping';
import type { TakeoffItem } from '../../types/takeoff';
import type {
  AssemblyDefinition,
  AssemblyRun,
  AssemblyBranch,
  AssemblyPlacedItem,
  AssemblyConnectionPoint,
} from '../../types/assembly';
import type { PlacedItemRenderMeta } from '../../types/placeableItem';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { generateId } from '../../lib/utils/idGen';
import { generateAssemblyThumbnail } from './thumbnail';

function parseRenderMeta(item: TakeoffItem): PlacedItemRenderMeta | null {
  if (!item.userNotes) return null;
  try {
    const parsed = JSON.parse(item.userNotes);
    if (parsed && parsed.shape && parsed.color && parsed.abbreviation) {
      return parsed as PlacedItemRenderMeta;
    }
    return null;
  } catch {
    return null;
  }
}

function computeBounds(points: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function gatherAllPoints(runs: TraceoverRun[], items: TakeoffItem[]): Point2D[] {
  const points: Point2D[] = [];
  for (const run of runs) {
    for (const seg of run.segments) {
      points.push(seg.startPoint, seg.endPoint);
    }
  }
  for (const item of items) {
    if (item.centerPoint) {
      points.push(item.centerPoint);
    }
  }
  return points;
}

/**
 * Convert selected runs and items into an AssemblyDefinition.
 * All coordinates are translated to be relative to the top-left of the bounding box.
 */
export function createAssemblyFromSelection(
  selectedRunIds: string[],
  selectedItemIds: string[],
  name: string,
  description: string,
  category: string,
): AssemblyDefinition {
  const traceoverState = useTraceoverStore.getState();
  const takeoffState = useTakeoffStore.getState();

  const selectedRuns = traceoverState.runs.filter((r) => selectedRunIds.includes(r.id));
  const selectedItems = takeoffState.items.filter(
    (i) => selectedItemIds.includes(i.id) && parseRenderMeta(i) !== null,
  );

  const allPoints = gatherAllPoints(selectedRuns, selectedItems);
  if (allPoints.length === 0) {
    throw new Error('No valid geometry found in selection.');
  }

  const bounds = computeBounds(allPoints);
  const origin: Point2D = { x: bounds.minX, y: bounds.minY };
  const boundingBox = {
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };

  const runIdMap = new Map<string, string>();
  for (const run of selectedRuns) {
    runIdMap.set(run.id, `local_${generateId()}`);
  }

  const assemblyRuns: AssemblyRun[] = selectedRuns.map((run) => {
    const localId = runIdMap.get(run.id)!;

    const segments = run.segments.map((seg) => ({
      ...seg,
      startPoint: { x: seg.startPoint.x - origin.x, y: seg.startPoint.y - origin.y },
      endPoint: { x: seg.endPoint.x - origin.x, y: seg.endPoint.y - origin.y },
    }));

    const branches: AssemblyBranch[] = run.branches
      .filter((b) => runIdMap.has(b.parentRunId) || runIdMap.has(b.childRunId))
      .map((b) => ({
        id: generateId(),
        parentLocalRunId: runIdMap.get(b.parentRunId) ?? b.parentRunId,
        parentSegmentId: b.parentSegmentId,
        connectionPoint: {
          x: b.connectionPoint.x - origin.x,
          y: b.connectionPoint.y - origin.y,
        },
        direction: b.direction,
        childLocalRunId: runIdMap.get(b.childRunId) ?? b.childRunId,
        teeId: b.teeId,
        parentPipeSize: b.parentPipeSize,
      }));

    return {
      localId,
      config: { ...run.config },
      segments,
      branches,
      fittingCounts: { ...run.fittingCounts },
      totalScaledLength: run.totalScaledLength,
      totalPixelLength: run.totalPixelLength,
      verticalPipeLength: run.verticalPipeLength,
      branchParentPipeSize: run.branchParentPipeSize,
    };
  });

  const assemblyPlacedItems: AssemblyPlacedItem[] = selectedItems
    .filter((item) => item.centerPoint)
    .map((item) => {
      const meta = parseRenderMeta(item)!;
      const remappedMeta: PlacedItemRenderMeta = {
        ...meta,
        runId: meta.runId && runIdMap.has(meta.runId) ? runIdMap.get(meta.runId) : meta.runId,
      };

      return {
        localId: `local_${generateId()}`,
        category: item.category,
        componentType: item.componentType,
        label: item.label,
        description: item.description,
        size: item.size,
        material: item.material,
        unit: item.unit,
        relativePosition: {
          x: item.centerPoint!.x - origin.x,
          y: item.centerPoint!.y - origin.y,
        },
        renderMeta: remappedMeta,
        snapLocalRunId: meta.runId && runIdMap.has(meta.runId) ? runIdMap.get(meta.runId) : undefined,
        snapSegmentId: meta.segmentId,
        fittingType: item.fittingType,
        jointType: item.jointType,
        pipeMaterial: item.pipeMaterial,
      };
    });

  // Auto-detect connection points at bounding box edges
  const connectionPoints: AssemblyConnectionPoint[] = [];
  const EDGE_THRESHOLD = 10;

  for (const asmRun of assemblyRuns) {
    if (asmRun.segments.length === 0) continue;

    const firstSeg = asmRun.segments[0];
    const lastSeg = asmRun.segments[asmRun.segments.length - 1];

    const start = firstSeg.startPoint;
    if (
      start.x < EDGE_THRESHOLD ||
      start.y < EDGE_THRESHOLD ||
      start.x > boundingBox.width - EDGE_THRESHOLD ||
      start.y > boundingBox.height - EDGE_THRESHOLD
    ) {
      connectionPoints.push({
        id: generateId(),
        relativePosition: start,
        localRunId: asmRun.localId,
        endpoint: 'start',
        label: `Connection ${connectionPoints.length + 1}`,
      });
    }

    const end = lastSeg.endPoint;
    if (
      end.x < EDGE_THRESHOLD ||
      end.y < EDGE_THRESHOLD ||
      end.x > boundingBox.width - EDGE_THRESHOLD ||
      end.y > boundingBox.height - EDGE_THRESHOLD
    ) {
      connectionPoints.push({
        id: generateId(),
        relativePosition: end,
        localRunId: asmRun.localId,
        endpoint: 'end',
        label: `Connection ${connectionPoints.length + 1}`,
      });
    }
  }

  const thumbnailDataUrl = generateAssemblyThumbnail(assemblyRuns, assemblyPlacedItems, 120, 80);
  const now = new Date().toISOString();

  return {
    id: generateId(),
    name,
    description,
    category,
    boundingBox,
    runs: assemblyRuns,
    placedItems: assemblyPlacedItems,
    connectionPoints,
    thumbnailDataUrl,
    createdAt: now,
    updatedAt: now,
  };
}
