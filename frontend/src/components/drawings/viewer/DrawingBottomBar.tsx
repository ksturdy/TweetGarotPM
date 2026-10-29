import React from 'react';
import type { DrawingScaleCalibration, MeasurementUnit } from '../../../lib/drawingViewer/types';

interface Props {
  zoomScale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  activeTool: string;
  scaleCalibration: DrawingScaleCalibration | null;
  pageNumber: number;
  pageCount: number;
}

const UNIT_LABEL: Record<MeasurementUnit, string> = { ft: 'ft', in: 'in', m: 'm', mm: 'mm' };

export default function DrawingBottomBar({
  zoomScale, zoomIn, zoomOut, zoomFit,
  activeTool, scaleCalibration, pageNumber, pageCount,
}: Props) {
  const toolHints: Record<string, string> = {
    pan: 'Drag to pan · Scroll to zoom',
    select: 'Click a markup to select it',
    pencil: 'Click and drag to draw',
    rectangle: 'Click and drag to draw rectangle',
    circle: 'Click and drag to draw ellipse',
    arrow: 'Click and drag to place arrow',
    line: 'Click and drag to draw line',
    revision_cloud: 'Click and drag to sketch revision cloud',
    text: 'Click to place text',
    callout: 'Click start, drag to callout box',
    stamp: 'Click to place stamp',
    issue_pin: 'Click on drawing to place issue pin',
    submittal_tag: 'Click and drag to tag equipment area',
    calibrate: 'Draw a line over a known dimension',
    measure_linear: 'Click points · Double-click to finish',
    measure_area: 'Click points · Double-click to close area',
  };

  return (
    <div style={{
      height: 34,
      background: '#0a1422',
      borderTop: '1px solid #1e3a5f',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      flexShrink: 0,
      userSelect: 'none',
      position: 'relative',
    }}>
      {/* Left: page + scale info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span style={{ color: '#4a6480', fontSize: 11 }}>
          Page {pageNumber}{pageCount > 1 ? ` of ${pageCount}` : ''}
        </span>
        {scaleCalibration && (
          <>
            <div style={{ width: 1, height: 18, background: '#1e3a5f' }} />
            <span style={{ color: '#4a6480', fontSize: 11 }}>
              Scale set ({UNIT_LABEL[scaleCalibration.real_world_unit as MeasurementUnit] ?? scaleCalibration.real_world_unit})
            </span>
          </>
        )}
      </div>

      {/* Center: zoom controls (absolutely centered) */}
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <button onClick={zoomOut} style={zBtn} title="Zoom out">−</button>
        <button onClick={zoomFit} title="Fit page" style={{ ...zBtn, minWidth: 52, fontSize: 11 }}>
          {Math.round(zoomScale * 100)}%
        </button>
        <button onClick={zoomIn} style={zBtn} title="Zoom in">+</button>
        <button onClick={zoomFit} style={{ ...zBtn, padding: '0 8px', fontSize: 10, minWidth: 28 }} title="Fit to window">
          Fit
        </button>
      </div>

      {/* Right: tool hint */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {toolHints[activeTool] && (
          <span style={{ color: '#3a5470', fontSize: 11, fontStyle: 'italic' }}>
            {toolHints[activeTool]}
          </span>
        )}
      </div>
    </div>
  );
}

const zBtn: React.CSSProperties = {
  background: '#162032',
  border: '1px solid #1e3a5f',
  color: '#cdd8e5',
  borderRadius: 4,
  padding: '0 8px',
  height: 22,
  fontSize: 14,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 26,
};
