import { useState, useCallback, useRef } from 'react';
import type Konva from 'konva';
import type { ActiveTool, MarkupGeometry, MarkupStyle } from '../../../lib/drawingViewer/types';
import { toNormalized } from '../../../lib/drawingViewer/coordUtils';

export interface DraftShape {
  tool: ActiveTool;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  points?: number[];
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
  // Use a ref to track draft synchronously to avoid stale closures in handlers
  const draftRef = useRef<DraftShape | null>(null);

  const getStagePos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  };

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (activeTool === 'pan' || activeTool === 'select') return;
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') return;

    const pos = getStagePos(e);
    if (!pos) return;

    const newDraft: DraftShape = {
      tool: activeTool,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
      points: (activeTool === 'pencil' || activeTool === 'revision_cloud')
        ? [pos.x, pos.y]
        : undefined,
    };
    drawingRef.current = true;
    draftRef.current = newDraft;
    setDraft(newDraft);
  }, [activeTool]);

  // handleMouseMove does NOT depend on draft state — uses draftRef for synchronous access
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingRef.current) return;
    const pos = getStagePos(e);
    if (!pos) return;

    setDraft(d => {
      if (!d) return d;
      const updated: DraftShape = {
        ...d,
        currentX: pos.x,
        currentY: pos.y,
        points: d.points ? [...d.points, pos.x, pos.y] : undefined,
      };
      draftRef.current = updated;
      return updated;
    });
  }, []); // no draft dependency — uses functional setDraft + draftRef

  const handleMouseUp = useCallback((_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);

    if (!current) return;

    const { tool, startX, startY, currentX, currentY, points } = current;
    const w = pageWidthPx, h = pageHeightPx;
    if (w === 0 || h === 0) return;

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
      const nW = toNormalized(Math.abs(currentX - startX), 0, w, h).x;
      const nH = toNormalized(0, Math.abs(currentY - startY), w, h).y;
      if (nW > 0.005 || nH > 0.005) {
        geometry = { type: 'rectangle', x: nPos.x, y: nPos.y, width: nW, height: nH };
      }
    } else if (tool === 'circle') {
      const nC = toNormalized((startX + currentX) / 2, (startY + currentY) / 2, w, h);
      const rx = toNormalized(Math.abs(currentX - startX) / 2, 0, w, h).x;
      const ry = toNormalized(0, Math.abs(currentY - startY) / 2, w, h).y;
      if (rx > 0.005 || ry > 0.005) {
        geometry = { type: 'circle', cx: nC.x, cy: nC.y, rx, ry };
      }
    } else if (tool === 'arrow' || tool === 'line') {
      const n1 = toNormalized(startX, startY, w, h);
      const n2 = toNormalized(currentX, currentY, w, h);
      const d = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2);
      if (d > 0.01) {
        geometry = { type: tool, x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y };
      }
    } else if (tool === 'text') {
      const n = toNormalized(startX, startY, w, h);
      geometry = { type: 'text', x: n.x, y: n.y, text: 'Text', fontSize: 14 };
      style.fill = activeColor;
      style.stroke = 'transparent';
    } else if (tool === 'callout') {
      const nPos = toNormalized(currentX, currentY, w, h);
      const nLeader = toNormalized(startX, startY, w, h);
      geometry = { type: 'callout', x: nPos.x, y: nPos.y, text: 'Note', leaderX: nLeader.x, leaderY: nLeader.y };
    } else if (tool === 'stamp') {
      const n = toNormalized(startX, startY, w, h);
      const nW = toNormalized(120, 40, w, h);
      geometry = { type: 'stamp', x: n.x, y: n.y, width: nW.x, height: nW.y, stampType: 'APPROVED' };
    }

    if (geometry) {
      onComplete({ geometry, style });
    }
  }, [activeColor, activeStrokeWidth, pageWidthPx, pageHeightPx, onComplete]);

  return { draft, handleMouseDown, handleMouseMove, handleMouseUp };
}
