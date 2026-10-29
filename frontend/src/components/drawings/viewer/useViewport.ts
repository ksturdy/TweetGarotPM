import { useState, useCallback } from 'react';
import type Konva from 'konva';

export interface StageState {
  x: number;
  y: number;
  scale: number;
}

export function useViewport(minScale = 0.1, maxScale = 10) {
  const [stage, setStage] = useState<StageState>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const s = e.target.getStage();
    if (!s) return;

    const oldScale = s.scaleX();
    const pointer = s.getPointerPosition();
    if (!pointer) return;

    const origin = {
      x: (pointer.x - s.x()) / oldScale,
      y: (pointer.y - s.y()) / oldScale,
    };

    const factor = e.evt.deltaY < 0 ? 1.08 : 1 / 1.08;
    const newScale = Math.max(minScale, Math.min(maxScale, oldScale * factor));

    setStage({
      x: pointer.x - origin.x * newScale,
      y: pointer.y - origin.y * newScale,
      scale: newScale,
    });
  }, [minScale, maxScale]);

  const resetView = useCallback((containerW: number, containerH: number, pageW: number, pageH: number) => {
    const scale = Math.min(containerW / pageW, containerH / pageH, 1);
    setStage({
      x: (containerW - pageW * scale) / 2,
      y: (containerH - pageH * scale) / 2,
      scale,
    });
  }, []);

  const zoomIn = useCallback(() =>
    setStage(s => ({ ...s, scale: Math.min(maxScale, s.scale * 1.2) })), [maxScale]);

  const zoomOut = useCallback(() =>
    setStage(s => ({ ...s, scale: Math.max(minScale, s.scale / 1.2) })), [minScale]);

  return { stage, setStage, handleWheel, resetView, zoomIn, zoomOut, isPanning, setIsPanning };
}
