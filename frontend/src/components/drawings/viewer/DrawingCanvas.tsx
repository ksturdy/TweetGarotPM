import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect, Ellipse, Arrow } from 'react-konva';
import type Konva from 'konva';
import type {
  DrawingMarkupLayer,
  DrawingMarkup,
  DrawingIssuePin,
  DrawingSubmittalTag,
  DrawingMeasurement,
  DrawingScaleCalibration,
  ActiveTool,
  MarkupStyle,
} from '../../../lib/drawingViewer/types';
import { loadPdfFromUrl } from '../../../lib/drawingViewer/pdfLoader';
import { renderPageToCanvas } from '../../../lib/drawingViewer/pdfRenderer';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useViewport } from './useViewport';
import { useMarkupTools } from './useMarkupTools';
import MarkupShape from './MarkupShape';
import IssuePinShape from './IssuePinShape';
import SubmittalTagShape from './SubmittalTagShape';
import MeasurementShape from './MeasurementShape';
import { denormalizePoints } from '../../../lib/drawingViewer/coordUtils';

interface Props {
  drawingFileUrl: string;
  pageNumber: number;
  activeTool: ActiveTool;
  activeColor: string;
  activeStrokeWidth: number;
  activeLayerId: number | null;
  layers: DrawingMarkupLayer[];
  markups: DrawingMarkup[];
  issuePins: DrawingIssuePin[];
  submittalTags: DrawingSubmittalTag[];
  measurements: DrawingMeasurement[];
  scaleCalibration: DrawingScaleCalibration | null;
  selectedMarkupId: number | null;
  selectedPinId: number | null;
  selectedTagId: number | null;
  selectedMeasurementId: number | null;
  onMarkupComplete: (layerId: number, geometry: unknown, style: MarkupStyle) => void;
  onPinPlaced: (x: number, y: number) => void;
  onTagPlaced: (x: number, y: number, w: number, h: number) => void;
  onCalibrationLine: (x1: number, y1: number, x2: number, y2: number) => void;
  onMeasurePoint: (x: number, y: number) => void;
  onMeasureComplete: () => void;
  onSelectMarkup: (id: number | null) => void;
  onSelectPin: (id: number | null) => void;
  onSelectTag: (id: number | null) => void;
  onSelectMeasurement: (id: number | null) => void;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
}

export default function DrawingCanvas({
  drawingFileUrl, pageNumber, activeTool, activeColor, activeStrokeWidth, activeLayerId,
  layers, markups, issuePins, submittalTags, measurements, scaleCalibration,
  selectedMarkupId, selectedPinId, selectedTagId, selectedMeasurementId,
  onMarkupComplete, onPinPlaced, onTagPlaced, onCalibrationLine, onMeasurePoint,
  onMeasureComplete, onSelectMarkup, onSelectPin, onSelectTag, onSelectMeasurement,
  stageRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfImage, setPdfImage] = useState<HTMLImageElement | null>(null);
  const [pageW, setPageW] = useState(0);
  const [pageH, setPageH] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const { stage, setStage, handleWheel, resetView } = useViewport();

  // Load PDF
  useEffect(() => {
    if (!drawingFileUrl) return;
    let cancelled = false;
    loadPdfFromUrl(drawingFileUrl).then(result => {
      if (!cancelled) setPdfDoc(result.document);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [drawingFileUrl]);

  // Render page
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    renderPageToCanvas(pdfDoc, pageNumber, canvas, 1.5).then(({ width, height }) => {
      if (cancelled) return;
      const img = new window.Image();
      img.src = canvas.toDataURL();
      img.onload = () => {
        if (cancelled) return;
        setPdfImage(img);
        setPageW(width);
        setPageH(height);
        if (containerRef.current) {
          const { clientWidth: w, clientHeight: h } = containerRef.current;
          setContainerSize({ w, h });
          resetView(w, h, width, height);
        }
      };
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, resetView]);

  // Observe container resize
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const { draft, handleMouseDown, handleMouseMove, handleMouseUp } = useMarkupTools(
    activeTool,
    activeColor,
    activeStrokeWidth,
    pageW,
    pageH,
    ({ geometry, style }) => {
      if (activeLayerId) onMarkupComplete(activeLayerId, geometry, style);
    }
  );

  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'pan') {
      return; // draggable handles pan
    }

    const s = e.target.getStage();
    if (!s) return;
    const pos = s.getRelativePointerPosition();
    if (!pos) return;
    const nx = pos.x / pageW, ny = pos.y / pageH;

    if (activeTool === 'issue_pin') {
      if (e.target === s || e.target.getClassName() === 'Image') {
        onPinPlaced(nx, ny);
      }
      return;
    }
    if (activeTool === 'submittal_tag') {
      handleMouseDown(e);
      return;
    }
    if (activeTool === 'calibrate') {
      handleMouseDown(e);
      return;
    }
    if (activeTool === 'measure_linear' || activeTool === 'measure_area') {
      onMeasurePoint(nx, ny);
      return;
    }

    // markup tools
    if (activeTool !== 'select') {
      handleMouseDown(e);
    }
  }, [activeTool, pageW, pageH, onPinPlaced, onMeasurePoint, handleMouseDown]);

  const handleStageMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'submittal_tag' && draft) {
      const s = e.target.getStage();
      const pos = s?.getRelativePointerPosition();
      if (pos) {
        const x = Math.min(draft.startX, pos.x) / pageW;
        const y = Math.min(draft.startY, pos.y) / pageH;
        const w = Math.abs(pos.x - draft.startX) / pageW;
        const h = Math.abs(pos.y - draft.startY) / pageH;
        if (w > 0.01 && h > 0.01) onTagPlaced(x, y, w, h);
      }
      handleMouseUp(e);
      return;
    }
    if (activeTool === 'calibrate' && draft) {
      const s = e.target.getStage();
      const pos = s?.getRelativePointerPosition();
      if (pos) {
        const n1 = { x: draft.startX / pageW, y: draft.startY / pageH };
        const n2 = { x: pos.x / pageW, y: pos.y / pageH };
        onCalibrationLine(n1.x, n1.y, n2.x, n2.y);
      }
      handleMouseUp(e);
      return;
    }
    handleMouseUp(e);
  }, [activeTool, draft, pageW, pageH, onTagPlaced, onCalibrationLine, handleMouseUp]);

  const handleDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'measure_linear' || activeTool === 'measure_area') {
      onMeasureComplete();
    }
  }, [activeTool, onMeasureComplete]);

  const visibleLayerIds = new Set(
    layers.filter(l => l.is_visible).map(l => l.id)
  );
  const visibleMarkups = markups.filter(m => visibleLayerIds.has(m.layer_id));

  const cursor = activeTool === 'pan' ? 'grab'
    : activeTool === 'select' ? 'default'
    : 'crosshair';

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#1a1a2e', cursor }}
    >
      <Stage
        ref={stageRef}
        width={containerSize.w}
        height={containerSize.h}
        x={stage.x}
        y={stage.y}
        scaleX={stage.scale}
        scaleY={stage.scale}
        onWheel={handleWheel}
        draggable={activeTool === 'pan'}
        onDragEnd={e => {
          const s = e.target as Konva.Stage;
          setStage(prev => ({ ...prev, x: s.x(), y: s.y() }));
        }}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleDblClick}
        onClick={e => {
          if (activeTool === 'select' && (e.target === e.target.getStage() || e.target.getClassName() === 'Image')) {
            onSelectMarkup(null); onSelectPin(null); onSelectTag(null); onSelectMeasurement(null);
          }
        }}
      >
        {/* Layer 0: PDF Image */}
        <Layer>
          {pdfImage && <KonvaImage image={pdfImage} x={0} y={0} />}
        </Layer>

        {/* Layer 1: Markup shapes */}
        <Layer>
          {visibleMarkups.map(m => (
            <MarkupShape
              key={m.id}
              markup={m}
              pageW={pageW}
              pageH={pageH}
              isSelected={m.id === selectedMarkupId}
              onClick={() => onSelectMarkup(m.id)}
            />
          ))}
        </Layer>

        {/* Layer 2: Pins + Tags */}
        <Layer>
          {issuePins.map(pin => (
            <IssuePinShape
              key={pin.id}
              pin={pin}
              pageW={pageW}
              pageH={pageH}
              isSelected={pin.id === selectedPinId}
              onClick={() => onSelectPin(pin.id)}
            />
          ))}
          {submittalTags.map(tag => (
            <SubmittalTagShape
              key={tag.id}
              tag={tag}
              pageW={pageW}
              pageH={pageH}
              isSelected={tag.id === selectedTagId}
              onClick={() => onSelectTag(tag.id)}
            />
          ))}
        </Layer>

        {/* Layer 3: Measurements */}
        <Layer>
          {measurements.map(m => (
            <MeasurementShape
              key={m.id}
              measurement={m}
              pageW={pageW}
              pageH={pageH}
              isSelected={m.id === selectedMeasurementId}
              onClick={() => onSelectMeasurement(m.id)}
            />
          ))}
        </Layer>

        {/* Layer 4: Draft / in-progress shape */}
        <Layer>
          {draft && pageW > 0 && (() => {
            const { tool, startX, startY, currentX, currentY, points } = draft;
            const stroke = activeColor;
            const sw = activeStrokeWidth;

            if ((tool === 'pencil' || tool === 'revision_cloud') && points) {
              return <Line points={points} stroke={stroke} strokeWidth={sw} lineCap="round" tension={0.4} />;
            }
            if (tool === 'rectangle') {
              return <Rect x={Math.min(startX, currentX)} y={Math.min(startY, currentY)}
                width={Math.abs(currentX - startX)} height={Math.abs(currentY - startY)}
                stroke={stroke} strokeWidth={sw} fill="transparent" dash={[4, 2]} />;
            }
            if (tool === 'circle') {
              return <Ellipse
                x={(startX + currentX) / 2} y={(startY + currentY) / 2}
                radiusX={Math.abs(currentX - startX) / 2} radiusY={Math.abs(currentY - startY) / 2}
                stroke={stroke} strokeWidth={sw} fill="transparent" dash={[4, 2]} />;
            }
            if (tool === 'arrow') {
              return <Arrow points={[startX, startY, currentX, currentY]}
                stroke={stroke} fill={stroke} strokeWidth={sw} />;
            }
            if (tool === 'line' || tool === 'submittal_tag' || tool === 'calibrate') {
              return <Line points={[startX, startY, currentX, currentY]}
                stroke={stroke} strokeWidth={sw} dash={[4, 2]} />;
            }
            return null;
          })()}
        </Layer>
      </Stage>
    </div>
  );
}
