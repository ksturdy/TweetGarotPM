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
import type { Drawing } from '../../../services/drawings';
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
import DrawingBottomBar from './DrawingBottomBar';
import LayerPanel from './LayerPanel';
import IssuePinPanel from './IssuePinPanel';
import SubmittalTagPanel from './SubmittalTagPanel';
import ScaleCalibrationModal from './ScaleCalibrationModal';
import { exportDrawingToPdf } from './drawingExporter';
import { useViewport } from './useViewport';

interface Props {
  drawing: Drawing;
  fileUrl: string;
  projectId: number;
  onBack: () => void;
}

interface PendingCalibration { x1: number; y1: number; x2: number; y2: number }
interface PendingMeasure { type: 'linear' | 'area'; points: Array<{ x: number; y: number }> }

export default function DrawingViewerShell({ drawing, fileUrl, projectId, onBack }: Props) {
  const [activePage, setActivePage]     = useState(1);
  const [activeTool, setActiveTool]     = useState<ActiveTool>('pan');
  const [activeColor, setActiveColor]   = useState('#FF0000');
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2);
  const [activeLayerId, setActiveLayerId] = useState<number | null>(null);

  const [layers, setLayers]             = useState<DrawingMarkupLayer[]>([]);
  const [markups, setMarkups]           = useState<DrawingMarkup[]>([]);
  const [issuePins, setIssuePins]       = useState<DrawingIssuePin[]>([]);
  const [submittalTags, setSubmittalTags] = useState<DrawingSubmittalTag[]>([]);
  const [measurements, setMeasurements] = useState<DrawingMeasurement[]>([]);
  const [scaleCalibration, setScaleCalibration] = useState<DrawingScaleCalibration | null>(null);

  const [selectedMarkupId, setSelectedMarkupId]         = useState<number | null>(null);
  const [selectedPinId, setSelectedPinId]               = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId]               = useState<number | null>(null);
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);

  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [pendingCalibration, setPendingCalibration]     = useState<PendingCalibration | null>(null);
  const [pendingMeasure, setPendingMeasure]             = useState<PendingMeasure | null>(null);
  const [pageW, setPageW]   = useState(0);
  const [pageH, setPageH]   = useState(0);

  const [leftPanelWidth, setLeftPanelWidth]   = useState(60);
  const [rightPanelWidth, setRightPanelWidth] = useState(220);
  const resizingRef         = useRef<'left' | 'right' | null>(null);
  const resizeStartXRef     = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const handleLeftResizeMouseDown = useCallback((e: React.MouseEvent) => {
    resizingRef.current = 'left';
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = leftPanelWidth;
    e.preventDefault();
  }, [leftPanelWidth]);

  const handleRightResizeMouseDown = useCallback((e: React.MouseEvent) => {
    resizingRef.current = 'right';
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = rightPanelWidth;
    e.preventDefault();
  }, [rightPanelWidth]);

  useEffect(() => {
    const SNAP = 36;
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      if (resizingRef.current === 'left') {
        const raw = resizeStartWidthRef.current + (e.clientX - resizeStartXRef.current);
        setLeftPanelWidth(raw < SNAP ? 0 : Math.min(200, raw));
      } else {
        const raw = resizeStartWidthRef.current + (resizeStartXRef.current - e.clientX);
        setRightPanelWidth(raw < SNAP ? 0 : Math.min(480, raw));
      }
    };
    const onMouseUp = () => { resizingRef.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const stageRef    = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport state lives here so bottom bar can read it
  const { stage: viewport, setStage: setViewport, handleWheel: handleWheelZoom, zoomIn, zoomOut, resetView } = useViewport();

  const zoomFit = useCallback(() => {
    if (!containerRef.current || pageW === 0) return;
    const { clientWidth: w, clientHeight: h } = containerRef.current;
    resetView(w, h, pageW, pageH);
  }, [containerRef, pageW, pageH, resetView]);

  // Load markup data + auto-create default layer if none exist
  useEffect(() => {
    let cancelled = false;
    loadMarkupData(drawing.id, activePage).then(async data => {
      if (cancelled) return;
      setMarkups(data.markups);
      setIssuePins(data.issuePins);
      setSubmittalTags(data.submittalTags);
      setMeasurements(data.measurements);
      setScaleCalibration(data.scaleCalibration);

      if (data.layers.length > 0) {
        setLayers(data.layers);
        setActiveLayerId(prev => prev ?? data.layers[0].id);
      } else {
        // Auto-create a default shared layer so tools work immediately
        try {
          const layer = await createLayer(drawing.id, activePage, {
            name: 'Markups',
            color: '#FF0000',
            is_personal: false,
          });
          if (!cancelled) {
            setLayers([layer]);
            setActiveLayerId(layer.id);
          }
        } catch {
          if (!cancelled) setLayers([]);
        }
      }
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [drawing.id, activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, ActiveTool> = {
        h: 'pan', v: 'select', p: 'pencil', r: 'rectangle',
        c: 'circle', a: 'arrow', l: 'line',
      };
      if (map[e.key]) setActiveTool(map[e.key]);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { /* undo */ }
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
      console.error('Save markup failed:', err);
    }
  }, [drawing.id, activePage]);

  const handleDeleteMarkup = useCallback(async (id: number) => {
    await deleteMarkup(drawing.id, id).catch(console.error);
    setMarkups(prev => prev.filter(m => m.id !== id));
    if (selectedMarkupId === id) setSelectedMarkupId(null);
  }, [drawing.id, selectedMarkupId]);

  const handlePinPlaced = useCallback(async (x: number, y: number) => {
    try {
      const { pin } = await createIssuePin(drawing.id, activePage, {
        x, y, create_issue: true, issue_title: 'Drawing Issue', issue_priority: 'normal',
      });
      setIssuePins(prev => [...prev, pin]);
      setSelectedPinId(pin.id);
    } catch (err) { console.error(err); }
  }, [drawing.id, activePage]);

  const handleDeletePin = useCallback(async (id: number) => {
    await deleteIssuePin(drawing.id, id).catch(console.error);
    setIssuePins(prev => prev.filter(p => p.id !== id));
    setSelectedPinId(null);
  }, [drawing.id]);

  const handleTagPlaced = useCallback(async (x: number, y: number, w: number, h: number) => {
    try {
      const tag = await createSubmittalTag(drawing.id, activePage, { x, y, width: w, height: h });
      setSubmittalTags(prev => [...prev, tag]);
      setSelectedTagId(tag.id);
    } catch (err) { console.error(err); }
  }, [drawing.id, activePage]);

  const handleDeleteTag = useCallback(async (id: number) => {
    await deleteSubmittalTag(drawing.id, id).catch(console.error);
    setSubmittalTags(prev => prev.filter(t => t.id !== id));
    setSelectedTagId(null);
  }, [drawing.id]);

  const handleCalibrationLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    setPendingCalibration({ x1, y1, x2, y2 });
    setShowCalibrationModal(true);
  }, []);

  const handleCalibrationSave = useCallback(async (realValue: number, unit: MeasurementUnit) => {
    if (!pendingCalibration) return;
    const cal = await saveScaleCalibration(drawing.id, activePage, {
      ...pendingCalibration,
      real_world_value: realValue,
      real_world_unit: unit,
    }).catch(console.error);
    if (cal) setScaleCalibration(cal);
    setShowCalibrationModal(false);
    setPendingCalibration(null);
    setActiveTool('pan');
  }, [drawing.id, activePage, pendingCalibration]);

  const handleMeasurePoint = useCallback((x: number, y: number) => {
    const type = activeTool === 'measure_linear' ? 'linear' : 'area';
    setPendingMeasure(prev => ({ type, points: [...(prev?.points || []), { x, y }] }));
  }, [activeTool]);

  const handleMeasureComplete = useCallback(async () => {
    if (!pendingMeasure || pendingMeasure.points.length < 2) {
      setPendingMeasure(null); return;
    }
    let computed: number | undefined;
    const unit = scaleCalibration?.real_world_unit || 'ft';
    if (scaleCalibration && pageW > 0 && pageH > 0) {
      const ppu = computePixelsPerUnit(scaleCalibration, pageW, pageH);
      if (pendingMeasure.type === 'linear' && pendingMeasure.points.length === 2) {
        const [p1, p2] = pendingMeasure.points;
        const px = distance({ x: p1.x * pageW, y: p1.y * pageH }, { x: p2.x * pageW, y: p2.y * pageH });
        computed = px / ppu;
      }
    }
    const m = await createMeasurement(drawing.id, activePage, {
      measure_type: pendingMeasure.type,
      points: pendingMeasure.points,
      computed_value: computed,
      unit,
    }).catch(console.error);
    if (m) setMeasurements(prev => [...prev, m]);
    setPendingMeasure(null);
  }, [pendingMeasure, scaleCalibration, pageW, pageH, drawing.id, activePage]);

  const handleAddLayer = useCallback(async (name: string, color: string, isPersonal: boolean) => {
    const layer = await createLayer(drawing.id, activePage, { name, color, is_personal: isPersonal }).catch(console.error);
    if (layer) { setLayers(prev => [...prev, layer]); setActiveLayerId(layer.id); }
  }, [drawing.id, activePage]);

  const handleToggleVisibility = useCallback(async (layer: DrawingMarkupLayer) => {
    const updated = await updateLayer(drawing.id, layer.id, { is_visible: !layer.is_visible }).catch(console.error);
    if (updated) setLayers(prev => prev.map(l => l.id === layer.id ? updated : l));
  }, [drawing.id]);

  const handleDeleteLayer = useCallback(async (id: number) => {
    await deleteLayer(drawing.id, id).catch(console.error);
    setLayers(prev => prev.filter(l => l.id !== id));
    if (activeLayerId === id) setActiveLayerId(layers.find(l => l.id !== id)?.id || null);
  }, [drawing.id, activeLayerId, layers]);

  const handleExport = useCallback(() => {
    exportDrawingToPdf(stageRef, fileUrl, activePage, drawing.title || drawing.drawing_number);
  }, [stageRef, fileUrl, activePage, drawing]);

  const selectedPin = issuePins.find(p => p.id === selectedPinId) || null;
  const selectedTag = submittalTags.find(t => t.id === selectedTagId) || null;
  const pageCount   = drawing.page_count || 1;

  const rightPanel = selectedPin ? (
    <IssuePinPanel
      pin={selectedPin} projectId={projectId} drawingId={drawing.id}
      onClose={() => setSelectedPinId(null)} onDelete={handleDeletePin}
      onUpdate={updatedPin => setIssuePins(prev => prev.map(p => p.id === updatedPin.id ? updatedPin : p))}
    />
  ) : selectedTag ? (
    <SubmittalTagPanel
      tag={selectedTag} projectId={projectId} drawingId={drawing.id}
      onClose={() => setSelectedTagId(null)} onDelete={handleDeleteTag}
      onUpdate={updatedTag => setSubmittalTags(prev => prev.map(t => t.id === updatedTag.id ? updatedTag : t))}
    />
  ) : (
    <LayerPanel layers={layers} activeLayerId={activeLayerId}
      onSelectLayer={setActiveLayerId}
      onToggleVisibility={handleToggleVisibility}
      onAddLayer={handleAddLayer}
      onDeleteLayer={handleDeleteLayer}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a1628', overflow: 'hidden' }}>

      {/* ── Thin top header: back + title + export ── */}
      <div style={{
        height: 40, flexShrink: 0,
        background: '#0f1b2d',
        borderBottom: '1px solid #1e3a5f',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 10,
      }}>
        <button
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: '#7a9ab5', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          title="Back to drawings"
        >
          ←
        </button>
        <span style={{ color: '#cdd8e5', fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {drawing.title || drawing.drawing_number}
        </span>
        <button
          onClick={handleExport}
          style={{
            background: '#1e4a8a', border: 'none', color: '#fff',
            borderRadius: 5, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
          }}
        >
          Export PDF
        </button>
      </div>

      {/* ── Main row: toolbar | left panel | canvas | right panel ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left vertical toolbar (fixed) */}
        <DrawingToolbar
          activeTool={activeTool}
          activeColor={activeColor}
          activeStrokeWidth={activeStrokeWidth}
          onToolChange={setActiveTool}
          onColorChange={setActiveColor}
          onStrokeWidthChange={setActiveStrokeWidth}
          onUndo={() => {}}
          onRedo={() => {}}
        />

        {/* Left page-list panel */}
        {leftPanelWidth === 0 ? (
          <div
            onClick={() => setLeftPanelWidth(60)}
            title="Show page list"
            style={{
              width: 12, flexShrink: 0, cursor: 'pointer',
              background: '#0c1520', borderRight: '1px solid #1e3a5f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#2d4a6a', fontSize: 14, lineHeight: 1 }}>›</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <div className="dv-page-list" style={{
              width: leftPanelWidth,
              background: '#0c1520',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              display: 'flex', flexDirection: 'column',
              gap: 4, padding: '6px 4px',
            } as React.CSSProperties}>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(pg => (
                <div
                  key={pg}
                  onClick={() => setActivePage(pg)}
                  style={{
                    background: pg === activePage ? '#1e4a8a' : '#162032',
                    border: `1px solid ${pg === activePage ? '#2d72d9' : '#1e3a5f'}`,
                    borderRadius: 4, padding: '6px 2px', cursor: 'pointer',
                    textAlign: 'center', color: '#cdd8e5', fontSize: 11, flexShrink: 0,
                  }}
                >
                  {pg}
                </div>
              ))}
            </div>
            {/* Right-edge drag handle */}
            <div
              onMouseDown={handleLeftResizeMouseDown}
              title="Drag to resize · click to collapse"
              style={{
                width: 8, flexShrink: 0, cursor: 'col-resize',
                background: '#0c1520', borderRight: '1px solid #1e3a5f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 2, height: 32, background: '#2d4a6a', borderRadius: 1 }} />
            </div>
          </div>
        )}

        {/* Center: canvas + bottom bar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }}>
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
              viewportStage={viewport}
              onViewportChange={setViewport}
              onWheelZoom={handleWheelZoom}
              onSelectMarkup={setSelectedMarkupId}
              onSelectPin={setSelectedPinId}
              onSelectTag={setSelectedTagId}
              onSelectMeasurement={setSelectedMeasurementId}
              onPageDimensionsReady={(w, h) => {
                setPageW(w);
                setPageH(h);
                if (containerRef.current) {
                  const { clientWidth: cw, clientHeight: ch } = containerRef.current;
                  resetView(cw, ch, w, h);
                }
              }}
              stageRef={stageRef}
            />
          </div>
          <DrawingBottomBar
            zoomScale={viewport.scale}
            zoomIn={zoomIn}
            zoomOut={zoomOut}
            zoomFit={zoomFit}
            activeTool={activeTool}
            scaleCalibration={scaleCalibration}
            pageNumber={activePage}
            pageCount={pageCount}
          />
        </div>

        {/* Right panel */}
        {rightPanelWidth === 0 ? (
          <div
            onClick={() => setRightPanelWidth(220)}
            title="Show panel"
            style={{
              width: 12, flexShrink: 0, cursor: 'pointer',
              background: '#0f1b2d', borderLeft: '1px solid #1e3a5f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#2d4a6a', fontSize: 14, lineHeight: 1 }}>‹</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {/* Left-edge drag handle */}
            <div
              onMouseDown={handleRightResizeMouseDown}
              title="Drag to resize · drag closed to collapse"
              style={{
                width: 8, flexShrink: 0, cursor: 'col-resize',
                background: '#0f1b2d', borderLeft: '1px solid #1e3a5f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 2, height: 32, background: '#2d4a6a', borderRadius: 1 }} />
            </div>
            <div style={{
              width: rightPanelWidth, flexShrink: 0,
              background: '#0f1b2d', overflowY: 'auto',
            }}>
              {rightPanel}
            </div>
          </div>
        )}
      </div>

      {showCalibrationModal && (
        <ScaleCalibrationModal
          onSave={handleCalibrationSave}
          onCancel={() => { setShowCalibrationModal(false); setPendingCalibration(null); }}
        />
      )}
    </div>
  );
}
