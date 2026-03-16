import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Circle,
  Rect,
  Text,
  Group,
} from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { usePdfStore } from '../../stores/usePdfStore';
import { useToolStore } from '../../stores/useToolStore';
import { useMeasurementStore } from '../../stores/useMeasurementStore';
import { useTakeoffStore } from '../../stores/useTakeoffStore';
import { useViewportStore } from '../../stores/useViewportStore';
import { useUiStore } from '../../stores/useUiStore';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { CATEGORY_COLORS } from '../../types';
import type { Point2D, Measurement } from '../../types';
import type { TakeoffItem } from '../../types/takeoff';
import { midpoint, distance, polygonArea } from '../../lib/measurement/geometry';
import { pointInRect, segmentIntersectsRect } from '../../lib/utils/geometry';
import { generateId } from '../../lib/utils/idGen';
import { generateTakeoffItems } from '../../lib/piping/takeoffGenerator';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { resolveSpecIdForSize, type PipeSpec } from '../../types/pipingSystem';
import type { TraceoverRun } from '../../types/piping';
import { findNearestRunPoint } from '../../lib/piping/branchDetection';
import { getCompanionItems } from '../../lib/piping/connectionRules';
import { MATERIAL_LABELS } from '../../lib/piping/referenceData';
import { lookupFittingRateFromSpec } from '../../lib/piping/productivityLookup';
import { useAssemblyStore } from '../../stores/useAssemblyStore';
import { instantiateAssembly } from '../../lib/assembly/instantiateAssembly';
import { PIPE_SIZES } from '../../lib/piping/referenceData';
import type { PlaceableItemDef } from '../../types/placeableItem';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import BranchConnectionMenu from '../piping/BranchConnectionMenu';
import TraceoverDrawingPreview from '../piping/TraceoverDrawingPreview';
import TraceoverAnnotation from '../piping/TraceoverAnnotation';
import FloatingRunTotals from '../piping/FloatingRunTotals';

// ---------------------------------------------------------------------------
// Off-line placement modal state type
// ---------------------------------------------------------------------------
interface OffLinePlacement {
  item: PlaceableItemDef;
  point: Point2D;
  mode: 'piping_item' | 'equipment';
}

/** Pending outlet-size prompt (o'lets placed on or off a run) */
interface OutletSizePrompt {
  item: PlaceableItemDef;
  point: Point2D;
  lineSize: string;
  /** Pre-resolved snap data (null if placed off-line via config) */
  snap: {
    runId: string;
    segmentId: string;
    rotation: number;
    pipeMat?: import('../../types/piping').PipeMaterial;
    jointType?: import('../../types/piping').JointType;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Scale factor used when rasterising a PDF page for display. */
const PDF_RENDER_SCALE = 2.0;

/** Minimum / maximum zoom the user can reach with the scroll wheel. */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

/** How fast the zoom responds to wheel events. */
const ZOOM_SENSITIVITY = 1.08;

/** Scroll speed multiplier for plain / shift+wheel panning. */
const SCROLL_SPEED = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the PipeSpec for a traceover run via its system → service → spec chain. */
function resolveSpecForRun(run: TraceoverRun): PipeSpec | undefined {
  const settings = useSettingsStore.getState();

  // New path: projectSystemId → global service → spec
  if (run.config.projectSystemId) {
    const system = settings.getSystem(run.config.projectSystemId);
    if (system) {
      const service = settings.getService(system.serviceId);
      if (service) {
        const specId = resolveSpecIdForSize(service, run.config.pipeSize.nominalInches);
        return settings.getPipeSpec(specId);
      }
    }
  }

  // Legacy fallback: old runs with pipingServiceId pointing directly to a service
  if (run.config.pipingServiceId) {
    const service = settings.getService(run.config.pipingServiceId);
    if (service) {
      const specId = resolveSpecIdForSize(service, run.config.pipeSize.nominalInches);
      return settings.getPipeSpec(specId);
    }
  }

  return undefined;
}

/**
 * Computes the centroid of a polygon defined by an array of points.
 */
function centroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Flattens a Point2D[] to the [x1,y1,x2,y2,...] format that Konva <Line> expects.
 */
function flattenPoints(pts: Point2D[]): number[] {
  return pts.flatMap((p) => [p.x, p.y]);
}

// ---------------------------------------------------------------------------
// Sub-components rendered inside the Konva stage
// ---------------------------------------------------------------------------

/** Renders a single linear measurement as a line with a label at the midpoint. */
function LinearAnnotation({
  m,
  isSelected,
  onSelect,
  showTags,
}: {
  m: Measurement;
  isSelected: boolean;
  onSelect: () => void;
  showTags: boolean;
}) {
  if (m.points.length < 2) return null;
  const p1 = m.points[0];
  const p2 = m.points[1];
  const mid = midpoint(p1, p2);
  const label = m.scaledValue > 0
    ? `${m.scaledValue.toFixed(2)} ${m.unit}`
    : `${m.pixelValue.toFixed(0)} px`;

  const strokeColor = isSelected ? '#3b82f6' : m.color;

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      {/* Selection highlight */}
      {isSelected && (
        <Line
          points={[p1.x, p1.y, p2.x, p2.y]}
          stroke="#3b82f6"
          strokeWidth={6}
          lineCap="round"
          opacity={0.4}
        />
      )}
      <Line
        points={[p1.x, p1.y, p2.x, p2.y]}
        stroke={strokeColor}
        strokeWidth={2}
        lineCap="round"
      />
      {showTags && (
        <>
          {/* Endpoint circles */}
          <Circle x={p1.x} y={p1.y} radius={4} fill={strokeColor} />
          <Circle x={p2.x} y={p2.y} radius={4} fill={strokeColor} />
          {/* Label background */}
          <Rect
            x={mid.x - 30}
            y={mid.y - 10}
            width={60}
            height={18}
            fill="white"
            opacity={0.85}
            cornerRadius={3}
          />
          <Text
            x={mid.x - 30}
            y={mid.y - 8}
            width={60}
            text={label}
            fontSize={11}
            fill={strokeColor}
            fontStyle="bold"
            align="center"
          />
        </>
      )}
    </Group>
  );
}

/** Renders an area measurement as a filled polygon with the area label at the centroid. */
function AreaAnnotation({
  m,
  isSelected,
  onSelect,
  showTags,
}: {
  m: Measurement;
  isSelected: boolean;
  onSelect: () => void;
  showTags: boolean;
}) {
  if (m.points.length < 3) return null;
  const center = centroid(m.points);
  const label = m.scaledValue > 0
    ? `${m.scaledValue.toFixed(2)} ${m.unit}`
    : `${m.pixelValue.toFixed(0)} sq px`;

  const strokeColor = isSelected ? '#3b82f6' : m.color;

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      {/* Selection highlight */}
      {isSelected && (
        <Line
          points={flattenPoints(m.points)}
          closed
          stroke="#3b82f6"
          strokeWidth={5}
          opacity={0.4}
          dash={[8, 4]}
        />
      )}
      <Line
        points={flattenPoints(m.points)}
        closed
        fill={m.color}
        opacity={0.2}
        stroke={strokeColor}
        strokeWidth={2}
      />
      {showTags && (
        <>
          <Rect
            x={center.x - 35}
            y={center.y - 10}
            width={70}
            height={18}
            fill="white"
            opacity={0.85}
            cornerRadius={3}
          />
          <Text
            x={center.x - 35}
            y={center.y - 8}
            width={70}
            text={label}
            fontSize={11}
            fill={strokeColor}
            fontStyle="bold"
            align="center"
          />
        </>
      )}
    </Group>
  );
}

/** Renders a count marker as a numbered circle. */
function CountAnnotation({
  m,
  index,
  isSelected,
  onSelect,
  showTags,
}: {
  m: Measurement;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  showTags: boolean;
}) {
  if (m.points.length === 0) return null;
  const p = m.points[0];

  return (
    <Group
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      {/* Selection ring */}
      {isSelected && (
        <Circle
          x={p.x}
          y={p.y}
          radius={16}
          stroke="#3b82f6"
          strokeWidth={3}
          opacity={0.8}
          dash={[4, 3]}
        />
      )}
      <Circle x={p.x} y={p.y} radius={showTags ? 12 : 5} fill={isSelected ? '#3b82f6' : m.color} />
      {showTags && (
        <Text
          x={p.x - 12}
          y={p.y - 7}
          width={24}
          text={String(index + 1)}
          fontSize={12}
          fill="white"
          fontStyle="bold"
          align="center"
        />
      )}
    </Group>
  );
}

/** Renders an AI takeoff bounding box highlight. */
function TakeoffHighlight({ item, showTags }: { item: TakeoffItem; showTags: boolean }) {
  if (!item.boundingBox) return null;
  const { x, y, width, height } = item.boundingBox;
  const color = CATEGORY_COLORS[item.category] ?? '#6b7280';

  return (
    <Group>
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        opacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        cornerRadius={2}
      />
      {showTags && (
        <>
          <Rect
            x={x}
            y={y - 16}
            width={Math.max(width, 40)}
            height={16}
            fill={color}
            opacity={0.9}
            cornerRadius={[2, 2, 0, 0]}
          />
          <Text
            x={x + 3}
            y={y - 14}
            text={item.label}
            fontSize={10}
            fill="white"
            fontStyle="bold"
            width={Math.max(width, 40) - 6}
            ellipsis
            wrap="none"
          />
        </>
      )}
    </Group>
  );
}

/** Check if a TakeoffItem has PlacedItemRenderMeta in its userNotes */
function hasRenderMeta(item: TakeoffItem): boolean {
  return item.source === 'manual' && !!item.userNotes && item.userNotes.startsWith('{');
}

/** Parse render metadata from a TakeoffItem's userNotes */
function parseRenderMeta(item: TakeoffItem) {
  try {
    return JSON.parse(item.userNotes!) as {
      shape: string; color: string; abbreviation: string; catalogId: string;
      rotation?: number; runId?: string; segmentId?: string;
    };
  } catch {
    return null;
  }
}

/** Renders a manually placed catalog item (valve, equipment, etc.) as a labeled shape */
function PlacedItemAnnotation({
  item,
  showTags,
  isSelected,
  onSelect,
}: {
  item: TakeoffItem;
  showTags: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meta = parseRenderMeta(item);
  if (!meta || !item.centerPoint) return null;

  const { x, y } = item.centerPoint;
  const { shape, color, abbreviation, rotation = 0 } = meta;
  const isInline = rotation !== 0;

  return (
    <Group
      x={x}
      y={y}
      rotation={isInline ? rotation : 0}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
    >
      {/* Selection ring */}
      {isSelected && (
        <Circle
          x={0}
          y={0}
          radius={22}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[4, 2]}
          fill="transparent"
        />
      )}

      {/* Shape marker */}
      {shape === 'circle' && (
        <Circle
          x={0}
          y={0}
          radius={14}
          fill={color}
          opacity={0.85}
          stroke={isSelected ? '#3b82f6' : '#0d1825'}
          strokeWidth={1.5}
        />
      )}
      {shape === 'rectangle' && (
        <Rect
          x={-20}
          y={-12}
          width={40}
          height={24}
          fill={color}
          opacity={0.85}
          stroke={isSelected ? '#3b82f6' : '#0d1825'}
          strokeWidth={1.5}
          cornerRadius={3}
        />
      )}
      {shape === 'diamond' && (
        <Rect
          x={0}
          y={0}
          width={24}
          height={24}
          fill={color}
          opacity={0.85}
          stroke={isSelected ? '#3b82f6' : '#0d1825'}
          strokeWidth={1.5}
          rotation={45}
          offsetX={12}
          offsetY={12}
        />
      )}

      {/* Abbreviation text - counter-rotate so text stays readable */}
      {showTags && (
        <Text
          x={-20}
          y={-5}
          width={40}
          rotation={isInline ? -rotation : 0}
          text={abbreviation}
          fontSize={9}
          fill="#0d1825"
          fontStyle="bold"
          align="center"
          listening={false}
        />
      )}

      {/* Size label below marker when snapped to a run */}
      {showTags && item.size && isInline && (
        <Group rotation={isInline ? -rotation : 0}>
          <Rect
            x={-14}
            y={15}
            width={28}
            height={11}
            fill="#0d1825"
            opacity={0.85}
            cornerRadius={2}
          />
          <Text
            x={-20}
            y={16}
            width={40}
            text={item.size}
            fontSize={7}
            fill="#d4e3f3"
            fontStyle="bold"
            align="center"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Main PdfViewer component
// ---------------------------------------------------------------------------

export default function PdfViewer() {
  // ---- Store subscriptions ----
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const pdfProxies = usePdfStore((s) => s.pdfProxies);

  const activeTool = useToolStore((s) => s.activeTool);
  const activeDrawing = useToolStore((s) => s.activeDrawing);
  const startDrawing = useToolStore((s) => s.startDrawing);
  const addPoint = useToolStore((s) => s.addPoint);
  const completeDrawing = useToolStore((s) => s.completeDrawing);
  const measurementColor = useToolStore((s) => s.measurementColor);
  const countColor = useToolStore((s) => s.countColor);
  const countLabel = useToolStore((s) => s.countLabel);
  const selectedItems = useToolStore((s) => s.selectedItems);
  const setSelectedItem = useToolStore((s) => s.setSelectedItem);
  const setSelectedItems = useToolStore((s) => s.setSelectedItems);
  const isItemSelected = useToolStore((s) => s.isItemSelected);
  const clearSelection = useToolStore((s) => s.clearSelection);

  const measurements = useMeasurementStore((s) => s.measurements);
  const addMeasurement = useMeasurementStore((s) => s.addMeasurement);
  const removeMeasurement = useMeasurementStore((s) => s.removeMeasurement);
  const getCalibrationForPage = useMeasurementStore((s) => s.getCalibrationForPage);
  const takeoffItems = useTakeoffStore((s) => s.items);

  const setShowCalibrationDialog = useUiStore((s) => s.setShowCalibrationDialog);
  const setCalibrationPoints = useUiStore((s) => s.setCalibrationPoints);

  const activeTraceover = useTraceoverStore((s) => s.activeTraceover);
  const traceoverRuns = useTraceoverStore((s) => s.runs);
  const startTraceover = useTraceoverStore((s) => s.startTraceover);
  const addTraceoverPoint = useTraceoverStore((s) => s.addTraceoverPoint);
  const updateSnappedCursor = useTraceoverStore((s) => s.updateSnappedCursor);
  const completeTraceoverRun = useTraceoverStore((s) => s.completeTraceover);
  const cancelTraceover = useTraceoverStore((s) => s.cancelTraceover);
  const undoLastPoint = useTraceoverStore((s) => s.undoLastPoint);
  const getRunsForPage = useTraceoverStore((s) => s.getRunsForPage);
  const removeRun = useTraceoverStore((s) => s.removeRun);
  const addTakeoffItems = useTakeoffStore((s) => s.addItems);
  const replaceRunItems = useTakeoffStore((s) => s.replaceRunItems);
  const openBranchMenu = useUiStore((s) => s.openBranchMenu);
  const showTags = useUiStore((s) => s.showTags);
  const pipeHighlight = useUiStore((s) => s.pipeHighlight);
  const pipeHighlightWidth = useUiStore((s) => s.pipeHighlightWidth);
  const drawingGreyscale = useUiStore((s) => s.drawingGreyscale);
  const drawingFade = useUiStore((s) => s.drawingFade);
  const hiddenServiceTypes = useUiStore((s) => s.hiddenServiceTypes);

  const viewportScale = useViewportStore((s) => s.scale);
  const viewportX = useViewportStore((s) => s.x);
  const viewportY = useViewportStore((s) => s.y);
  const setViewport = useViewportStore((s) => s.setViewport);
  const setCursor = useViewportStore((s) => s.setCursor);

  // ---- Local state ----
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pageImage, setPageImage] = useState<HTMLImageElement | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [isRendering, setIsRendering] = useState(false);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);

  const pdfImageRef = useRef<Konva.Image>(null);

  // Window select (marquee) state
  const [windowSelectStart, setWindowSelectStart] = useState<Point2D | null>(null);
  const [windowSelectEnd, setWindowSelectEnd] = useState<Point2D | null>(null);
  const isWindowSelecting = windowSelectStart !== null;
  // Ref to suppress click handler from clearing selection right after a window select completes
  const windowSelectJustFinishedRef = useRef(false);

  // Off-line placement modal state (piping items / equipment placed away from a run)
  const [offLinePlacement, setOffLinePlacement] = useState<OffLinePlacement | null>(null);
  // Outlet size prompt state (o'lets need a branch/outlet size)
  const [outletPrompt, setOutletPrompt] = useState<OutletSizePrompt | null>(null);
  const [outletSize, setOutletSize] = useState('');

  // Ref-based viewport for high-frequency updates (pan/zoom) without re-renders
  const viewportRef = useRef({ scale: viewportScale, x: viewportX, y: viewportY });

  // Middle-mouse pan state (works regardless of active tool)
  const middlePanRef = useRef<{ active: boolean; startX: number; startY: number; vpX: number; vpY: number }>({
    active: false, startX: 0, startY: 0, vpX: 0, vpY: 0,
  });

  // Flag to know if we've done the initial fit-to-width
  const hasFittedRef = useRef(false);

  // ---- Derived data ----
  const pageMeasurements = useMemo(() => {
    if (!activeDocumentId) return [];
    return measurements.filter(
      (m) => m.documentId === activeDocumentId && m.pageNumber === activePageNumber,
    );
  }, [measurements, activeDocumentId, activePageNumber]);

  const pageTakeoffItems = useMemo(() => {
    if (!activeDocumentId) return [];
    return takeoffItems.filter(
      (item) =>
        item.documentId === activeDocumentId &&
        item.pageNumber === activePageNumber &&
        item.boundingBox,
    );
  }, [takeoffItems, activeDocumentId, activePageNumber]);

  const countMeasurements = useMemo(
    () => pageMeasurements.filter((m) => m.type === 'count'),
    [pageMeasurements],
  );

  const pageTraceoverRuns = useMemo(() => {
    if (!activeDocumentId) return [];
    return getRunsForPage(activeDocumentId, activePageNumber);
  }, [traceoverRuns, activeDocumentId, activePageNumber, getRunsForPage]);

  const visibleTraceoverRuns = useMemo(() => {
    if (hiddenServiceTypes.size === 0) return pageTraceoverRuns;
    return pageTraceoverRuns.filter(
      (run) => !hiddenServiceTypes.has(run.config.serviceType),
    );
  }, [pageTraceoverRuns, hiddenServiceTypes]);

  // ---- One-time refresh of traceover takeoff items (picks up description changes) ----
  const hasRefreshedRef = useRef(false);
  useEffect(() => {
    if (hasRefreshedRef.current || traceoverRuns.length === 0) return;
    hasRefreshedRef.current = true;
    for (const run of traceoverRuns) {
      const items = generateTakeoffItems(run, resolveSpecForRun(run));
      replaceRunItems(run.id, items);
    }
  }, [traceoverRuns, replaceRunItems]);

  // ---- Container size measurement via ResizeObserver ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    observer.observe(el);
    // Initial measure
    setContainerSize({
      width: el.clientWidth,
      height: el.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  // ---- Render the PDF page to an HTMLImageElement ----
  useEffect(() => {
    if (!activeDocumentId) {
      setPageImage(null);
      return;
    }

    const proxy = pdfProxies.get(activeDocumentId);
    if (!proxy) {
      setPageImage(null);
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    hasFittedRef.current = false;

    (async () => {
      try {
        const page = await proxy.getPage(activePageNumber);
        const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get canvas 2D context');

        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        if (cancelled) return;

        const img = new Image();
        img.src = canvas.toDataURL();

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
        });

        if (cancelled) return;

        setPageImage(img);
        setPageSize({ width: viewport.width, height: viewport.height });
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to render PDF page:', err);
          setPageImage(null);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDocumentId, activePageNumber, pdfProxies]);

  // ---- Fit-to-width on initial page load ----
  useEffect(() => {
    if (
      hasFittedRef.current ||
      !pageImage ||
      containerSize.width === 0 ||
      pageSize.width === 0
    ) {
      return;
    }

    hasFittedRef.current = true;

    const fitScale = containerSize.width / pageSize.width;
    const clampedScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitScale));

    const newViewport = {
      scale: clampedScale,
      x: 0,
      y: 0,
    };

    viewportRef.current = newViewport;
    setViewport(newViewport);
  }, [pageImage, containerSize, pageSize, setViewport]);

  // ---- Sync viewport store changes to the ref ----
  useEffect(() => {
    viewportRef.current = { scale: viewportScale, x: viewportX, y: viewportY };
  }, [viewportScale, viewportX, viewportY]);

  // ---- Save completed drawings as Measurements ----
  useEffect(() => {
    if (!activeDrawing || !activeDrawing.isComplete || !activeDocumentId) return;

    const pts = activeDrawing.points;

    if (activeDrawing.tool === 'calibrate' && pts.length >= 2) {
      // Open the calibration dialog with the two points
      setCalibrationPoints({ start: pts[0], end: pts[1] });
      setShowCalibrationDialog(true);
    } else if (activeDrawing.tool === 'linear' && pts.length >= 2) {
      const calibration = getCalibrationForPage(activeDocumentId, activePageNumber);
      const pixelDist = distance(pts[0], pts[1]);
      const scaledDist = calibration ? pixelDist / calibration.pixelsPerUnit : 0;
      const unit = calibration ? calibration.unit : 'px';

      addMeasurement({
        id: generateId(),
        pageNumber: activePageNumber,
        documentId: activeDocumentId,
        type: 'linear',
        points: [...pts],
        label: '',
        color: measurementColor,
        pixelValue: pixelDist,
        scaledValue: scaledDist,
        unit,
        createdAt: new Date(),
      });
    } else if (activeDrawing.tool === 'area' && pts.length >= 3) {
      const calibration = getCalibrationForPage(activeDocumentId, activePageNumber);
      const pixelArea = polygonArea(pts);
      const scaledArea = calibration
        ? pixelArea / (calibration.pixelsPerUnit * calibration.pixelsPerUnit)
        : 0;
      const unit = calibration ? `sq ${calibration.unit}` : 'sq px';

      addMeasurement({
        id: generateId(),
        pageNumber: activePageNumber,
        documentId: activeDocumentId,
        type: 'area',
        points: [...pts],
        label: '',
        color: measurementColor,
        pixelValue: pixelArea,
        scaledValue: scaledArea,
        unit,
        createdAt: new Date(),
      });
    } else if (activeDrawing.tool === 'count' && pts.length >= 1) {
      addMeasurement({
        id: generateId(),
        pageNumber: activePageNumber,
        documentId: activeDocumentId,
        type: 'count',
        points: [...pts],
        label: countLabel,
        color: countColor,
        pixelValue: 1,
        scaledValue: 1,
        unit: 'ea',
        createdAt: new Date(),
      });
    }
  }, [
    activeDrawing,
    activeDocumentId,
    activePageNumber,
    measurementColor,
    countColor,
    countLabel,
    addMeasurement,
    getCalibrationForPage,
    setCalibrationPoints,
    setShowCalibrationDialog,
  ]);

  // ---- Keyboard handler for traceover (Escape cancel, Ctrl+Z undo) + Delete selected items ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Assembly placement mode: Escape exits
      if (activeTool === 'place_assembly') {
        if (e.key === 'Escape') {
          useToolStore.getState().clearPlaceableAssembly();
          return;
        }
      }

      // Placement mode: Escape exits, Ctrl+Z undoes last placed item
      if (activeTool === 'place_piping_item' || activeTool === 'place_equipment') {
        if (e.key === 'Escape') {
          useToolStore.getState().clearPlaceableItem();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          useTakeoffStore.getState().undoLastPlacement();
          return;
        }
      }

      // Traceover-specific keys
      if (activeTool === 'traceover') {
        if (e.key === 'Escape' && activeTraceover) {
          cancelTraceover();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && activeTraceover) {
          e.preventDefault();
          undoLastPoint();
          return;
        }
      }

      // Delete/Backspace removes selected items
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItems.length > 0) {
        e.preventDefault();
        const assemblyStoreState = useAssemblyStore.getState();
        const deletedInstances = new Set<string>();

        for (const sel of selectedItems) {
          if (sel.type === 'assembly_instance') {
            // Delete the entire assembly instance (runs + items)
            if (!deletedInstances.has(sel.id)) {
              deletedInstances.add(sel.id);
              assemblyStoreState.removeInstance(sel.id);
            }
          } else if (sel.type === 'measurement') {
            removeMeasurement(sel.id);
          } else if (sel.type === 'traceover_run') {
            // Check if this run belongs to an assembly instance
            const instance = assemblyStoreState.getInstanceForRun(sel.id);
            if (instance && !deletedInstances.has(instance.id)) {
              deletedInstances.add(instance.id);
              assemblyStoreState.removeInstance(instance.id);
            } else if (!instance) {
              removeRun(sel.id);
              replaceRunItems(sel.id, []);
            }
          } else if (sel.type === 'takeoff_item') {
            // Check if this item belongs to an assembly instance
            const instance = assemblyStoreState.getInstanceForItem(sel.id);
            if (instance && !deletedInstances.has(instance.id)) {
              deletedInstances.add(instance.id);
              assemblyStoreState.removeInstance(instance.id);
            } else if (!instance) {
              useTakeoffStore.getState().removeItem(sel.id);
            }
          }
        }
        clearSelection();
      }

      // Escape clears selection
      if (e.key === 'Escape' && selectedItems.length > 0) {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    activeTraceover,
    cancelTraceover,
    undoLastPoint,
    selectedItems,
    removeMeasurement,
    removeRun,
    replaceRunItems,
    clearSelection,
  ]);

  // ---- Convert pointer position from stage coordinates to page coordinates ----
  const stageToPage = useCallback(
    (stageX: number, stageY: number): Point2D => {
      const vp = viewportRef.current;
      return {
        x: (stageX - vp.x) / vp.scale,
        y: (stageY - vp.y) / vp.scale,
      };
    },
    [],
  );

  const getPointerPagePos = useCallback((): Point2D | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    return stageToPage(pointer.x, pointer.y);
  }, [stageToPage]);

  // ---- Wheel handler: Ctrl+wheel = zoom, plain wheel = vertical scroll, Shift+wheel = horizontal scroll ----
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Zoom toward cursor
        const vp = viewportRef.current;
        const direction = e.evt.deltaY < 0 ? 1 : -1;
        const factor = direction > 0 ? ZOOM_SENSITIVITY : 1 / ZOOM_SENSITIVITY;
        const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.scale * factor));

        // Zoom toward the cursor position
        const mousePageX = (pointer.x - vp.x) / vp.scale;
        const mousePageY = (pointer.y - vp.y) / vp.scale;

        const newX = pointer.x - mousePageX * newScale;
        const newY = pointer.y - mousePageY * newScale;

        const newVp = { scale: newScale, x: newX, y: newY };
        viewportRef.current = newVp;
        setViewport(newVp);
      } else if (e.evt.shiftKey) {
        // Horizontal scroll
        const vp = viewportRef.current;
        const newX = vp.x - e.evt.deltaY * SCROLL_SPEED;
        const newVp = { ...vp, x: newX };
        viewportRef.current = newVp;
        setViewport(newVp);
      } else {
        // Vertical scroll
        const vp = viewportRef.current;
        const newY = vp.y - e.evt.deltaY * SCROLL_SPEED;
        const newVp = { ...vp, y: newY };
        viewportRef.current = newVp;
        setViewport(newVp);
      }
    },
    [setViewport],
  );

  // ---- Drag end handler for panning ----
  const handleDragEnd = useCallback(
    (e: KonvaEventObject<DragEvent>) => {
      const stage = e.target;
      if (stage !== stageRef.current) return;

      const newVp = {
        scale: viewportRef.current.scale,
        x: stage.x(),
        y: stage.y(),
      };
      viewportRef.current = newVp;
      setViewport(newVp);
    },
    [setViewport],
  );

  // ---- Mouse move handler for cursor tracking, drawing preview, and middle-mouse pan ----
  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Middle-mouse pan: update viewport directly
      const mp = middlePanRef.current;
      if (mp.active) {
        const dx = e.evt.clientX - mp.startX;
        const dy = e.evt.clientY - mp.startY;
        const newVp = { scale: viewportRef.current.scale, x: mp.vpX + dx, y: mp.vpY + dy };
        viewportRef.current = newVp;
        setViewport(newVp);
        return;
      }

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const pagePos = stageToPage(pointer.x, pointer.y);
      setCursorPos(pagePos);
      setCursor(pagePos.x, pagePos.y);

      // Update traceover snapped cursor preview
      if (activeTool === 'traceover' && activeTraceover) {
        updateSnappedCursor(pagePos);
      }

      // Update window select rectangle
      if (activeTool === 'window_select' && windowSelectStart) {
        setWindowSelectEnd(pagePos);
      }
    },
    [stageToPage, setCursor, setViewport, activeTool, activeTraceover, updateSnappedCursor, windowSelectStart],
  );

  // ---- Mouse down handler for window select + middle-mouse pan ----
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Middle mouse button → start panning regardless of tool
      if (e.evt.button === 1) {
        e.evt.preventDefault();
        const vp = viewportRef.current;
        middlePanRef.current = { active: true, startX: e.evt.clientX, startY: e.evt.clientY, vpX: vp.x, vpY: vp.y };
        return;
      }

      if (e.evt.button !== 0) return;
      if (activeTool !== 'window_select') return;

      const pagePos = getPointerPagePos();
      if (!pagePos) return;

      setWindowSelectStart(pagePos);
      setWindowSelectEnd(pagePos);
    },
    [activeTool, getPointerPagePos],
  );

  // ---- Mouse up handler for window select + middle-mouse pan ----
  const handleMouseUp = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // End middle-mouse pan
      if (e.evt.button === 1) {
        middlePanRef.current.active = false;
        return;
      }

      if (activeTool !== 'window_select' || !windowSelectStart || !windowSelectEnd) return;

      // Compute the selection rectangle in page coordinates
      const minX = Math.min(windowSelectStart.x, windowSelectEnd.x);
      const maxX = Math.max(windowSelectStart.x, windowSelectEnd.x);
      const minY = Math.min(windowSelectStart.y, windowSelectEnd.y);
      const maxY = Math.max(windowSelectStart.y, windowSelectEnd.y);

      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 5 && height > 5) {
        // Determine selection mode based on drag direction:
        //   Drag right (end.x >= start.x) → Crossing: select anything touched
        //   Drag left  (end.x <  start.x) → Window:   select only fully contained
        const isCrossing = windowSelectEnd.x >= windowSelectStart.x;
        const rect = { minX, minY, maxX, maxY };
        const matched: { id: string; type: 'measurement' | 'traceover_run' | 'takeoff_item' }[] = [];

        // Check traceover runs
        for (const run of visibleTraceoverRuns) {
          if (run.segments.length === 0) continue;

          if (isCrossing) {
            // Crossing: any segment point inside OR any segment line intersects rect
            const touches = run.segments.some(
              (seg) =>
                pointInRect(seg.startPoint, rect) ||
                pointInRect(seg.endPoint, rect) ||
                segmentIntersectsRect(seg.startPoint, seg.endPoint, rect),
            );
            if (touches) matched.push({ id: run.id, type: 'traceover_run' });
          } else {
            // Window: ALL segment endpoints must be inside the rectangle
            const allInside = run.segments.every(
              (seg) => pointInRect(seg.startPoint, rect) && pointInRect(seg.endPoint, rect),
            );
            if (allInside) matched.push({ id: run.id, type: 'traceover_run' });
          }
        }

        // Check measurements
        for (const m of pageMeasurements) {
          if (m.points.length === 0) continue;

          if (isCrossing) {
            // Crossing: any point inside OR any edge intersects rect
            let touches = m.points.some((p) => pointInRect(p, rect));
            if (!touches && m.type !== 'count') {
              // Check line segments between consecutive points
              for (let i = 0; i < m.points.length - 1; i++) {
                if (segmentIntersectsRect(m.points[i], m.points[i + 1], rect)) {
                  touches = true;
                  break;
                }
              }
            }
            if (touches) matched.push({ id: m.id, type: 'measurement' });
          } else {
            // Window: ALL points must be inside the rectangle
            const allInside = m.points.every((p) => pointInRect(p, rect));
            if (allInside) matched.push({ id: m.id, type: 'measurement' });
          }
        }

        // Check placed takeoff items (valves, equipment with render metadata)
        for (const item of pageTakeoffItems.filter(hasRenderMeta)) {
          if (!item.centerPoint) continue;
          if (pointInRect(item.centerPoint, rect)) {
            matched.push({ id: item.id, type: 'takeoff_item' });
          }
        }

        if (matched.length > 0) {
          setSelectedItems(matched);
        }
      }

      // Prevent the click handler from immediately clearing the selection
      windowSelectJustFinishedRef.current = true;
      setWindowSelectStart(null);
      setWindowSelectEnd(null);
    },
    [activeTool, windowSelectStart, windowSelectEnd, visibleTraceoverRuns, pageMeasurements, pageTakeoffItems, setSelectedItems],
  );

  // ---- Click handler: delegates to active tool ----
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Only respond to primary (left) clicks
      if (e.evt.button !== 0) return;

      const pagePos = getPointerPagePos();
      if (!pagePos) return;

      switch (activeTool) {
        case 'select':
        case 'window_select':
          // After a window select drag, the click event fires immediately — skip it
          if (windowSelectJustFinishedRef.current) {
            windowSelectJustFinishedRef.current = false;
            break;
          }
          // Clicking empty space deselects (annotation clicks use cancelBubble)
          clearSelection();
          break;

        case 'pan':
          // Pan tool handles via drag, nothing to do on click
          break;

        case 'calibrate':
        case 'linear': {
          if (!activeDrawing) {
            // First click: start a new line
            startDrawing(activeTool, pagePos);
          } else if (activeDrawing.points.length === 1) {
            // Second click: complete the line
            addPoint(pagePos);
            completeDrawing();
          }
          break;
        }

        case 'area': {
          if (!activeDrawing) {
            startDrawing('area', pagePos);
          } else {
            addPoint(pagePos);
          }
          break;
        }

        case 'count': {
          // Each click places a marker
          if (!activeDrawing) {
            startDrawing('count', pagePos);
            completeDrawing();
          } else {
            startDrawing('count', pagePos);
            completeDrawing();
          }
          break;
        }

        case 'zoom_in': {
          const vp = viewportRef.current;
          const stage = stageRef.current;
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;

          const newScale = Math.min(MAX_ZOOM, vp.scale * 1.2);
          const mousePageX = (pointer.x - vp.x) / vp.scale;
          const mousePageY = (pointer.y - vp.y) / vp.scale;
          const newVp = {
            scale: newScale,
            x: pointer.x - mousePageX * newScale,
            y: pointer.y - mousePageY * newScale,
          };
          viewportRef.current = newVp;
          setViewport(newVp);
          break;
        }

        case 'zoom_out': {
          const vp = viewportRef.current;
          const stage = stageRef.current;
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;

          const newScale = Math.max(MIN_ZOOM, vp.scale / 1.2);
          const mousePageX = (pointer.x - vp.x) / vp.scale;
          const mousePageY = (pointer.y - vp.y) / vp.scale;
          const newVp = {
            scale: newScale,
            x: pointer.x - mousePageX * newScale,
            y: pointer.y - mousePageY * newScale,
          };
          viewportRef.current = newVp;
          setViewport(newVp);
          break;
        }

        case 'traceover': {
          if (!activeDocumentId) break;
          const calibration = getCalibrationForPage(activeDocumentId, activePageNumber);
          if (!activeTraceover) {
            // Check for branch snap to existing run
            const branchSnap = findNearestRunPoint(pagePos, traceoverRuns);
            if (branchSnap) {
              // Convert page coords to screen coords for menu positioning
              const vp = viewportRef.current;
              const screenPos = {
                x: pagePos.x * vp.scale + vp.x,
                y: pagePos.y * vp.scale + vp.y,
              };
              openBranchMenu(screenPos, branchSnap);
            } else {
              // First click: start a new traceover run
              startTraceover(pagePos, activeDocumentId, activePageNumber);
            }
          } else {
            // Subsequent clicks: add a snapped point
            addTraceoverPoint(pagePos, calibration);
          }
          break;
        }

        case 'place_piping_item': {
          const selectedItem = useToolStore.getState().selectedPlaceableItem;
          if (!selectedItem || !activeDocumentId) break;

          // Snap piping items to the nearest traceover run
          const snap = findNearestRunPoint(pagePos, visibleTraceoverRuns, 50);
          let placePt = pagePos;
          let rotation = 0;
          let pipeSize: string | undefined = selectedItem.defaultSize;
          let snapRunId: string | undefined;
          let snapSegId: string | undefined;
          let pipeMat: import('../../types/piping').PipeMaterial | undefined;
          let jt: import('../../types/piping').JointType | undefined;

          if (!snap) {
            // No pipe run found nearby — show branded confirmation modal
            setOffLinePlacement({ item: selectedItem, point: pagePos, mode: 'piping_item' });
            break;
          }

          if (snap) {
            placePt = snap.connectionPoint;
            snapRunId = snap.runId;
            snapSegId = snap.segmentId;

            // Get the run and segment for size + angle
            const run = visibleTraceoverRuns.find((r) => r.id === snap.runId);
            if (run) {
              pipeSize = run.config.pipeSize.displayLabel;
              pipeMat = run.config.material;

              const seg = run.segments.find((s) => s.id === snap.segmentId);
              if (seg) {
                rotation = (seg.angleRad * 180) / Math.PI;
                jt = seg.jointType ?? undefined;
              }
            }
          }

          // O'lets and similar items need an outlet/branch size prompt
          if (selectedItem.needsOutletSize && pipeSize) {
            setOutletSize('');
            setOutletPrompt({
              item: selectedItem,
              point: placePt,
              lineSize: pipeSize,
              snap: snap ? {
                runId: snap.runId,
                segmentId: snap.segmentId,
                rotation,
                pipeMat,
                jointType: jt,
              } : null,
            });
            break;
          }

          const markerSize = 32;
          const renderMeta = JSON.stringify({
            shape: selectedItem.shape,
            color: selectedItem.color,
            abbreviation: selectedItem.abbreviation,
            catalogId: selectedItem.id,
            rotation,
            runId: snapRunId,
            segmentId: snapSegId,
          });

          const store = useTakeoffStore.getState();
          const materialLabel = pipeMat ? MATERIAL_LABELS[pipeMat] : undefined;
          const sizePrefix = pipeSize ? `${pipeSize} ` : '';

          // Labor rate lookup for the main item via PipeSpec
          let mainLaborFields: Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> = {};
          if (selectedItem.fittingType && jt && pipeSize) {
            // Resolve spec from the snapped run
            const snapRun = visibleTraceoverRuns.find((r) => r.id === snapRunId);
            const spec = snapRun ? resolveSpecForRun(snapRun) : undefined;
            if (spec) {
              const result = lookupFittingRateFromSpec(spec, selectedItem.fittingType, pipeSize);
              if (result.found) {
                mainLaborFields = { laborHours: result.hours };
              } else {
                mainLaborFields = { laborHoursError: result.error };
              }
            } else {
              mainLaborFields = { laborHoursError: 'No pipe spec resolved for rate lookup' };
            }
          } else if (jt && pipeSize) {
            // Items without a fittingType (e.g. valves) — flag as no rate
            mainLaborFields = { laborHoursError: `No ${selectedItem.name} rates available` };
          }

          // Add the main piping item
          store.addManualItem({
            documentId: activeDocumentId,
            pageNumber: activePageNumber,
            category: selectedItem.takeoffCategory,
            componentType: selectedItem.takeoffComponentType,
            label: `${sizePrefix}${selectedItem.abbreviation} - ${selectedItem.name}`,
            description: selectedItem.name,
            quantity: 1,
            unit: selectedItem.unit,
            size: pipeSize,
            material: materialLabel,
            boundingBox: {
              x: placePt.x - markerSize / 2,
              y: placePt.y - markerSize / 2,
              width: markerSize,
              height: markerSize,
            },
            centerPoint: placePt,
            source: 'manual',
            verified: false,
            userNotes: renderMeta,
            fittingType: selectedItem.fittingType,
            pipeMaterial: pipeMat,
            jointType: jt,
            ...mainLaborFields,
          });

          // Add companion connection items (e.g. flanges for welded valves)
          const companions = getCompanionItems(selectedItem.id, jt);
          for (const comp of companions) {
            const compFittingType: import('../../types/piping').FittingType | undefined =
              comp.abbreviation === 'FL' ? 'flange'
              : comp.abbreviation === 'UN' ? 'union'
              : comp.abbreviation === 'GC' ? 'coupling'
              : undefined;

            // Labor rate lookup for companion fittings via PipeSpec
            let compLaborFields: Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> = {};
            if (compFittingType && jt && pipeSize) {
              const snapRun = visibleTraceoverRuns.find((r) => r.id === snapRunId);
              const spec = snapRun ? resolveSpecForRun(snapRun) : undefined;
              if (spec) {
                const result = lookupFittingRateFromSpec(spec, compFittingType, pipeSize);
                if (result.found) {
                  compLaborFields = { laborHours: Math.round(result.hours * comp.quantity * 1000) / 1000 };
                } else {
                  compLaborFields = { laborHoursError: result.error };
                }
              }
            }

            store.addManualItem({
              documentId: activeDocumentId,
              pageNumber: activePageNumber,
              category: 'piping',
              componentType: 'pipe_fitting',
              label: `${sizePrefix}${comp.abbreviation} - ${comp.description}`,
              description: `${comp.description} (w/ ${selectedItem.name})`,
              quantity: comp.quantity,
              unit: 'ea',
              size: pipeSize,
              material: materialLabel,
              centerPoint: placePt,
              source: 'manual',
              verified: false,
              fittingType: compFittingType,
              pipeMaterial: pipeMat,
              jointType: jt,
              ...compLaborFields,
              userNotes: JSON.stringify({
                shape: 'circle',
                color: '#94a3b8',
                abbreviation: comp.abbreviation,
                catalogId: `companion_${comp.abbreviation.toLowerCase()}`,
                rotation,
                runId: snapRunId,
                segmentId: snapSegId,
              }),
            });
          }
          break;
        }

        case 'place_equipment': {
          const selectedItem = useToolStore.getState().selectedPlaceableItem;
          if (!selectedItem || !activeDocumentId) break;

          // Snap equipment to the nearest traceover run
          const eqSnap = findNearestRunPoint(pagePos, visibleTraceoverRuns, 50);
          let eqPlacePt = pagePos;
          let eqRotation = 0;
          let eqPipeSize: string | undefined = selectedItem.defaultSize;
          let eqSnapRunId: string | undefined;
          let eqSnapSegId: string | undefined;
          let eqPipeMat: import('../../types/piping').PipeMaterial | undefined;

          if (!eqSnap) {
            // No pipe run found nearby — show branded confirmation modal
            setOffLinePlacement({ item: selectedItem, point: pagePos, mode: 'equipment' });
            break;
          }

          if (eqSnap) {
            eqPlacePt = eqSnap.connectionPoint;
            eqSnapRunId = eqSnap.runId;
            eqSnapSegId = eqSnap.segmentId;

            const eqRun = visibleTraceoverRuns.find((r) => r.id === eqSnap.runId);
            if (eqRun) {
              eqPipeSize = eqRun.config.pipeSize.displayLabel;
              eqPipeMat = eqRun.config.material;

              const eqSeg = eqRun.segments.find((s) => s.id === eqSnap.segmentId);
              if (eqSeg) {
                eqRotation = (eqSeg.angleRad * 180) / Math.PI;
              }
            }
          }

          const markerSize = selectedItem.shape === 'rectangle' ? 40 : 32;
          const markerH = selectedItem.shape === 'rectangle' ? 28 : 32;
          const eqMaterialLabel = eqPipeMat ? MATERIAL_LABELS[eqPipeMat] : undefined;
          const eqSizePrefix = eqPipeSize ? `${eqPipeSize} ` : '';

          const renderMeta = JSON.stringify({
            shape: selectedItem.shape,
            color: selectedItem.color,
            abbreviation: selectedItem.abbreviation,
            catalogId: selectedItem.id,
            rotation: eqRotation,
            runId: eqSnapRunId,
            segmentId: eqSnapSegId,
          });

          useTakeoffStore.getState().addManualItem({
            documentId: activeDocumentId,
            pageNumber: activePageNumber,
            category: selectedItem.takeoffCategory,
            componentType: selectedItem.takeoffComponentType,
            label: `${eqSizePrefix}${selectedItem.abbreviation} - ${selectedItem.name}`,
            description: selectedItem.name,
            quantity: 1,
            unit: selectedItem.unit,
            size: eqPipeSize,
            material: eqMaterialLabel,
            boundingBox: {
              x: eqPlacePt.x - markerSize / 2,
              y: eqPlacePt.y - markerH / 2,
              width: markerSize,
              height: markerH,
            },
            centerPoint: eqPlacePt,
            source: 'manual',
            verified: false,
            userNotes: renderMeta,
            fittingType: selectedItem.fittingType,
            pipeMaterial: eqPipeMat,
          });
          break;
        }

        case 'place_assembly': {
          const assembly = useToolStore.getState().selectedAssembly;
          if (!assembly || !activeDocumentId) break;
          instantiateAssembly(assembly, pagePos, activeDocumentId, activePageNumber);
          break;
        }
      }
    },
    [
      activeTool,
      activeDrawing,
      startDrawing,
      addPoint,
      completeDrawing,
      getPointerPagePos,
      setViewport,
      activeDocumentId,
      activePageNumber,
      activeTraceover,
      startTraceover,
      addTraceoverPoint,
      getCalibrationForPage,
      traceoverRuns,
      visibleTraceoverRuns,
      openBranchMenu,
      clearSelection,
    ],
  );

  // ---- Right-click handler: ends traceover run ----
  const handleContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      // Always prevent the browser context menu on the canvas
      e.evt.preventDefault();

      // Right-click completes active traceover run
      if (
        activeTool === 'traceover' &&
        activeTraceover &&
        activeTraceover.segments.length >= 1 &&
        activeDocumentId
      ) {
        const completedRun = completeTraceoverRun(activeDocumentId, activePageNumber);
        if (completedRun) {
          const items = generateTakeoffItems(completedRun, resolveSpecForRun(completedRun));
          addTakeoffItems(items);
        }
      }
    },
    [activeTool, activeTraceover, activeDocumentId, activePageNumber, completeTraceoverRun, addTakeoffItems],
  );

  // ---- Double-click handler: closes area polygon / completes traceover ----
  const handleDblClick = useCallback(() => {
    if (activeTool === 'area' && activeDrawing && activeDrawing.points.length >= 3) {
      completeDrawing();
    } else if (
      activeTool === 'traceover' &&
      activeTraceover &&
      activeTraceover.segments.length >= 1 &&
      activeDocumentId
    ) {
      const completedRun = completeTraceoverRun(activeDocumentId, activePageNumber);
      if (completedRun) {
        const items = generateTakeoffItems(completedRun, resolveSpecForRun(completedRun));
        addTakeoffItems(items);
      }
    }
  }, [
    activeTool,
    activeDrawing,
    completeDrawing,
    activeTraceover,
    activeDocumentId,
    activePageNumber,
    completeTraceoverRun,
    addTakeoffItems,
  ]);

  // ---- Derive the in-progress drawing preview ----
  const drawingPreview = useMemo(() => {
    if (!activeDrawing || activeDrawing.isComplete || !cursorPos) return null;

    const pts = activeDrawing.points;
    if (pts.length === 0) return null;

    const lastPoint = pts[pts.length - 1];

    if (activeDrawing.tool === 'calibrate' || activeDrawing.tool === 'linear') {
      return {
        type: 'line' as const,
        points: [lastPoint.x, lastPoint.y, cursorPos.x, cursorPos.y],
      };
    }

    if (activeDrawing.tool === 'area') {
      // Show the polygon outline so far plus a dashed line to the cursor
      return {
        type: 'polygon' as const,
        closedPoints: flattenPoints(pts),
        trailingLine: [lastPoint.x, lastPoint.y, cursorPos.x, cursorPos.y],
      };
    }

    return null;
  }, [activeDrawing, cursorPos]);

  // ---- Determine cursor style ----
  const cursorStyle = useMemo(() => {
    switch (activeTool) {
      case 'select':
        return 'default';
      case 'pan':
        return 'grab';
      case 'window_select':
        return 'crosshair';
      case 'calibrate':
      case 'linear':
      case 'area':
        return 'crosshair';
      case 'count':
      case 'traceover':
      case 'place_piping_item':
      case 'place_equipment':
        return 'crosshair';
      case 'zoom_in':
        return 'zoom-in';
      case 'zoom_out':
        return 'zoom-out';
      default:
        return 'default';
    }
  }, [activeTool]);

  // ---- Greyscale filter on PDF image ----
  useEffect(() => {
    const node = pdfImageRef.current;
    if (!node) return;
    if (drawingGreyscale) {
      node.filters([Konva.Filters.Grayscale]);
      node.cache();
    } else {
      node.filters([]);
      node.clearCache();
    }
  }, [drawingGreyscale, pageImage]);

  // ---- Off-line placement confirm handler ----
  const handleOffLineConfirm = useCallback(() => {
    if (!offLinePlacement || !activeDocumentId) return;
    const { item, point, mode } = offLinePlacement;

    // Use the currently configured size & material from the traceover config panel
    const currentConfig = useTraceoverStore.getState().config;
    const configSize = currentConfig.pipeSize.displayLabel;
    const configMat = currentConfig.material;
    const materialLabel = configMat ? MATERIAL_LABELS[configMat] : undefined;
    const sizePrefix = configSize ? `${configSize} ` : '';

    // If item needs an outlet size, redirect to the outlet prompt
    if (item.needsOutletSize && configSize) {
      setOffLinePlacement(null);
      setOutletSize('');
      setOutletPrompt({
        item,
        point,
        lineSize: configSize,
        snap: null,
      });
      return;
    }

    if (mode === 'piping_item') {
      const markerSize = 32;
      const renderMeta = JSON.stringify({
        shape: item.shape,
        color: item.color,
        abbreviation: item.abbreviation,
        catalogId: item.id,
        rotation: 0,
      });

      useTakeoffStore.getState().addManualItem({
        documentId: activeDocumentId,
        pageNumber: activePageNumber,
        category: item.takeoffCategory,
        componentType: item.takeoffComponentType,
        label: `${sizePrefix}${item.abbreviation} - ${item.name}`,
        description: item.name,
        quantity: 1,
        unit: item.unit,
        size: configSize,
        material: materialLabel,
        boundingBox: {
          x: point.x - markerSize / 2,
          y: point.y - markerSize / 2,
          width: markerSize,
          height: markerSize,
        },
        centerPoint: point,
        source: 'manual',
        verified: false,
        userNotes: renderMeta,
        fittingType: item.fittingType,
        pipeMaterial: configMat,
      });
    } else {
      // equipment
      const markerSize = item.shape === 'rectangle' ? 40 : 32;
      const markerH = item.shape === 'rectangle' ? 28 : 32;
      const renderMeta = JSON.stringify({
        shape: item.shape,
        color: item.color,
        abbreviation: item.abbreviation,
        catalogId: item.id,
        rotation: 0,
      });

      useTakeoffStore.getState().addManualItem({
        documentId: activeDocumentId,
        pageNumber: activePageNumber,
        category: item.takeoffCategory,
        componentType: item.takeoffComponentType,
        label: `${sizePrefix}${item.abbreviation} - ${item.name}`,
        description: item.name,
        quantity: 1,
        unit: item.unit,
        size: configSize,
        material: materialLabel,
        boundingBox: {
          x: point.x - markerSize / 2,
          y: point.y - markerH / 2,
          width: markerSize,
          height: markerH,
        },
        centerPoint: point,
        source: 'manual',
        verified: false,
        userNotes: renderMeta,
        fittingType: item.fittingType,
        pipeMaterial: configMat,
      });
    }

    setOffLinePlacement(null);
  }, [offLinePlacement, activeDocumentId, activePageNumber]);

  // ---- Outlet size confirm handler (o'lets) ----
  const handleOutletConfirm = useCallback(() => {
    if (!outletPrompt || !activeDocumentId || !outletSize) return;
    const { item, point, lineSize, snap: snapData } = outletPrompt;

    const rotation = snapData?.rotation ?? 0;
    const pipeMat = snapData?.pipeMat;
    const jt = snapData?.jointType;
    const materialLabel = pipeMat ? MATERIAL_LABELS[pipeMat] : undefined;
    const sizeLabel = `${lineSize} x ${outletSize}`;
    const markerSize = 32;

    const renderMeta = JSON.stringify({
      shape: item.shape,
      color: item.color,
      abbreviation: item.abbreviation,
      catalogId: item.id,
      rotation,
      runId: snapData?.runId,
      segmentId: snapData?.segmentId,
    });

    // Labor rate lookup — use reducing rate if available
    let laborFields: Pick<TakeoffItem, 'laborHours' | 'laborHoursError'> = {};
    if (item.fittingType && snapData?.runId) {
      const snapRun = visibleTraceoverRuns.find((r) => r.id === snapData.runId);
      const spec = snapRun ? resolveSpecForRun(snapRun) : undefined;
      if (spec) {
        const result = lookupFittingRateFromSpec(spec, item.fittingType, lineSize, outletSize);
        if (result.found) {
          laborFields = { laborHours: result.hours };
        } else {
          laborFields = { laborHoursError: result.error };
        }
      }
    }

    useTakeoffStore.getState().addManualItem({
      documentId: activeDocumentId,
      pageNumber: activePageNumber,
      category: item.takeoffCategory,
      componentType: item.takeoffComponentType,
      label: `${sizeLabel} ${item.abbreviation} - ${item.name}`,
      description: item.name,
      quantity: 1,
      unit: item.unit,
      size: lineSize,
      reducingSize: outletSize,
      material: materialLabel,
      boundingBox: {
        x: point.x - markerSize / 2,
        y: point.y - markerSize / 2,
        width: markerSize,
        height: markerSize,
      },
      centerPoint: point,
      source: 'manual',
      verified: false,
      userNotes: renderMeta,
      fittingType: item.fittingType,
      pipeMaterial: pipeMat,
      jointType: jt,
      ...laborFields,
    });

    setOutletPrompt(null);
    setOutletSize('');
  }, [outletPrompt, outletSize, activeDocumentId, activePageNumber, visibleTraceoverRuns]);

  // ---- Render ----

  if (!activeDocumentId) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a2a3e',
        }}
      >
        <p style={{ fontSize: 14, color: '#4a6a88' }}>No document loaded</p>
      </div>
    );
  }

  if (isRendering && !pageImage) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a2a3e',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Spinner size={32} />
          <p style={{ fontSize: 14, color: '#7a9ab5' }}>Rendering page...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#2a3a4e',
        cursor: cursorStyle,
      }}
    >
      {containerSize.width > 0 && containerSize.height > 0 && (
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          x={viewportX}
          y={viewportY}
          scaleX={viewportScale}
          scaleY={viewportScale}
          draggable={activeTool === 'pan'}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onDblClick={handleDblClick}
          onDblTap={handleDblClick}
          onDragEnd={handleDragEnd}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
        >
          {/* Layer 1: PDF page image */}
          <Layer>
            {pageImage && (
              <KonvaImage
                ref={pdfImageRef}
                image={pageImage}
                width={pageSize.width}
                height={pageSize.height}
              />
            )}
            {drawingFade > 0 && pageSize.width > 0 && (
              <Rect
                x={0}
                y={0}
                width={pageSize.width}
                height={pageSize.height}
                fill="white"
                opacity={drawingFade}
                listening={false}
              />
            )}
          </Layer>

          {/* Layer 2: Annotations (measurements + AI highlights) */}
          <Layer>
            {/* AI/traceover takeoff bounding boxes */}
            {pageTakeoffItems
              .filter((item) => !hasRenderMeta(item))
              .map((item) => (
                <TakeoffHighlight key={item.id} item={item} showTags={showTags} />
              ))}

            {/* Traceover completed run annotations (drawn first so symbols appear on top) */}
            {visibleTraceoverRuns.map((run) => (
              <TraceoverAnnotation
                key={run.id}
                run={run}
                showTags={showTags}
                pipeHighlight={pipeHighlight}
                pipeHighlightWidth={pipeHighlightWidth}
                isSelected={selectedItems.some((s) => s.id === run.id && s.type === 'traceover_run')}
                onSelect={() => {
                  if (activeTool === 'traceover' && !activeTraceover) {
                    // In traceover mode, clicking an existing run opens branch menu
                    const pagePos = getPointerPagePos();
                    if (!pagePos) return;
                    const branchSnap = findNearestRunPoint(pagePos, visibleTraceoverRuns, 50);
                    if (branchSnap) {
                      const vp = viewportRef.current;
                      const screenPos = {
                        x: pagePos.x * vp.scale + vp.x,
                        y: pagePos.y * vp.scale + vp.y,
                      };
                      openBranchMenu(screenPos, branchSnap);
                    }
                  } else {
                    setSelectedItem(run.id, 'traceover_run');
                  }
                }}
              />
            ))}

            {/* Manually placed catalog items (valves, equipment, etc.) - rendered after runs so they appear on top */}
            {pageTakeoffItems
              .filter(hasRenderMeta)
              .map((item) => (
                <PlacedItemAnnotation
                  key={item.id}
                  item={item}
                  showTags={showTags}
                  isSelected={isItemSelected(item.id)}
                  onSelect={() => setSelectedItem(item.id, 'takeoff_item')}
                />
              ))}

            {/* Measurement annotations */}
            {pageMeasurements.map((m) => {
              const isSelected = selectedItems.some((s) => s.id === m.id && s.type === 'measurement');
              const onSelect = () => setSelectedItem(m.id, 'measurement');
              switch (m.type) {
                case 'linear':
                  return <LinearAnnotation key={m.id} m={m} isSelected={isSelected} onSelect={onSelect} showTags={showTags} />;
                case 'area':
                  return <AreaAnnotation key={m.id} m={m} isSelected={isSelected} onSelect={onSelect} showTags={showTags} />;
                case 'count':
                  return (
                    <CountAnnotation
                      key={m.id}
                      m={m}
                      index={countMeasurements.indexOf(m)}
                      isSelected={isSelected}
                      onSelect={onSelect}
                      showTags={showTags}
                    />
                  );
                default:
                  return null;
              }
            })}
          </Layer>

          {/* Layer 3: Active drawing preview */}
          <Layer>
            {drawingPreview?.type === 'line' && (
              <Line
                points={drawingPreview.points}
                stroke={measurementColor}
                strokeWidth={2}
                dash={[6, 4]}
                lineCap="round"
              />
            )}

            {drawingPreview?.type === 'polygon' && (
              <>
                {/* Existing polygon edges */}
                <Line
                  points={drawingPreview.closedPoints}
                  stroke={measurementColor}
                  strokeWidth={2}
                  lineCap="round"
                  lineJoin="round"
                />
                {/* Trailing line to cursor */}
                <Line
                  points={drawingPreview.trailingLine}
                  stroke={measurementColor}
                  strokeWidth={2}
                  dash={[6, 4]}
                  lineCap="round"
                />
              </>
            )}

            {/* Show endpoint circles for in-progress drawings */}
            {activeDrawing &&
              !activeDrawing.isComplete &&
              activeDrawing.points.map((p, i) => (
                <Circle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={4}
                  fill={measurementColor}
                />
              ))}

            {/* Traceover drawing preview */}
            {activeTraceover && (
              <TraceoverDrawingPreview traceover={activeTraceover} />
            )}

            {/* Cursor crosshair dot for drawing tools */}
            {cursorPos &&
              (activeTool === 'calibrate' ||
                activeTool === 'linear' ||
                activeTool === 'area' ||
                activeTool === 'count' ||
                activeTool === 'place_piping_item' ||
                activeTool === 'place_equipment' ||
                activeTool === 'place_assembly') && (
                <Circle
                  x={cursorPos.x}
                  y={cursorPos.y}
                  radius={3}
                  fill={measurementColor}
                  opacity={0.6}
                />
              )}

            {/* Assembly placement ghost preview */}
            {cursorPos && activeTool === 'place_assembly' && (() => {
              const assembly = useToolStore.getState().selectedAssembly;
              if (!assembly) return null;
              return (
                <Group x={cursorPos.x} y={cursorPos.y} opacity={0.4}>
                  {assembly.runs.map((asmRun) => {
                    if (asmRun.segments.length === 0) return null;
                    const pts: number[] = [];
                    pts.push(asmRun.segments[0].startPoint.x, asmRun.segments[0].startPoint.y);
                    for (const seg of asmRun.segments) {
                      pts.push(seg.endPoint.x, seg.endPoint.y);
                    }
                    return (
                      <Line
                        key={asmRun.localId}
                        points={pts}
                        stroke={asmRun.config.color || '#10b981'}
                        strokeWidth={3}
                        lineCap="round"
                        lineJoin="round"
                      />
                    );
                  })}
                  {assembly.placedItems.map((item) => (
                    <Circle
                      key={item.localId}
                      x={item.relativePosition.x}
                      y={item.relativePosition.y}
                      radius={8}
                      fill={item.renderMeta.color || '#3b82f6'}
                      stroke="#fff"
                      strokeWidth={1}
                    />
                  ))}
                </Group>
              );
            })()}

            {/* Window select rectangle — green for crossing (right drag), blue for window (left drag) */}
            {isWindowSelecting && windowSelectStart && windowSelectEnd && (() => {
              const isCrossing = windowSelectEnd.x >= windowSelectStart.x;
              const color = isCrossing ? '#22c55e' : '#3b82f6';
              return (
                <Rect
                  x={Math.min(windowSelectStart.x, windowSelectEnd.x)}
                  y={Math.min(windowSelectStart.y, windowSelectEnd.y)}
                  width={Math.abs(windowSelectEnd.x - windowSelectStart.x)}
                  height={Math.abs(windowSelectEnd.y - windowSelectStart.y)}
                  fill={color}
                  opacity={0.1}
                  stroke={color}
                  strokeWidth={1}
                  dash={isCrossing ? [6, 3] : undefined}
                />
              );
            })()}
          </Layer>
        </Stage>
      )}

      {/* Floating run totals overlay for active traceover */}
      {activeTool === 'traceover' && activeTraceover && <FloatingRunTotals />}

      {/* Branch connection menu */}
      {activeTool === 'traceover' && <BranchConnectionMenu />}

      {/* Rendering overlay when switching pages while image exists */}
      {isRendering && pageImage && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.1)',
          }}
        >
          <Spinner size={24} />
        </div>
      )}

      {/* Off-line placement confirmation modal */}
      <Modal
        open={offLinePlacement !== null}
        onClose={() => setOffLinePlacement(null)}
        title="No Pipe Run Detected"
        maxWidth={420}
      >
        {offLinePlacement && (() => {
          const cfg = useTraceoverStore.getState().config;
          const sizeLbl = cfg.pipeSize.displayLabel;
          const matLbl = MATERIAL_LABELS[cfg.material] || cfg.material;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94b3cc', lineHeight: 1.5 }}>
                <strong style={{ color: '#eab308' }}>{offLinePlacement.item.name}</strong> should be
                placed on a traced pipe run so that size, material, and labor rates are auto-detected.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#94b3cc', lineHeight: 1.5 }}>
                Place it off-line using the current config?
              </p>

              <div style={{
                display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 6,
                backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)',
              }}>
                <span style={{ fontSize: 12, color: '#7a9ab5' }}>Size: <strong style={{ color: '#d4e3f3' }}>{sizeLbl}</strong></span>
                <span style={{ fontSize: 12, color: '#7a9ab5' }}>Material: <strong style={{ color: '#d4e3f3' }}>{matLbl}</strong></span>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setOffLinePlacement(null)}
                  style={{
                    padding: '8px 16px', fontSize: 13, borderRadius: 6,
                    border: '1px solid #1f3450', backgroundColor: 'transparent',
                    color: '#7a9ab5', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOffLineConfirm}
                  style={{
                    padding: '8px 16px', fontSize: 13, borderRadius: 6, border: 'none',
                    backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  Place Item
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Outlet size prompt modal (o'lets) */}
      <Modal
        open={outletPrompt !== null}
        onClose={() => { setOutletPrompt(null); setOutletSize(''); }}
        title="Select Outlet Size"
        maxWidth={400}
      >
        {outletPrompt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#94b3cc', lineHeight: 1.5 }}>
              <strong style={{ color: '#d4e3f3' }}>{outletPrompt.item.name}</strong> on a{' '}
              <strong style={{ color: '#60a5fa' }}>{outletPrompt.lineSize}</strong> line.
              Select the outlet (branch) size:
            </p>

            <div>
              <label
                htmlFor="outlet-size"
                style={{ display: 'block', fontSize: 11, color: '#7a9ab5', marginBottom: 4, fontWeight: 500 }}
              >
                Outlet Size
              </label>
              <select
                id="outlet-size"
                value={outletSize}
                onChange={(e) => setOutletSize(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: '1px solid #1f3450',
                  backgroundColor: '#0d1a2a',
                  color: '#d4e3f3',
                  outline: 'none',
                }}
              >
                <option value="">-- Select outlet size --</option>
                {PIPE_SIZES
                  .filter((ps) => {
                    // Only show sizes smaller than or equal to the line size
                    const lineNom = PIPE_SIZES.find((p) => p.displayLabel === outletPrompt.lineSize)?.nominalInches;
                    return lineNom ? ps.nominalInches <= lineNom : true;
                  })
                  .map((ps) => (
                    <option key={ps.nominal} value={ps.displayLabel}>
                      {ps.displayLabel}
                    </option>
                  ))}
              </select>
            </div>

            {outletSize && (
              <div style={{
                display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 6,
                backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)',
              }}>
                <span style={{ fontSize: 12, color: '#7a9ab5' }}>
                  BOM: <strong style={{ color: '#d4e3f3' }}>{outletPrompt.lineSize} x {outletSize}</strong> {outletPrompt.item.name}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { setOutletPrompt(null); setOutletSize(''); }}
                style={{
                  padding: '8px 16px', fontSize: 13, borderRadius: 6,
                  border: '1px solid #1f3450', backgroundColor: 'transparent',
                  color: '#7a9ab5', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!outletSize}
                onClick={handleOutletConfirm}
                style={{
                  padding: '8px 16px', fontSize: 13, borderRadius: 6, border: 'none',
                  backgroundColor: outletSize ? '#2563eb' : '#1e3a5f',
                  color: outletSize ? '#fff' : '#4a6a88',
                  cursor: outletSize ? 'pointer' : 'not-allowed', fontWeight: 600,
                }}
              >
                Place {outletPrompt.item.abbreviation}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
