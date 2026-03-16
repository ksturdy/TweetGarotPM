import { Line, Circle, Group, Arc } from 'react-konva';
import type { ActiveTraceover } from '../../types/piping';

interface TraceoverDrawingPreviewProps {
  traceover: ActiveTraceover;
}

/**
 * Konva Group rendered on Layer 3 showing the in-progress traceover:
 * - Committed segments as solid lines
 * - Snapped preview line (dashed) from last point to cursor
 * - Vertex dots at each point
 * - Angle indicator arc at the last point
 */
export default function TraceoverDrawingPreview({
  traceover,
}: TraceoverDrawingPreviewProps) {
  const { points, segments, snappedCursorPos, config } = traceover;
  const color = config.color;

  if (points.length === 0) return null;

  const lastPoint = points[points.length - 1];

  return (
    <Group>
      {/* Committed segments */}
      {segments.map((seg) => (
        <Line
          key={seg.id}
          points={[
            seg.startPoint.x,
            seg.startPoint.y,
            seg.endPoint.x,
            seg.endPoint.y,
          ]}
          stroke={color}
          strokeWidth={3}
          lineCap="round"
          lineJoin="round"
        />
      ))}

      {/* Vertex dots */}
      {points.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={5}
          fill={color}
          stroke="white"
          strokeWidth={1.5}
        />
      ))}

      {/* Fitting indicators at angle changes */}
      {segments.map((seg) => {
        if (!seg.fitting || seg.angleFromPrevious === null) return null;
        return (
          <Arc
            key={`fitting-${seg.id}`}
            x={seg.startPoint.x}
            y={seg.startPoint.y}
            innerRadius={8}
            outerRadius={12}
            angle={seg.angleFromPrevious}
            rotation={((seg.angleRad - Math.PI) * 180) / Math.PI}
            fill={color}
            opacity={0.4}
          />
        );
      })}

      {/* Snapped preview line */}
      {snappedCursorPos && (
        <>
          <Line
            points={[
              lastPoint.x,
              lastPoint.y,
              snappedCursorPos.x,
              snappedCursorPos.y,
            ]}
            stroke={color}
            strokeWidth={2}
            dash={[8, 4]}
            lineCap="round"
            opacity={0.7}
          />
          <Circle
            x={snappedCursorPos.x}
            y={snappedCursorPos.y}
            radius={4}
            fill={color}
            opacity={0.5}
          />
        </>
      )}
    </Group>
  );
}
