import { create } from 'zustand';
import type { Point2D, ScaleCalibration } from '../types/measurement';
import type {
  TraceoverRun,
  TraceoverConfig,
  TraceoverSegment,
  ActiveTraceover,
  FittingType,
  BranchDirection,
  BranchConnection,
} from '../types/piping';
import { generateId } from '../lib/utils/idGen';
import { snapToAngle, detectFitting } from '../lib/piping/angleSnap';
import { resolveJointType } from '../lib/piping/jointResolver';
import { defaultJointTypeForMaterial } from '../lib/piping/productivityLookup';
import { distance } from '../lib/measurement/geometry';
import { pixelsToReal } from '../lib/measurement/scale';
import { PIPE_SIZES, SERVICE_TYPE_COLORS } from '../lib/piping/referenceData';
import { resolveSpecIdForSize, specJointType } from '../types/pipingSystem';
import { useSettingsStore } from './useSettingsStore';

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

const DEFAULT_CONFIG: TraceoverConfig = {
  material: 'copper_type_l',
  pipeSize: PIPE_SIZES[2], // 3/4"
  serviceType: 'heating_water',
  jointSpecFamilyId: null,
  pipingServiceId: null,
  projectSystemId: null,
  pipeSpecId: null,
  color: SERVICE_TYPE_COLORS.heating_water,
  label: '',
  startingElevation: 12,
};

interface TraceoverState {
  runs: TraceoverRun[];
  activeTraceover: ActiveTraceover | null;
  config: TraceoverConfig;
  showConfigPanel: boolean;

  // Config actions
  setConfig: (config: Partial<TraceoverConfig>) => void;
  setShowConfigPanel: (show: boolean) => void;

  // Drawing actions
  startTraceover: (firstPoint: Point2D, documentId: string, pageNumber: number) => void;
  addTraceoverPoint: (rawPoint: Point2D, calibration: ScaleCalibration | null) => void;
  updateSnappedCursor: (rawCursor: Point2D) => void;
  completeTraceover: (documentId: string, pageNumber: number) => TraceoverRun | null;
  cancelTraceover: () => void;
  undoLastPoint: () => void;
  setElevation: (elevation: number) => void;

  // Run management
  removeRun: (runId: string) => void;
  getRunsForPage: (docId: string, pageNumber: number) => TraceoverRun[];

  // Branch connection
  startBranchTraceover: (
    parentRunId: string,
    parentSegmentId: string,
    connectionPoint: Point2D,
    direction: BranchDirection,
    documentId: string,
    pageNumber: number,
  ) => void;
  addBranchToRun: (parentRunId: string, branch: BranchConnection) => void;

  // Run config updates
  updateRunConfig: (runId: string, partial: Partial<TraceoverConfig>) => void;

  // Bulk operations
  addRuns: (newRuns: TraceoverRun[]) => void;
  removeRuns: (runIds: string[]) => void;

  // Persistence
  restoreState: (runs: TraceoverRun[]) => void;
  clearAll: () => void;
}

export const useTraceoverStore = create<TraceoverState>()((set, get) => ({
  runs: [],
  activeTraceover: null,
  config: DEFAULT_CONFIG,
  showConfigPanel: false,

  setConfig: (partial) =>
    set((state) => ({ config: { ...state.config, ...partial } })),

  setShowConfigPanel: (show) =>
    set({ showConfigPanel: show }),

  startTraceover: (firstPoint, _documentId, _pageNumber) => {
    const { config } = get();
    set({
      activeTraceover: {
        config: { ...config },
        points: [firstPoint],
        segments: [],
        snappedCursorPos: null,
        currentElevation: config.startingElevation,
        branchConnection: null,
      },
    });
  },

  addTraceoverPoint: (rawPoint, calibration) => {
    const { activeTraceover } = get();
    const { pipeSpecs } = useSettingsStore.getState();
    if (!activeTraceover || activeTraceover.points.length === 0) return;

    const lastPoint = activeTraceover.points[activeTraceover.points.length - 1];
    const { snappedPoint, snappedAngleRad } = snapToAngle(lastPoint, rawPoint);

    const segPixelLength = distance(lastPoint, snappedPoint);
    if (segPixelLength < 5) return;

    let scaledLength = 0;
    let unit: TraceoverSegment['unit'] = 'px';
    if (calibration) {
      scaledLength = pixelsToReal(segPixelLength, calibration);
      unit = calibration.unit;
    }

    let fitting: FittingType | null = null;
    let angleFromPrevious: number | null = null;

    if (activeTraceover.segments.length > 0) {
      const prevSegment = activeTraceover.segments[activeTraceover.segments.length - 1];
      const result = detectFitting(prevSegment.angleRad, snappedAngleRad);
      fitting = result.fittingType;
      angleFromPrevious = result.turnAngleDeg;
    }

    // Resolve joint type — prefer direct pipeSpecId, then system chain, then legacy
    let jointType = defaultJointTypeForMaterial(activeTraceover.config.material);
    const settingsState = useSettingsStore.getState();

    if (activeTraceover.config.pipeSpecId) {
      // Direct spec reference (new path)
      const spec = pipeSpecs.find((s) => s.id === activeTraceover.config.pipeSpecId);
      if (spec) jointType = specJointType(spec);
    } else if (activeTraceover.config.projectSystemId) {
      const system = settingsState.getSystem(activeTraceover.config.projectSystemId);
      if (system) {
        const service = settingsState.getService(system.serviceId);
        if (service) {
          const specId = resolveSpecIdForSize(service, activeTraceover.config.pipeSize.nominalInches);
          const spec = pipeSpecs.find((s) => s.id === specId);
          if (spec) jointType = specJointType(spec);
        }
      }
    } else if (activeTraceover.config.pipingServiceId) {
      const service = settingsState.getService(activeTraceover.config.pipingServiceId);
      if (service) {
        const specId = resolveSpecIdForSize(service, activeTraceover.config.pipeSize.nominalInches);
        const spec = pipeSpecs.find((s) => s.id === specId);
        if (spec) jointType = specJointType(spec);
      }
    } else if (activeTraceover.config.jointSpecFamilyId) {
      jointType = resolveJointType(activeTraceover.config.pipeSize, null)
        ?? defaultJointTypeForMaterial(activeTraceover.config.material);
    }

    const segment: TraceoverSegment = {
      id: generateId(),
      startPoint: lastPoint,
      endPoint: snappedPoint,
      pixelLength: segPixelLength,
      scaledLength,
      unit,
      angleRad: snappedAngleRad,
      angleFromPrevious,
      fitting,
      jointType,
      elevation: activeTraceover.currentElevation,
    };

    set({
      activeTraceover: {
        ...activeTraceover,
        points: [...activeTraceover.points, snappedPoint],
        segments: [...activeTraceover.segments, segment],
        snappedCursorPos: null,
      },
    });
  },

  updateSnappedCursor: (rawCursor) => {
    const { activeTraceover } = get();
    if (!activeTraceover || activeTraceover.points.length === 0) return;

    const lastPoint = activeTraceover.points[activeTraceover.points.length - 1];
    const { snappedPoint } = snapToAngle(lastPoint, rawCursor);

    set({
      activeTraceover: {
        ...activeTraceover,
        snappedCursorPos: snappedPoint,
      },
    });
  },

  completeTraceover: (documentId, pageNumber) => {
    const { activeTraceover, runs } = get();
    if (!activeTraceover || activeTraceover.segments.length === 0) {
      set({ activeTraceover: null });
      return null;
    }

    let totalPixelLength = 0;
    let totalScaledLength = 0;
    let verticalPipeLength = 0;
    const fittingCounts = { ...EMPTY_FITTING_COUNTS };

    let prevElevation = activeTraceover.config.startingElevation ?? 0;
    for (const seg of activeTraceover.segments) {
      totalPixelLength += seg.pixelLength;
      totalScaledLength += seg.scaledLength;
      if (seg.fitting) fittingCounts[seg.fitting] += 1;

      const elevDiff = Math.abs(seg.elevation - prevElevation);
      if (elevDiff > 0) {
        verticalPipeLength += elevDiff;
        fittingCounts.elbow_90 += 2;
      }
      prevElevation = seg.elevation;
    }

    let branchParentPipeSize: TraceoverRun['branchParentPipeSize'] = null;

    const now = new Date();
    const run: TraceoverRun = {
      id: generateId(),
      documentId,
      pageNumber,
      config: { ...activeTraceover.config },
      segments: activeTraceover.segments,
      branches: [],
      isComplete: true,
      totalPixelLength,
      totalScaledLength,
      verticalPipeLength,
      fittingCounts,
      generatedTakeoffItemIds: [],
      branchParentPipeSize: null,
      createdAt: now,
      updatedAt: now,
    };

    if (activeTraceover.branchConnection) {
      branchParentPipeSize = activeTraceover.branchConnection.parentPipeSize;
      run.branchParentPipeSize = branchParentPipeSize;

      const branch: BranchConnection = {
        id: generateId(),
        parentRunId: activeTraceover.branchConnection.parentRunId,
        parentSegmentId: activeTraceover.branchConnection.parentSegmentId,
        connectionPoint: activeTraceover.branchConnection.connectionPoint,
        direction: activeTraceover.branchConnection.direction,
        childRunId: run.id,
        teeId: '',
        parentPipeSize: branchParentPipeSize,
      };

      fittingCounts.tee += 1;

      const updatedRuns = runs.map((r) => {
        if (r.id === branch.parentRunId) {
          return { ...r, branches: [...r.branches, branch], updatedAt: now };
        }
        return r;
      });

      set((state) => ({
        runs: [...updatedRuns, run],
        activeTraceover: null,
        config: { ...state.config, startingElevation: activeTraceover.currentElevation },
      }));
    } else {
      set((state) => ({
        runs: [...runs, run],
        activeTraceover: null,
        config: { ...state.config, startingElevation: activeTraceover.currentElevation },
      }));
    }

    return run;
  },

  cancelTraceover: () => set({ activeTraceover: null }),

  undoLastPoint: () => {
    const { activeTraceover } = get();
    if (!activeTraceover || activeTraceover.points.length <= 1) return;

    const remainingSegments = activeTraceover.segments.slice(0, -1);
    const prevElevation = remainingSegments.length > 0
      ? remainingSegments[remainingSegments.length - 1].elevation
      : activeTraceover.config.startingElevation;

    set({
      activeTraceover: {
        ...activeTraceover,
        points: activeTraceover.points.slice(0, -1),
        segments: remainingSegments,
        snappedCursorPos: null,
        currentElevation: prevElevation,
      },
    });
  },

  setElevation: (elevation) => {
    const { activeTraceover } = get();
    if (!activeTraceover) return;
    set({
      activeTraceover: { ...activeTraceover, currentElevation: elevation },
    });
  },

  removeRun: (runId) =>
    set((state) => ({ runs: state.runs.filter((r) => r.id !== runId) })),

  getRunsForPage: (docId, pageNumber) =>
    get().runs.filter((r) => r.documentId === docId && r.pageNumber === pageNumber),

  startBranchTraceover: (
    parentRunId, parentSegmentId, connectionPoint, direction, _documentId, _pageNumber,
  ) => {
    const { config, runs } = get();
    const parentRun = runs.find((r) => r.id === parentRunId);
    const parentPipeSize = parentRun?.config.pipeSize ?? config.pipeSize;

    set({
      activeTraceover: {
        config: { ...config },
        points: [connectionPoint],
        segments: [],
        snappedCursorPos: null,
        currentElevation: config.startingElevation,
        branchConnection: {
          parentRunId,
          parentSegmentId,
          connectionPoint,
          direction,
          parentPipeSize,
        },
      },
    });
  },

  addBranchToRun: (parentRunId, branch) =>
    set((state) => ({
      runs: state.runs.map((r) => {
        if (r.id === parentRunId) {
          return { ...r, branches: [...r.branches, branch], updatedAt: new Date() };
        }
        return r;
      }),
    })),

  updateRunConfig: (runId, partial) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId
          ? { ...r, config: { ...r.config, ...partial }, updatedAt: new Date() }
          : r,
      ),
    })),

  addRuns: (newRuns) =>
    set((state) => ({ runs: [...state.runs, ...newRuns] })),

  removeRuns: (runIds) =>
    set((state) => ({ runs: state.runs.filter((r) => !runIds.includes(r.id)) })),

  restoreState: (runs) => set({ runs }),

  clearAll: () => set({ runs: [], activeTraceover: null }),
}));
