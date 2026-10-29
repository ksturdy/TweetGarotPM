import React, { memo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { DrawingSubmittalTag } from '../../../lib/drawingViewer/types';

interface Props {
  tag: DrawingSubmittalTag;
  pageW: number;
  pageH: number;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  under_review: '#3b82f6',
  approved: '#22c55e',
  approved_as_noted: '#84cc16',
  rejected: '#ef4444',
  revise_resubmit: '#f97316',
};

function SubmittalTagShape({ tag, pageW, pageH, isSelected, onClick }: Props) {
  const x = tag.x * pageW;
  const y = tag.y * pageH;
  const w = tag.width * pageW;
  const h = tag.height * pageH;
  const color = STATUS_COLORS[tag.submittal_status || 'pending'] || '#f59e0b';
  const borderColor = isSelected ? '#0095ff' : color;

  return (
    <Group x={x} y={y} onClick={onClick} onTap={onClick}>
      <Rect
        x={0} y={0}
        width={w} height={h}
        fill={`${color}22`}
        stroke={borderColor}
        strokeWidth={isSelected ? 3 : 2}
        dash={[6, 3]}
        cornerRadius={3}
      />
      {tag.submittal_number != null && (
        <Text
          x={4}
          y={4}
          text={`SUB-${tag.submittal_number}`}
          fontSize={Math.max(8, Math.min(12, h * 0.2))}
          fontStyle="bold"
          fill={color}
        />
      )}
      {tag.submittal_name && h > 28 && (
        <Text
          x={4}
          y={18}
          width={w - 8}
          text={tag.submittal_name}
          fontSize={Math.max(7, Math.min(10, h * 0.15))}
          fill={color}
          ellipsis
          wrap="none"
        />
      )}
    </Group>
  );
}

export default memo(SubmittalTagShape);
