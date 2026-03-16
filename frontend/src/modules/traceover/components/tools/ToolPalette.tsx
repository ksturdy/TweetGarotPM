import { useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  BoxSelect,
  Ruler,
  Scale,
  Square,
  Hash,
  Route,
  ZoomIn,
  ZoomOut,
  Fan,
  Puzzle,
  Save,
} from 'lucide-react';
import IconButton from '../ui/IconButton';
import { useToolStore } from '../../stores/useToolStore';
import { useViewportStore } from '../../stores/useViewportStore';
import { useUiStore } from '../../stores/useUiStore';
import type { ToolType } from '../../types';

interface ToolDefinition {
  tool: ToolType;
  icon: React.ReactNode;
  tooltip: string;
  shortcut?: string;
}

const drawingTools: ToolDefinition[] = [
  { tool: 'select', icon: <MousePointer2 size={18} />, tooltip: 'Select (V)', shortcut: 'v' },
  { tool: 'pan', icon: <Hand size={18} />, tooltip: 'Pan (H)', shortcut: 'h' },
  { tool: 'window_select', icon: <BoxSelect size={18} />, tooltip: 'Window Select (W)', shortcut: 'w' },
  { tool: 'calibrate', icon: <Scale size={18} />, tooltip: 'Set Scale (S)', shortcut: 's' },
  { tool: 'linear', icon: <Ruler size={18} />, tooltip: 'Measure Distance (M)', shortcut: 'm' },
  { tool: 'area', icon: <Square size={18} />, tooltip: 'Area Measure (A)', shortcut: 'a' },
  { tool: 'count', icon: <Hash size={18} />, tooltip: 'Count (C)', shortcut: 'c' },
  { tool: 'traceover', icon: <Route size={18} />, tooltip: 'Pipe Traceover (T)', shortcut: 't' },
];

const zoomTools: ToolDefinition[] = [
  { tool: 'zoom_in', icon: <ZoomIn size={18} />, tooltip: 'Zoom In' },
  { tool: 'zoom_out', icon: <ZoomOut size={18} />, tooltip: 'Zoom Out' },
];

/** Map from keyboard key to tool type for hotkeys. */
const shortcutMap = new Map<string, ToolType>(
  drawingTools
    .filter((d) => d.shortcut)
    .map((d) => [d.shortcut!, d.tool]),
);

export default function ToolPalette() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setTool = useToolStore((s) => s.setTool);
  const zoomIn = useViewportStore((s) => s.zoomIn);
  const zoomOut = useViewportStore((s) => s.zoomOut);
  const showPipingPalette = useUiStore((s) => s.showPipingPalette);
  const togglePipingPalette = useUiStore((s) => s.togglePipingPalette);
  const showEquipmentPalette = useUiStore((s) => s.showEquipmentPalette);
  const toggleEquipmentPalette = useUiStore((s) => s.toggleEquipmentPalette);
  const showAssemblyPalette = useUiStore((s) => s.showAssemblyPalette);
  const toggleAssemblyPalette = useUiStore((s) => s.toggleAssemblyPalette);
  const setShowSaveAssemblyDialog = useUiStore((s) => s.setShowSaveAssemblyDialog);
  const selectedItems = useToolStore((s) => s.selectedItems);
  const hasSelection = selectedItems.length > 0 && selectedItems.some(
    (s) => s.type === 'traceover_run' || s.type === 'takeoff_item',
  );

  const handleToolClick = (tool: ToolType) => {
    if (tool === 'zoom_in') {
      zoomIn();
      return;
    }
    if (tool === 'zoom_out') {
      zoomOut();
      return;
    }
    setTool(tool);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        togglePipingPalette();
        return;
      }
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleEquipmentPalette();
        return;
      }
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleAssemblyPalette();
        return;
      }

      const tool = shortcutMap.get(e.key.toLowerCase());
      if (tool) {
        e.preventDefault();
        setTool(tool);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, togglePipingPalette, toggleEquipmentPalette, toggleAssemblyPalette]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {drawingTools.map(({ tool, icon, tooltip }) => (
        <IconButton
          key={tool}
          title={tooltip}
          active={activeTool === tool}
          onClick={() => handleToolClick(tool)}
        >
          {icon}
        </IconButton>
      ))}

      {/* Separator */}
      <div style={{ height: 1, width: '100%', backgroundColor: '#1f3450', margin: '2px 0' }} />

      {zoomTools.map(({ tool, icon, tooltip }) => (
        <IconButton
          key={tool}
          title={tooltip}
          active={activeTool === tool}
          onClick={() => handleToolClick(tool)}
        >
          {icon}
        </IconButton>
      ))}

      {/* Separator */}
      <div style={{ height: 1, width: '100%', backgroundColor: '#1f3450', margin: '2px 0' }} />

      {/* Placement palettes */}
      <IconButton
        title={showPipingPalette ? 'Close Piping Palette (P)' : 'Piping Items (P)'}
        active={showPipingPalette}
        onClick={togglePipingPalette}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2v8c0 2.2 1.8 4 4 4h8" />
          <path d="M14 2v4c0 2.2 1.8 4 4 4h4" />
          <line x1="10" y1="2" x2="14" y2="2" />
          <line x1="22" y1="10" x2="22" y2="14" />
        </svg>
      </IconButton>
      <IconButton
        title={showEquipmentPalette ? 'Close Equipment Palette (E)' : 'Equipment (E)'}
        active={showEquipmentPalette}
        onClick={toggleEquipmentPalette}
      >
        <Fan size={18} />
      </IconButton>
      <IconButton
        title={showAssemblyPalette ? 'Close Assemblies (D)' : 'Assemblies (D)'}
        active={showAssemblyPalette}
        onClick={toggleAssemblyPalette}
      >
        <Puzzle size={18} />
      </IconButton>

      {/* Save as Assembly — visible when items are selected */}
      {hasSelection && (
        <IconButton
          title="Save Selection as Assembly"
          onClick={() => setShowSaveAssemblyDialog(true)}
        >
          <Save size={18} />
        </IconButton>
      )}
    </div>
  );
}
