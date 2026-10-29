import React, { memo } from 'react';
import { Group, Circle, Text } from 'react-konva';
import type { DrawingIssuePin } from '../../../lib/drawingViewer/types';

interface Props {
  pin: DrawingIssuePin;
  pageW: number;
  pageH: number;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  open: '#ef4444',
  in_progress: '#f59e0b',
  resolved: '#22c55e',
  closed: '#6b7280',
};

function IssuePinShape({ pin, pageW, pageH, isSelected, onClick }: Props) {
  const x = pin.x * pageW;
  const y = pin.y * pageH;
  const r = 14;
  const color = STATUS_COLORS[pin.issue_status || 'open'] || '#ef4444';
  const borderColor = isSelected ? '#0095ff' : '#fff';

  return (
    <Group x={x} y={y} onClick={onClick} onTap={onClick}>
      <Circle
        x={0} y={0}
        radius={r}
        fill={color}
        stroke={borderColor}
        strokeWidth={2}
        shadowColor="rgba(0,0,0,0.3)"
        shadowBlur={4}
        shadowOffsetY={2}
      />
      <Text
        x={-r}
        y={-r / 2 - 2}
        width={r * 2}
        height={r}
        text={String(pin.pin_number)}
        fontSize={11}
        fontStyle="bold"
        fill="#fff"
        align="center"
      />
    </Group>
  );
}

export default memo(IssuePinShape);
