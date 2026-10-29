import { useState, useCallback, useRef } from 'react';
import type Konva from 'konva';
import type { ActiveTool, MarkupGeometry, MarkupStyle } from '../../../lib/drawingViewer/types';
import { toNormalized } from '../../../lib/drawingViewer/coordUtils';

export interface DraftShape {
  tool: ActiveTool;
  // Raw pixel coords within the page (before normalization)
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  points?: number[]; // for pencil/revision_cloud (page pixels)
}

export interface CompletedShape {
  geometry: MarkupGeometry;
  style: MarkupStyle;
}

export function useMarkupTools(
  activeTool: ActiveTool,
  activeColor: string,
  activeStrokeWidth: number,
  pageWidthPx: number,
  pageHeightPx: number,
  onComplete: (shape: CompletedShape) => void,
) {
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const drawingRef = useRef(false);

  const getStagePos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  };

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (activeTool === 'pan' || activeTool === 'select') return;
    // Don't start on shapes/pins — only on background
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') return;

    const pos = getStagePos(e);
    if (!pos) return;

    drawingRef.current = true;
    setDraft({
      tool: activeTool,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      points: (activeTool === 'pencil' || activeTool === 'revision_cloud')
        ? [pos.x, pos.y]
        : undefined,
    });
  }, [activeTool]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingRef.current || !draft) return;
    const pos = getStagePos(e);
    if (!pos) return;

    setDraft(d => {
      if (!d) return d;
      const updates: Partial<DraftShape> = { currentX: pos.x, currentY: pos.y };
      if (d.points) {
        updates.points = [...d.points, pos.x, pos.y];
      }
      return { ...d, ...updates };
    });
  }, [draft]);

  const handleMouseUp = useCallback((_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingRef.current || !draft) return;
    drawingRef.current = false;
    setDraft(null);

    const { tool, startX, startY, currentX, currentY, points } = draft;
    const w = pageWidthPx, h = pageHeightPx;

    const style: MarkupStyle = {
      stroke: activeColor,
      strokeWidth: activeStrokeWidth,
      fill: 'transparent',
      opacity: 1,
    };

    let geometry: MarkupGeometry | null = null;

    if (tool === 'pencil' && points && points.length >= 4) {
      const norm: number[] = [];
      for (let i = 0; i < points.length; i += 2) {
        const n = toNormalized(points[i], points[i + 1], w, h);
        norm.push(n.x, n.y);
      }
      geometry = { type: 'pencil', points: norm };
    } else if (tool === 'revision_cloud' && points && points.length >= 4) {
      const norm: number[] = [];
      for (let i = 0; i < points.length; i += 2) {
        const n = toNormalized(points[i], points[i + 1], w, h);
        norm.push(n.x, n.y);
      }
      geometry = { type: 'revision_cloud', points: norm };
    } else if (tool === 'rectangle') {
      const minX = Math.min(startX, currentX);
      const minY = Math.min(startY, currentY);
      const nPos = toNormalized(minX, minY, w, h);
      const nSize = toNormalized(Math.abs(currentX - startX), Math.abs(currentY - startY), w, h);
      if (nSize.x > 0.005 || nSize.y > 0.005) {
        geometry = { type: 'rectangle', x: nPos.x, y: nPos.y, width: nSize.x, height: nSize.y };
        style.fill = 'transparent';
      }
    } else if (tool === 'circle') {
      const nC = toNormalized((startX + currentX) / 2, (startY + currentY) / 2, w, h);
      const rx = toNormalized(Math.abs(currentX - startX) / 2, 0, w, h).x;
      const ry = toNormalized(0, Math.abs(currentY - startY) / 2, w, h).y;
      if (rx > 0.005 || ry > 0.005) {
        geometry = { type: 'circle', cx: nC.x, cy: nC.y, rx, ry };
        style.fill = 'transparent';
      }
    } else if (tool === 'arrow' || tool === 'line') {
      const n1 = toNormalized(startX, startY, w, h);
      const n2 = toNormalized(currentX, currentY, w, h);
      const d = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2);
      if (d > 0.01) {
        geometry = { type: tool, x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y };
      }
    } else if (tool === 'text' || tool === 'stamp') {
      const n = toNormalized(startX, startY, w, h);
      if (tool === 'stamp') {
        const nW = toNormalized(120, 40, w, h);
        geometry = {
          type: 'stamp', x: n.x, y: n.y,
          width: nW.x, height: nW.y,
          stampType: 'APPROVED',
        };
      } else {
        geometry = { type: 'text', x: n.x, y: n.y, text: 'Text', fontSize: 14 };
        style.fill = activeColor;
        style.stroke = 'transparent';
      }
    } else if (tool === 'callout') {
      const nPos = toNormalized(currentX, currentY, w, h);
      const nLeader = toNormalized(startX, startY, w, h);
      geometry = {
        type: 'callout', x: nPos.x, y: nPos.y,
        text: 'Note', leaderX: nLeader.x, leaderY: nLeader.y,
      };
    }

    if (geometry) {
      onComplete({ geometry, style });
    }
  }, [draft, activeColor, activeStrokeWidth, pageWidthPx, pageHeightPx, onComplete]);

  return { draft, handleMouseDown, handleMouseMove, handleMouseUp };
}
