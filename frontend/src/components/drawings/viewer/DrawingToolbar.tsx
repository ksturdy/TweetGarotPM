import React, { useState } from 'react';
import type { ActiveTool } from '../../../lib/drawingViewer/types';

interface Props {
  activeTool: ActiveTool;
  activeColor: string;
  activeStrokeWidth: number;
  onToolChange: (tool: ActiveTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

interface ToolDef { tool: ActiveTool; icon: string; title: string }

const TOOL_GROUPS: ToolDef[][] = [
  [
    { tool: 'pan',    icon: '✋', title: 'Pan (H)' },
    { tool: 'select', icon: '↖',  title: 'Select (V)' },
  ],
  [
    { tool: 'pencil',         icon: '✏',  title: 'Pencil (P)' },
    { tool: 'rectangle',      icon: '▭',  title: 'Rectangle (R)' },
    { tool: 'circle',         icon: '○',  title: 'Circle' },
    { tool: 'arrow',          icon: '→',  title: 'Arrow (A)' },
    { tool: 'line',           icon: '╱',  title: 'Line (L)' },
    { tool: 'revision_cloud', icon: '☁',  title: 'Revision Cloud' },
  ],
  [
    { tool: 'text',    icon: 'T',  title: 'Text' },
    { tool: 'callout', icon: '💬', title: 'Callout' },
    { tool: 'stamp',   icon: '⬡',  title: 'Stamp' },
  ],
  [
    { tool: 'issue_pin',    icon: '📌', title: 'Issue Pin' },
    { tool: 'submittal_tag', icon: '🏷', title: 'Submittal Tag' },
  ],
  [
    { tool: 'calibrate',      icon: '📐', title: 'Calibrate Scale' },
    { tool: 'measure_linear', icon: '📏', title: 'Linear Measure' },
    { tool: 'measure_area',   icon: '⬛', title: 'Area Measure' },
  ],
];

const COLORS = ['#FF0000','#FF6B00','#FFD700','#00AA00','#0066CC','#9B59B6','#000000','#FFFFFF'];
const WIDTHS  = [1, 2, 3, 5, 8];

export default function DrawingToolbar({
  activeTool, activeColor, activeStrokeWidth,
  onToolChange, onColorChange, onStrokeWidthChange,
  onUndo, onRedo,
}: Props) {
  const [showColors, setShowColors] = useState(false);

  return (
    <div style={{
      width: 48,
      background: '#0f1b2d',
      borderRight: '1px solid #1e3a5f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '6px 0',
      gap: 0,
      overflowY: 'auto',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {TOOL_GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div style={sepStyle} />}
          {group.map(({ tool, icon, title }) => (
            <ToolButton
              key={tool}
              icon={icon}
              title={title}
              active={activeTool === tool}
              onClick={() => onToolChange(tool)}
            />
          ))}
        </React.Fragment>
      ))}

      <div style={sepStyle} />

      {/* Color swatch */}
      <div style={{ position: 'relative' }}>
        <button
          title={`Color: ${activeColor}`}
          onClick={() => setShowColors(v => !v)}
          style={{
            width: 32, height: 32,
            background: activeColor,
            border: '2px solid #2d4a6a',
            borderRadius: 6,
            cursor: 'pointer',
            margin: '2px 0',
            display: 'block',
          }}
        />
        {showColors && (
          <div style={{
            position: 'absolute',
            left: 38, top: 0, zIndex: 300,
            background: '#162032',
            border: '1px solid #1e3a5f',
            borderRadius: 8,
            padding: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 22px)',
            gap: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
            {COLORS.map(c => (
              <div
                key={c}
                onClick={() => { onColorChange(c); setShowColors(false); }}
                style={{
                  width: 22, height: 22,
                  background: c,
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: c === activeColor ? '2px solid #fff' : '1px solid #2d4a6a',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stroke width */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, margin: '4px 0' }}>
        {WIDTHS.map(w => (
          <button
            key={w}
            title={`${w}px`}
            onClick={() => onStrokeWidthChange(w)}
            style={{
              width: 32, height: 20,
              background: w === activeStrokeWidth ? '#1e4a8a' : 'transparent',
              border: `1px solid ${w === activeStrokeWidth ? '#2d72d9' : 'transparent'}`,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <div style={{
              width: 20, height: w,
              background: activeColor,
              borderRadius: w,
              maxHeight: 8,
            }} />
          </button>
        ))}
      </div>

      <div style={sepStyle} />

      <ToolButton icon="↩" title="Undo (Ctrl+Z)" active={false} onClick={onUndo} />
      <ToolButton icon="↪" title="Redo (Ctrl+Y)" active={false} onClick={onRedo} />
    </div>
  );
}

function ToolButton({ icon, title, active, onClick }: {
  icon: string; title: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        background: active ? '#1e4a8a' : 'transparent',
        border: `1px solid ${active ? '#2d72d9' : 'transparent'}`,
        borderRadius: 6,
        color: active ? '#fff' : '#7a9ab5',
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '1px 0',
        transition: 'background 0.1s',
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

const sepStyle: React.CSSProperties = {
  width: 32,
  height: 1,
  background: '#1e3a5f',
  margin: '5px 0',
  flexShrink: 0,
};
