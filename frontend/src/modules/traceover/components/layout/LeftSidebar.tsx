import { useState, useCallback, useRef, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useToolStore } from '../../stores/useToolStore';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { usePdfStore } from '../../stores/usePdfStore';
import type { PipeServiceType } from '../../types/piping';
import ToolPalette from '../tools/ToolPalette';
import ViewToolbar from '../view/ViewToolbar';
import MeasurementsPanel from '../tools/MeasurementsPanel';
import DrawingList from '../pdf/DrawingList';
import TraceoverConfigPanel from '../piping/TraceoverConfigPanel';
import TraceoverRunsPanel from '../piping/TraceoverRunsPanel';

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 240;
const MIN_UPPER_HEIGHT = 80;

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#4a6a88',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

export default function LeftSidebar() {
  const leftSidebarOpen = useUiStore((s) => s.leftSidebarOpen);
  const activeTool = useToolStore((s) => s.activeTool);
  const traceoverRuns = useTraceoverStore((s) => s.runs);
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(true);

  const availableServiceTypes = useMemo(() => {
    if (!activeDocumentId) return [] as PipeServiceType[];
    const pageRuns = traceoverRuns.filter(
      (r) => r.documentId === activeDocumentId && r.pageNumber === activePageNumber,
    );
    const unique = new Set(pageRuns.map((r) => r.config.serviceType));
    return Array.from(unique) as PipeServiceType[];
  }, [traceoverRuns, activeDocumentId, activePageNumber]);

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [upperHeight, setUpperHeight] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleWidthResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  const handleSplitResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const sidebar = sidebarRef.current;
      if (!sidebar) return;

      const sidebarHeight = sidebar.clientHeight;
      const startUpperHeight =
        upperHeight ?? sidebar.querySelector<HTMLDivElement>('[data-upper]')?.clientHeight ?? sidebarHeight / 2;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientY - startY;
        const maxUpper = sidebarHeight - 80;
        setUpperHeight(Math.min(maxUpper, Math.max(MIN_UPPER_HEIGHT, startUpperHeight + delta)));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [upperHeight],
  );

  if (!leftSidebarOpen) return null;

  const panelBorder: React.CSSProperties = {
    flexShrink: 0,
    borderBottom: '1px solid #1f3450',
    padding: 12,
  };

  return (
    <aside
      ref={sidebarRef}
      style={{
        position: 'relative',
        display: 'flex',
        height: '100%',
        flexShrink: 0,
        flexDirection: 'column',
        borderRight: '1px solid #1f3450',
        backgroundColor: '#0d1825',
        width,
      }}
    >
      {/* Upper panels */}
      <div
        data-upper
        style={{
          flexShrink: 0,
          overflowY: 'auto',
          ...(upperHeight != null ? { height: upperHeight } : {}),
        }}
      >
        {/* Tool Palette */}
        <div style={panelBorder}>
          <p style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
            Tools
          </p>
          <ToolPalette />
        </div>

        {/* View Toolbar */}
        <div style={panelBorder}>
          <button onClick={() => setViewOpen((o) => !o)} style={sectionHeaderStyle}>
            {viewOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            View
          </button>
          {viewOpen && (
            <div style={{ marginTop: 8 }}>
              <ViewToolbar availableServiceTypes={availableServiceTypes} />
            </div>
          )}
        </div>

        {/* Traceover Config — visible during traceover, piping item placement, and equipment placement */}
        {(activeTool === 'traceover' || activeTool === 'place_piping_item' || activeTool === 'place_equipment') && (
          <div style={panelBorder}>
            <p style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
              Pipe Config
            </p>
            <TraceoverConfigPanel />
          </div>
        )}

        {/* Traceover History */}
        {activeTool === 'traceover' && (
          <div style={panelBorder}>
            <button onClick={() => setHistoryOpen((o) => !o)} style={sectionHeaderStyle}>
              {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              History
            </button>
            {historyOpen && (
              <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                <TraceoverRunsPanel />
              </div>
            )}
          </div>
        )}

        {/* Measurements */}
        <div style={panelBorder}>
          <p style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
            Measurements
          </p>
          <MeasurementsPanel />
        </div>
      </div>

      {/* Vertical split handle */}
      <div
        onMouseDown={handleSplitResizeStart}
        style={{
          height: 4,
          flexShrink: 0,
          cursor: 'row-resize',
          borderTop: '1px solid #1f3450',
          borderBottom: '1px solid #1f3450',
        }}
      />

      {/* Drawings */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <p style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
          Drawings
        </p>
        <DrawingList />
      </div>

      {/* Width resize handle */}
      <div
        onMouseDown={handleWidthResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 10,
          height: '100%',
          width: 4,
          cursor: 'col-resize',
        }}
      />
    </aside>
  );
}
