import type { Point2D } from '../../types/measurement';
import type { TraceoverRun, TraceoverSegment, BranchConnection, FittingType } from '../../types/piping';
import type { AssemblyDefinition, AssemblyInstance } from '../../types/assembly';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { useAssemblyStore } from '../../stores/useAssemblyStore';
import { generateId } from '../utils/idGen';
import { generateTakeoffItems } from '../piping/takeoffGenerator';

const EMPTY_FITTING_COUNTS: Record<FittingType, number> = {
  elbow_90: 0,
  elbow_45: 0,
  tee: 0,
  reducer: 0,
  coupling: 0,
  cap: 0,
  union: 0,
  flange: 0,
  fishmouth: 0,
};

/**
 * Stamp an assembly template onto the canvas at the given origin point.
 *
 * Creates real TraceoverRun and TakeoffItem objects in the stores,
 * and an AssemblyInstance to group them.
 */
export function instantiateAssembly(
  assembly: AssemblyDefinition,
  origin: Point2D,
  documentId: string,
  pageNumber: number,
): AssemblyInstance {
  const traceoverStore = useTraceoverStore.getState();
  const takeoffStore = useTakeoffStore.getState();
  const assemblyStore = useAssemblyStore.getState();

  const now = new Date();

  // Build mapping: localId → real UUID
  const runIdMap = new Map<string, string>();
  for (const asmRun of assembly.runs) {
    runIdMap.set(asmRun.localId, generateId());
  }

  const newRunIds: string[] = [];
  const newItemIds: string[] = [];

  // 1. Create real TraceoverRuns
  const newRuns: TraceoverRun[] = assembly.runs.map((asmRun) => {
    const realId = runIdMap.get(asmRun.localId)!;
    newRunIds.push(realId);

    // Offset segment coordinates by origin
    const segments: TraceoverSegment[] = asmRun.segments.map((seg) => ({
      ...seg,
      id: generateId(),
      startPoint: { x: seg.startPoint.x + origin.x, y: seg.startPoint.y + origin.y },
      endPoint: { x: seg.endPoint.x + origin.x, y: seg.endPoint.y + origin.y },
    }));

    // Remap branch connections
    const branches: BranchConnection[] = asmRun.branches.map((b) => ({
      id: generateId(),
      parentRunId: runIdMap.get(b.parentLocalRunId) ?? b.parentLocalRunId,
      parentSegmentId: b.parentSegmentId,
      connectionPoint: {
        x: b.connectionPoint.x + origin.x,
        y: b.connectionPoint.y + origin.y,
      },
      direction: b.direction,
      childRunId: runIdMap.get(b.childLocalRunId) ?? b.childLocalRunId,
      teeId: b.teeId,
      parentPipeSize: b.parentPipeSize,
    }));

    return {
      id: realId,
      documentId,
      pageNumber,
      config: { ...asmRun.config },
      segments,
      branches,
      isComplete: true,
      totalPixelLength: asmRun.totalPixelLength,
      totalScaledLength: asmRun.totalScaledLength,
      verticalPipeLength: asmRun.verticalPipeLength,
      fittingCounts: { ...EMPTY_FITTING_COUNTS, ...asmRun.fittingCounts },
      generatedTakeoffItemIds: [],
      branchParentPipeSize: asmRun.branchParentPipeSize,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Add all runs to the store
  traceoverStore.addRuns(newRuns);

  // 2. Generate takeoff items for each run (pipe segments + fittings)
  for (const run of newRuns) {
    const items = generateTakeoffItems(run);
    if (items.length > 0) {
      takeoffStore.addItems(items);
      for (const item of items) {
        newItemIds.push(item.id);
      }
    }
  }

  // 3. Create real TakeoffItems for placed catalog items (valves, equipment)
  for (const asmItem of assembly.placedItems) {
    const absolutePos: Point2D = {
      x: asmItem.relativePosition.x + origin.x,
      y: asmItem.relativePosition.y + origin.y,
    };

    // Remap run/segment references in render meta
    const renderMeta = { ...asmItem.renderMeta };
    if (renderMeta.runId) {
      renderMeta.runId = runIdMap.get(renderMeta.runId) ?? renderMeta.runId;
    }

    const markerSize = 32;

    takeoffStore.addManualItem({
      documentId,
      pageNumber,
      category: asmItem.category,
      componentType: asmItem.componentType,
      label: asmItem.label,
      description: asmItem.description,
      quantity: 1,
      unit: asmItem.unit,
      size: asmItem.size,
      material: asmItem.material,
      boundingBox: {
        x: absolutePos.x - markerSize / 2,
        y: absolutePos.y - markerSize / 2,
        width: markerSize,
        height: markerSize,
      },
      centerPoint: absolutePos,
      source: 'manual',
      verified: false,
      userNotes: JSON.stringify(renderMeta),
      fittingType: asmItem.fittingType as any,
      pipeMaterial: asmItem.pipeMaterial as any,
      jointType: asmItem.jointType as any,
    });

    // Read fresh state — the original takeoffStore reference is stale after set()
    const freshItems = useTakeoffStore.getState().items;
    const lastItem = freshItems[freshItems.length - 1];
    if (lastItem) {
      newItemIds.push(lastItem.id);
    }
  }

  // 4. Create the AssemblyInstance record
  const instance: AssemblyInstance = {
    id: generateId(),
    assemblyId: assembly.id,
    assemblyName: assembly.name,
    origin,
    documentId,
    pageNumber,
    runIds: newRunIds,
    itemIds: newItemIds,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  assemblyStore.addInstance(instance);

  return instance;
}
