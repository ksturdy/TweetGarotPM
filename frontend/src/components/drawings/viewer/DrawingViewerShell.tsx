import React, { useState, useRef, useCallback, useEffect } from 'react';
import type Konva from 'konva';
import type {
  ActiveTool,
  DrawingMarkupLayer,
  DrawingMarkup,
  DrawingIssuePin,
  DrawingSubmittalTag,
  DrawingMeasurement,
  DrawingScaleCalibration,
  MeasurementUnit,
  MarkupStyle,
} from '../../../lib/drawingViewer/types';
import type { Drawing, DrawingPage } from '../../../services/drawings';
import {
  loadMarkupData,
  createLayer, updateLayer, deleteLayer,
  createMarkup, deleteMarkup,
  createIssuePin, deleteIssuePin,
  createSubmittalTag, deleteSubmittalTag,
  saveScaleCalibration,
  createMeasurement, deleteMeasurement,
} from '../../../services/drawingMarkups';
import { computePixelsPerUnit } from '../../../lib/drawingViewer/scale';
import { distance } from '../../../lib/drawingViewer/geometry';
import DrawingCanvas from './DrawingCanvas';
import DrawingToolbar from './DrawingToolbar';
import LayerPanel from './LayerPanel';
import IssuePinPanel from './IssuePinPanel';
import SubmittalTagPanel from './SubmittalTagPanel';
import ScaleCalibrationModal from './ScaleCalibrationModal';
import { exportDrawingToPdf } from './drawingExporter';
import { useViewport } from './useViewport';

interface Props {
  drawing: Drawing;
  pages: DrawingPage[];
  fileUrl: string;
  projectId: number;
  onBack: () => void;
}

interface PendingCalibration {
  x1: number; y1: number; x2: number; y2: number;
}

interface PendingMeasure {
  type: 'linear' | 'area';
  points: Array<{ x: number; y: number }>;
}

export default function DrawingViewerShell({ drawing, pages, fileUrl, projectId, onBack }: Props) {
  const [activePage, setActivePage] = useState(1);
  const [activeTool, setActiveTool] = useState<ActiveTool>('pan');
  const [activeColor, setActiveColor] = useState('#FF0000');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);

  const [layers, setLayers] = useState<DrawingMarkupLayer[]>([]);
  const [markups, setMarkups] = useState<DrawingMarkup[]>([]);
  const [issuePins, setIssuePins] = useState<DrawingIssuePin[]>([]);
  const [submittalTags, setSubmittalTags] = useState<DrawingSubmittalTag[]>([]);
  const [measurements, setMeasurements] = useState<DrawingMeasurement[]>([]);
  const [scaleCalibration, setScaleCalibration] = useState<DrawingScaleCalibration | null>(null);

  const [selectedMarkupId, setSelectedMarkupId] = useState<number | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);

  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [pendingCalibration, setPendingCalibration] = useState<PendingCalibration | null>(null);
  const [pendingMeasure, setPendingMeasure] = useState<PendingMeasure | null>(null);
  const [pageW, setPageW] = useState(0);
  const [pageH, setPageH] = useState(0);

  const stageRef = useRef<Konva.Stage | null>(null);
  const { stage: viewportStage, zoomIn, zoomOut } = useViewport();

  // Load markup data on page change
  useEffect(() => {
    loadMarkupData(drawing.id, activePage).then(data => {
      setLayers(data.layers);
      setMarkups(data.markups);
      setIssuePins(data.issuePins);
      setSubmittalTags(data.submittalTags);
      setMeasurements(data.measurements);
      setScaleCalibration(data.scaleCalibration);
      // Auto-select first visible layer or first layer
      if (data.layers.length > 0 && activeLayerId === null) {
        setActiveLayerId(data.layers[0].id);
      }
    }).catch(console.error);
  }, [drawing.id, activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const shortcuts: Record<string, ActiveTool> = {
        h: 'pan', v: 'select', p: 'pencil', r: 'rectangle',
        c: 'circle', a: 'arrow', l: 'line',
      };
      if (shortcuts[e.key]) setActiveTool(shortcuts[e.key]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleMarkupComplete = useCallback(async (layerId: number, geometry: unknown, style: MarkupStyle) => {
    try {
      const markup = await createMarkup(drawing.id, activePage, {
        layer_id: layerId,
        tool_type: (geometry as any).type,
        geometry: geometry as any,
        style,
      });
      setMarkups(prev => [...prev, markup]);
    } catch (err) {
      console.error('Failed to save markup', err);
    }
  }, [drawing.id, activePage]);

  const handleDeleteMarkup = useCallback(async (id: number) => {
    try {
      await deleteMarkup(drawing.id, id);
      setMarkups(prev => prev.filter(m => m.id !== id));
      if (selectedMarkupId === id) setSelectedMarkupId(null);
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id, selectedMarkupId]);

  const handlePinPlaced = useCallback(async (x: number, y: number) => {
    try {
      const { pin } = await createIssuePin(drawing.id, activePage, {
        x, y, create_issue: true,
        issue_title: `Drawing Issue`,
        issue_priority: 'normal',
      });
      setIssuePins(prev => [...prev, pin]);
      setSelectedPinId(pin.id);
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id, activePage]);

  const handleDeletePin = useCallback(async (id: number) => {
    try {
      await deleteIssuePin(drawing.id, id);
      setIssuePins(prev => prev.filter(p => p.id !== id));
      setSelectedPinId(null);
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id]);

  const handleTagPlaced = useCallback(async (x: number, y: number, w: number, h: number) => {
    try {
      const tag = await createSubmittalTag(drawing.id, activePage, { x, y, width: w, height: h });
      setSubmittalTags(prev => [...prev, tag]);
      setSelectedTagId(tag.id);
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id, activePage]);

  const handleDeleteTag = useCallback(async (id: number) => {
    try {
      await deleteSubmittalTag(drawing.id, id);
      setSubmittalTags(prev => prev.filter(t => t.id !== id));
      setSelectedTagId(null);
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id]);

  const handleCalibrationLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    setPendingCalibration({ x1, y1, x2, y2 });
    setShowCalibrationModal(true);
  }, []);

  const handleCalibrationSave = useCallback(async (realValue: number, unit: MeasurementUnit) => {
    if (!pendingCalibration) return;
    try {
      const cal = await saveScaleCalibration(drawing.id, activePage, {
        ...pendingCalibration,
        real_world_value: realValue,
        real_world_unit: unit,
      });
      setScaleCalibration(cal);
    } catch (err) {
      console.error(err);
    }
    setShowCalibrationModal(false);
    setPendingCalibration(null);
    setActiveTool('pan');
  }, [drawing.id, activePage, pendingCalibration]);

  const handleMeasurePoint = useCallback((x: number, y: number) => {
    const type = activeTool === 'measure_linear' ? 'linear' : 'area';
    setPendingMeasure(prev => ({
      type,
      points: [...(prev?.points || []), { x, y }],
    }));
  }, [activeTool]);

  const handleMeasureComplete = useCallback(async () => {
    if (!pendingMeasure || pendingMeasure.points.length < 2) {
      setPendingMeasure(null);
      return;
    }
    try {
      let computed: number | undefined;
      let unit: string = scaleCalibration?.real_world_unit || 'ft';

      if (scaleCalibration && pageW > 0 && pageH > 0) {
        const ppu = computePixelsPerUnit(scaleCalibration, pageW, pageH);
        if (pendingMeasure.type === 'linear' && pendingMeasure.points.length === 2) {
          const p1 = pendingMeasure.points[0], p2 = pendingMeasure.points[1];
          const pixDist = distance(
            { x: p1.x * pageW, y: p1.y * pageH },
            { x: p2.x * pageW, y: p2.y * pageH }
          );
          computed = pixDist / ppu;
        }
      }

      const m = await createMeasurement(drawing.id, activePage, {
        measure_type: pendingMeasure.type,
        points: pendingMeasure.points,
        computed_value: computed,
        unit,
      });
      setMeasurements(prev => [...prev, m]);
    } catch (err) {
      console.error(err);
    }
    setPendingMeasure(null);
  }, [pendingMeasure, scaleCalibration, pageW, pageH, drawing.id, activePage]);

  const handleAddLayer = useCallback(async (name: string, color: string, isPersonal: boolean) => {
    try {
      const layer = await createLayer(drawing.id, activePage, { name, color, is_personal: isPersonal });
      setLayers(prev => [...prev, layer]);
      setActiveLayerId(layer.id);
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id, activePage]);

  const handleToggleLayerVisibility = useCallback(async (layer: DrawingMarkupLayer) => {
    try {
      const updated = await updateLayer(drawing.id, layer.id, { is_visible: !layer.is_visible });
      setLayers(prev => prev.map(l => l.id === layer.id ? updated : l));
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id]);

  const handleDeleteLayer = useCallback(async (id: number) => {
    try {
      await deleteLayer(drawing.id, id);
      setLayers(prev => prev.filter(l => l.id !== id));
      if (activeLayerId === id) {
        setActiveLayerId(layers.find(l => l.id !== id)?.id || null);
      }
    } catch (err) {
      console.error(err);
    }
  }, [drawing.id, activeLayerId, layers]);

  const handleExport = useCallback(() => {
    exportDrawingToPdf(stageRef, fileUrl, activePage, drawing.title || drawing.drawing_number);
  }, [stageRef, fileUrl, activePage, drawing]);

  const selectedPin = issuePins.find(p => p.id === selectedPinId) || null;
  const selectedTag = submittalTags.find(t => t.id === selectedTagId) || null;

  const rightPanelContent = selectedPin ? (
    <IssuePinPanel
      pin={selectedPin}
      projectId={projectId}
      onClose={() => setSelectedPinId(null)}
      onDelete={handleDeletePin}
    />
  ) : selectedTag ? (
    <SubmittalTagPanel
      tag={selectedTag}
      projectId={projectId}
      onClose={() => setSelectedTagId(null)}
      onDelete={handleDeleteTag}
    />
  ) : (
    <LayerPanel
      layers={layers}
      activeLayerId={activeLayerId}
      onSelectLayer={setActiveLayerId}
      onToggleVisibility={handleToggleLayerVisibility}
      onAddLayer={handleAddLayer}
      onDeleteLayer={handleDeleteLayer}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a1628', overflow: 'hidden' }}>
      {/* Top toolbar */}
      <DrawingToolbar
        activeTool={activeTool}
        activeColor={activeColor}
        activeStrokeWidth={activeStrokeWidth}
        onToolChange={setActiveTool}
        onColorChange={setActiveColor}
        onStrokeWidthChange={setActiveStrokeWidth}
        onUndo={() => {/* TODO: hook up undo/redo */}}
        onRedo={() => {}}
        onExport={handleExport}
        onBack={onBack}
        drawingTitle={drawing.title || drawing.drawing_number}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        zoomScale={viewportStage.scale}
      />

      {/* Main 3-panel layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: page list */}
        <div style={{
          width: 80, flexShrink: 0,
          background: '#0f1b2d', borderRight: '1px solid #1e3a5f',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: 6,
        }}>
          {(drawing.page_count && drawing.page_count > 1
            ? Array.from({ length: drawing.page_count }, (_, i) => i + 1)
            : [1]
          ).map(pg => (
            <div
              key={pg}
              onClick={() => setActivePage(pg)}
              style={{
                background: pg === activePage ? '#1e4a8a' : '#162032',
                border: `1px solid ${pg === activePage ? '#2d72d9' : '#1e3a5f'}`,
                borderRadius: 4, padding: '8px 4px', cursor: 'pointer',
                textAlign: 'center', color: '#cdd8e5', fontSize: 11,
              }}
            >
              {pg}
            </div>
          ))}
        </div>

        {/* Center: canvas */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <DrawingCanvas
            drawingFileUrl={fileUrl}
            pageNumber={activePage}
            activeTool={activeTool}
            activeColor={activeColor}
            activeStrokeWidth={activeStrokeWidth}
            activeLayerId={activeLayerId}
            layers={layers}
            markups={markups}
            issuePins={issuePins}
            submittalTags={submittalTags}
            measurements={measurements}
            scaleCalibration={scaleCalibration}
            selectedMarkupId={selectedMarkupId}
            selectedPinId={selectedPinId}
            selectedTagId={selectedTagId}
            selectedMeasurementId={selectedMeasurementId}
            onMarkupComplete={handleMarkupComplete}
            onPinPlaced={handlePinPlaced}
            onTagPlaced={handleTagPlaced}
            onCalibrationLine={handleCalibrationLine}
            onMeasurePoint={handleMeasurePoint}
            onMeasureComplete={handleMeasureComplete}
            onSelectMarkup={setSelectedMarkupId}
            onSelectPin={setSelectedPinId}
            onSelectTag={setSelectedTagId}
            onSelectMeasurement={setSelectedMeasurementId}
            stageRef={stageRef}
          />
        </div>

        {/* Right: layers / detail panel */}
        <div style={{
          width: 220, flexShrink: 0,
          background: '#0f1b2d', borderLeft: '1px solid #1e3a5f',
          overflowY: 'auto',
        }}>
          {rightPanelContent}
        </div>
      </div>

      {/* Calibration modal */}
      {showCalibrationModal && (
        <ScaleCalibrationModal
          onSave={handleCalibrationSave}
          onCancel={() => { setShowCalibrationModal(false); setPendingCalibration(null); }}
        />
      )}
    </div>
  );
}
