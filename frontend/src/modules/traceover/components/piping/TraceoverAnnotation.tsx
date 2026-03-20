import { Line, Circle, Group, Text, Rect, Arc } from 'react-konva';
import type { TraceoverRun } from '../../types/piping';
import { midpoint } from '../../lib/measurement/geometry';

interface TraceoverAnnotationProps {
  run: TraceoverRun;
  isSelected?: boolean;
  onSelect?: () => void;
  showTags: boolean;
  pipeHighlight: boolean;
  pipeHighlightWidth: number;
}

/**
 * Konva Group rendered on Layer 2 for a completed traceover run:
 * - Pipe segments as thick lines in the run's color
 * - Small circles at each vertex
 * - Run label at the midpoint of the first segment
 * - Pipe size label along the run
 */
export default function TraceoverAnnotation({
  run,
  isSelected,
  onSelect,
  showTags,
  pipeHighlight,
  pipeHighlightWidth,
}: TraceoverAnnotationProps) {
  const { segments, config } = run;
  const color = isSelected ? '#3b82f6' : config.color;

  if (segments.length === 0) return null;

  // Get all points for a single polyline
  const allPoints: number[] = [
    segments[0].startPoint.x,
    segments[0].startPoint.y,
  ];
  for (const seg of segments) {
    allPoints.push(seg.endPoint.x, seg.endPoint.y);
  }

  // Label position at midpoint of first segment
  const labelPos =
    segments.length > 0
      ? midpoint(segments[0].startPoint, segments[0].endPoint)
      : { x: 0, y: 0 };

  const sizeLabel = config.pipeSize.displayLabel;
  const runLabel = config.label || sizeLabel;

  // Total length label (horizontal + vertical)
  // Coerce to number — values may arrive as strings from DB/JSON hydration
  const hasCalibration = segments.some((s) => s.unit !== 'px');
  const horizontalLength = Number(hasCalibration
    ? run.totalScaledLength
    : run.totalPixelLength) || 0;
  const vertPipe = Number(run.verticalPipeLength) || 0;
  const totalLength = horizontalLength + vertPipe;
  const unit = hasCalibration
    ? (segments.find((s) => s.unit !== 'px')?.unit ?? 'ft')
    : 'px';
  const lengthText = vertPipe > 0
    ? `${totalLength.toFixed(1)} ${unit} (+${vertPipe.toFixed(1)} vert)`
    : `${totalLength.toFixed(1)} ${unit}`;

  return (
    <Group
      onClick={(e) => {
        if (onSelect) {
          e.cancelBubble = true;
          onSelect();
        }
      }}
      onTap={(e) => {
        if (onSelect) {
          e.cancelBubble = true;
          onSelect();
        }
      }}
    >
      {/* Yellow highlight glow */}
      {pipeHighlight && !isSelected && (
        <Line
          points={allPoints}
          stroke="#facc15"
          strokeWidth={pipeHighlightWidth}
          lineCap="round"
          lineJoin="round"
          opacity={0.45}
        />
      )}
      {/* Selection highlight */}
      {isSelected && (
        <Line
          points={allPoints}
          stroke="#3b82f6"
          strokeWidth={8}
          lineCap="round"
          lineJoin="round"
          opacity={0.4}
        />
      )}
      {/* Main pipe line */}
      <Line
        points={allPoints}
        stroke={color}
        strokeWidth={3}
        lineCap="round"
        lineJoin="round"
      />

      {showTags && (
        <>
          {/* Vertex circles */}
          {segments.map((seg, i) => (
            <Circle
              key={`start-${seg.id}`}
              x={i === 0 ? seg.startPoint.x : seg.endPoint.x}
              y={i === 0 ? seg.startPoint.y : seg.endPoint.y}
              radius={4}
              fill={color}
              stroke="white"
              strokeWidth={1}
            />
          ))}
          {/* Last endpoint */}
          {segments.length > 0 && (
            <Circle
              x={segments[0].startPoint.x}
              y={segments[0].startPoint.y}
              radius={4}
              fill={color}
              stroke="white"
              strokeWidth={1}
            />
          )}

          {/* Fitting symbols at vertices with fittings */}
          {segments
            .filter((seg) => seg.fitting)
            .map((seg) => (
              <Group key={`fit-${seg.id}`}>
                <Circle
                  x={seg.startPoint.x}
                  y={seg.startPoint.y}
                  radius={8}
                  fill={color}
                  opacity={0.3}
                />
                <Text
                  x={seg.startPoint.x - 6}
                  y={seg.startPoint.y - 5}
                  text={seg.fitting === 'elbow_90' ? '90' : seg.fitting === 'elbow_45' ? '45' : 'T'}
                  fontSize={8}
                  fill="white"
                  fontStyle="bold"
                  width={12}
                  align="center"
                />
              </Group>
            ))}

          {/* Run label */}
          <Group>
            <Rect
              x={labelPos.x - 30}
              y={labelPos.y - 22}
              width={60}
              height={16}
              fill={color}
              opacity={0.9}
              cornerRadius={3}
            />
            <Text
              x={labelPos.x - 28}
              y={labelPos.y - 20}
              text={runLabel}
              fontSize={10}
              fill="white"
              fontStyle="bold"
              width={56}
              ellipsis
              wrap="none"
              align="center"
            />
          </Group>

          {/* Length label */}
          <Group>
            <Rect
              x={labelPos.x - 30}
              y={labelPos.y - 5}
              width={60}
              height={14}
              fill="rgba(0,0,0,0.6)"
              cornerRadius={2}
            />
            <Text
              x={labelPos.x - 28}
              y={labelPos.y - 3}
              text={lengthText}
              fontSize={9}
              fill="white"
              width={56}
              align="center"
            />
          </Group>
        </>
      )}
    </Group>
  );
}
