import Konva from 'konva';
import type { AssemblyRun, AssemblyPlacedItem } from '../../types/assembly';

/**
 * Generate a thumbnail data URL by rendering assembly runs and items
 * into an offscreen Konva stage.
 */
export function generateAssemblyThumbnail(
  runs: AssemblyRun[],
  placedItems: AssemblyPlacedItem[],
  width: number,
  height: number,
): string | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const run of runs) {
    for (const seg of run.segments) {
      minX = Math.min(minX, seg.startPoint.x, seg.endPoint.x);
      minY = Math.min(minY, seg.startPoint.y, seg.endPoint.y);
      maxX = Math.max(maxX, seg.startPoint.x, seg.endPoint.x);
      maxY = Math.max(maxY, seg.startPoint.y, seg.endPoint.y);
    }
  }

  for (const item of placedItems) {
    minX = Math.min(minX, item.relativePosition.x);
    minY = Math.min(minY, item.relativePosition.y);
    maxX = Math.max(maxX, item.relativePosition.x);
    maxY = Math.max(maxY, item.relativePosition.y);
  }

  if (!isFinite(minX)) return null;

  const contentWidth = maxX - minX || 1;
  const contentHeight = maxY - minY || 1;
  const padding = 8;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;
  const scale = Math.min(drawWidth / contentWidth, drawHeight / contentHeight);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const stage = new Konva.Stage({ container, width, height });
    const layer = new Konva.Layer();
    stage.add(layer);

    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: '#131f33',
        cornerRadius: 4,
      }),
    );

    const offsetX = padding + (drawWidth - contentWidth * scale) / 2 - minX * scale;
    const offsetY = padding + (drawHeight - contentHeight * scale) / 2 - minY * scale;

    for (const run of runs) {
      if (run.segments.length === 0) continue;
      const points: number[] = [];
      points.push(
        run.segments[0].startPoint.x * scale + offsetX,
        run.segments[0].startPoint.y * scale + offsetY,
      );
      for (const seg of run.segments) {
        points.push(seg.endPoint.x * scale + offsetX, seg.endPoint.y * scale + offsetY);
      }
      layer.add(
        new Konva.Line({
          points,
          stroke: run.config.color || '#10b981',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
        }),
      );
    }

    for (const item of placedItems) {
      const x = item.relativePosition.x * scale + offsetX;
      const y = item.relativePosition.y * scale + offsetY;
      const color = item.renderMeta.color || '#3b82f6';
      const markerSize = 6;

      if (item.renderMeta.shape === 'circle') {
        layer.add(
          new Konva.Circle({ x, y, radius: markerSize, fill: color, stroke: '#fff', strokeWidth: 1 }),
        );
      } else if (item.renderMeta.shape === 'diamond') {
        layer.add(
          new Konva.Rect({
            x: x - markerSize,
            y: y - markerSize,
            width: markerSize * 2,
            height: markerSize * 2,
            fill: color,
            stroke: '#fff',
            strokeWidth: 1,
            rotation: 45,
            offsetX: 0,
            offsetY: 0,
          }),
        );
      } else {
        layer.add(
          new Konva.Rect({
            x: x - markerSize * 1.2,
            y: y - markerSize * 0.7,
            width: markerSize * 2.4,
            height: markerSize * 1.4,
            fill: color,
            stroke: '#fff',
            strokeWidth: 1,
            cornerRadius: 2,
          }),
        );
      }
    }

    layer.draw();
    const dataUrl = stage.toDataURL({ pixelRatio: 1 });
    stage.destroy();
    return dataUrl;
  } finally {
    document.body.removeChild(container);
  }
}
