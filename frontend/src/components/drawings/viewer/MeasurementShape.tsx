import React, { memo } from 'react';
import { Group, Line, Text, Circle } from 'react-konva';
import type { DrawingMeasurement } from '../../../lib/drawingViewer/types';
import { denormalizePointArray } from '../../../lib/drawingViewer/coordUtils';

interface Props {
  measurement: DrawingMeasurement;
  pageW: number;
  pageH: number;
  isSelected: boolean;
  onClick: () => void;
}

function MeasurementShape({ measurement, pageW, pageH, isSelected, onClick }: Props) {
  const pts = denormalizePointArray(measurement.points, pageW, pageH);
  if (pts.length === 0) return null;

  const color = isSelected ? '#0095ff' : '#f59e0b';
  const flatPoints = pts.flatMap(p => [p.x, p.y]);
  const isArea = measurement.measure_type === 'area';

  const midX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const midY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const label = measurement.label || formatValue(measurement.computed_value, measurement.unit);

  return (
    <Group onClick={onClick} onTap={onClick}>
      <Line
        points={flatPoints}
        stroke={color}
        strokeWidth={2}
        closed={isArea}
        fill={isArea ? `${color}22` : undefined}
        dash={[6, 3]}
      />
      {pts.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={4} fill={color} />
      ))}
      {label && (
        <Group x={midX} y={midY}>
          <Text
            x={-40}
            y={-10}
            width={80}
            text={label}
            fontSize={11}
            fontStyle="bold"
            fill="#fff"
            align="center"
          />
        </Group>
      )}
    </Group>
  );
}

function formatValue(value: number | null, unit: string | null): string {
  if (value == null) return '';
  if (!unit) return value.toFixed(2);
  if (unit === 'ft') {
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 12);
    return inches === 0 ? `${feet}'` : `${feet}'-${inches}"`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

export default memo(MeasurementShape);
