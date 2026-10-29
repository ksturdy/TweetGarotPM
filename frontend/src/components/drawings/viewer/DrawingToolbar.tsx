import React, { useState } from 'react';
import type { ActiveTool, StampType } from '../../../lib/drawingViewer/types';

interface Props {
  activeTool: ActiveTool;
  activeColor: string;
  activeStrokeWidth: number;
  onToolChange: (tool: ActiveTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onBack: () => void;
  drawingTitle: string;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomScale: number;
}

const COLORS = ['#FF0000', '#FF6B00', '#FFD700', '#00AA00', '#0066CC', '#9B59B6', '#000000', '#FFFFFF'];
const WIDTHS = [1, 2, 3, 5, 8];

interface ToolBtn {
  tool: ActiveTool;
  icon: string;
  title: string;
}

const TOOL_GROUPS: ToolBtn[][] = [
  [
    { tool: 'pan', icon: '✋', title: 'Pan (H)' },
    { tool: 'select', icon: '↖', title: 'Select (V)' },
  ],
  [
    { tool: 'pencil', icon: '✏️', title: 'Pencil' },
    { tool: 'rectangle', icon: '▭', title: 'Rectangle' },
    { tool: 'circle', icon: '○', title: 'Circle/Ellipse' },
    { tool: 'arrow', icon: '→', title: 'Arrow' },
    { tool: 'line', icon: '╱', title: 'Line' },
    { tool: 'revision_cloud', icon: '☁', title: 'Revision Cloud' },
  ],
  [
    { tool: 'text', icon: 'T', title: 'Text' },
    { tool: 'callout', icon: '💬', title: 'Callout' },
    { tool: 'stamp', icon: '⬡', title: 'Stamp' },
  ],
  [
    { tool: 'issue_pin', icon: '📌', title: 'Issue Pin' },
    { tool: 'submittal_tag', icon: '🏷', title: 'Submittal Tag' },
  ],
  [
    { tool: 'calibrate', icon: '📐', title: 'Calibrate Scale' },
    { tool: 'measure_linear', icon: '📏', title: 'Linear Measure' },
    { tool: 'measure_area', icon: '⬛', title: 'Area Measure' },
  ],
];

export default function DrawingToolbar({
  activeTool, activeColor, activeStrokeWidth,
  onToolChange, onColorChange, onStrokeWidthChange,
  onUndo, onRedo, onExport, onBack, drawingTitle,
  zoomIn, zoomOut, zoomScale,
}: Props) {
  const [showColors, setShowColors] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: '#0f1b2d', borderBottom: '1px solid #1e3a5f',
      padding: '6px 12px', flexWrap: 'wrap', userSelect: 'none',
    }}>
      <button
        onClick={onBack}
        title="Back to drawings"
        style={{ ...btnStyle, background: 'transparent', color: '#7a9ab5', fontSize: 18, padding: '4px 8px' }}
      >
        ←
      </button>
      <span style={{ color: '#e0e8f0', fontSize: 13, fontWeight: 600, marginRight: 8 }}>
        {drawingTitle}
      </span>

      <div style={dividerStyle} />

      {TOOL_GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          <div style={{ display: 'flex', gap: 2 }}>
            {group.map(({ tool, icon, title }) => (
              <button
                key={tool}
                title={title}
                onClick={() => onToolChange(tool)}
                style={{
                  ...btnStyle,
                  background: activeTool === tool ? '#1e4a8a' : 'transparent',
                  color: activeTool === tool ? '#fff' : '#7a9ab5',
                  borderColor: activeTool === tool ? '#2d72d9' : 'transparent',
                }}
              >
                {icon}
              </button>
            ))}
          </div>
          {gi < TOOL_GROUPS.length - 1 && <div style={dividerStyle} />}
        </React.Fragment>
      ))}

      <div style={dividerStyle} />

      {/* Color picker */}
      <div style={{ position: 'relative' }}>
        <button
          title="Stroke color"
          onClick={() => setShowColors(v => !v)}
          style={{
            ...btnStyle,
            background: activeColor,
            border: '2px solid #444',
            width: 24, height: 24,
            borderRadius: 4,
            padding: 0,
          }}
        />
        {showColors && (
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 200,
            background: '#162032', border: '1px solid #1e3a5f',
            borderRadius: 6, padding: 6,
            display: 'grid', gridTemplateColumns: 'repeat(4, 20px)', gap: 4,
          }}>
            {COLORS.map(c => (
              <div
                key={c}
                onClick={() => { onColorChange(c); setShowColors(false); }}
                style={{
                  width: 20, height: 20, background: c,
                  borderRadius: 3, cursor: 'pointer',
                  border: c === activeColor ? '2px solid #fff' : '1px solid #444',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stroke width */}
      <select
        value={activeStrokeWidth}
        onChange={e => onStrokeWidthChange(Number(e.target.value))}
        style={{
          background: '#162032', color: '#cdd8e5', border: '1px solid #1e3a5f',
          borderRadius: 4, fontSize: 11, padding: '2px 4px',
        }}
      >
        {WIDTHS.map(w => <option key={w} value={w}>{w}px</option>)}
      </select>

      <div style={dividerStyle} />

      <button title="Undo" onClick={onUndo} style={btnStyle}>↩</button>
      <button title="Redo" onClick={onRedo} style={btnStyle}>↪</button>

      <div style={dividerStyle} />

      <button title="Zoom out" onClick={zoomOut} style={btnStyle}>−</button>
      <span style={{ color: '#7a9ab5', fontSize: 11, minWidth: 40, textAlign: 'center' }}>
        {Math.round(zoomScale * 100)}%
      </span>
      <button title="Zoom in" onClick={zoomIn} style={btnStyle}>+</button>

      <div style={{ flex: 1 }} />

      <button
        onClick={onExport}
        style={{ ...btnStyle, background: '#1e4a8a', color: '#fff', padding: '4px 12px', fontSize: 12 }}
      >
        Export PDF
      </button>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 4,
  color: '#7a9ab5',
  cursor: 'pointer',
  fontSize: 14,
  padding: '4px 6px',
  lineHeight: 1,
  transition: 'background 0.15s',
};

const dividerStyle: React.CSSProperties = {
  width: 1, height: 24,
  background: '#1e3a5f',
  margin: '0 4px',
};
