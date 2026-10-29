import React, { memo } from 'react';
import { Line, Rect, Ellipse, Arrow, Text, Group } from 'react-konva';
import type { DrawingMarkup, MarkupGeometry, MarkupStyle } from '../../../lib/drawingViewer/types';
import { denormalizePoints } from '../../../lib/drawingViewer/coordUtils';

interface Props {
  markup: DrawingMarkup;
  pageW: number;
  pageH: number;
  isSelected?: boolean;
  onClick?: () => void;
}

function toRevisionCloudPath(normPts: number[], pageW: number, pageH: number): number[] {
  const pts = denormalizePoints(normPts, pageW, pageH);
  // Return simplified path — actual revision cloud drawn as bumpy line via Konva.Line
  return pts;
}

function ShapeInner({ geo, style, pageW, pageH, isSelected, onClick }: {
  geo: MarkupGeometry;
  style: MarkupStyle;
  pageW: number;
  pageH: number;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const stroke = style.stroke || '#FF0000';
  const sw = style.strokeWidth || 2;
  const fill = style.fill || 'transparent';
  const opacity = style.opacity ?? 1;
  const selectionColor = isSelected ? '#0095ff' : undefined;

  switch (geo.type) {
    case 'pencil':
    case 'revision_cloud': {
      const pts = denormalizePoints(geo.points, pageW, pageH);
      return (
        <Line
          points={pts}
          stroke={selectionColor || stroke}
          strokeWidth={sw}
          opacity={opacity}
          lineCap="round"
          lineJoin="round"
          tension={geo.type === 'pencil' ? 0.4 : 0}
          closed={geo.type === 'revision_cloud'}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'rectangle': {
      return (
        <Rect
          x={geo.x * pageW}
          y={geo.y * pageH}
          width={geo.width * pageW}
          height={geo.height * pageH}
          stroke={selectionColor || stroke}
          strokeWidth={sw}
          fill={fill}
          opacity={opacity}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'circle': {
      return (
        <Ellipse
          x={geo.cx * pageW}
          y={geo.cy * pageH}
          radiusX={geo.rx * pageW}
          radiusY={geo.ry * pageH}
          stroke={selectionColor || stroke}
          strokeWidth={sw}
          fill={fill}
          opacity={opacity}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'arrow': {
      return (
        <Arrow
          points={[geo.x1 * pageW, geo.y1 * pageH, geo.x2 * pageW, geo.y2 * pageH]}
          stroke={selectionColor || stroke}
          strokeWidth={sw}
          fill={selectionColor || stroke}
          opacity={opacity}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'line': {
      return (
        <Line
          points={[geo.x1 * pageW, geo.y1 * pageH, geo.x2 * pageW, geo.y2 * pageH]}
          stroke={selectionColor || stroke}
          strokeWidth={sw}
          opacity={opacity}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'text': {
      return (
        <Text
          x={geo.x * pageW}
          y={geo.y * pageH}
          text={geo.text}
          fontSize={geo.fontSize || 14}
          fill={selectionColor || stroke}
          opacity={opacity}
          onClick={onClick}
          onTap={onClick}
        />
      );
    }
    case 'callout': {
      return (
        <Group onClick={onClick} onTap={onClick}>
          <Line
            points={[geo.leaderX * pageW, geo.leaderY * pageH, geo.x * pageW, geo.y * pageH]}
            stroke={selectionColor || stroke}
            strokeWidth={sw}
            opacity={opacity}
          />
          <Rect
            x={geo.x * pageW - 4}
            y={geo.y * pageH - 14}
            width={Math.max(geo.text.length * 8, 60)}
            height={22}
            fill="white"
            stroke={selectionColor || stroke}
            strokeWidth={sw}
            opacity={opacity}
            cornerRadius={3}
          />
          <Text
            x={geo.x * pageW}
            y={geo.y * pageH - 10}
            text={geo.text}
            fontSize={12}
            fill={selectionColor || stroke}
            opacity={opacity}
          />
        </Group>
      );
    }
    case 'stamp': {
      const stampColors: Record<string, string> = {
        APPROVED: '#22c55e',
        FOR_CONSTRUCTION: '#3b82f6',
        NOT_FOR_CONSTRUCTION: '#ef4444',
        REJECTED: '#ef4444',
      };
      const c = stampColors[geo.stampType] || '#666';
      const label = geo.stampType.replace(/_/g, ' ');
      return (
        <Group onClick={onClick} onTap={onClick}>
          <Rect
            x={geo.x * pageW}
            y={geo.y * pageH}
            width={geo.width * pageW}
            height={geo.height * pageH}
            stroke={selectionColor || c}
            strokeWidth={3}
            fill="transparent"
            opacity={0.85}
            cornerRadius={4}
            rotation={-15}
          />
          <Text
            x={geo.x * pageW + 6}
            y={geo.y * pageH + (geo.height * pageH) / 2 - 8}
            text={label}
            fontSize={Math.round(geo.height * pageH * 0.4)}
            fill={selectionColor || c}
            fontStyle="bold"
            opacity={0.85}
            rotation={-15}
          />
        </Group>
      );
    }
    default:
      return null;
  }
}

function MarkupShape({ markup, pageW, pageH, isSelected, onClick }: Props) {
  return (
    <ShapeInner
      geo={markup.geometry}
      style={markup.style}
      pageW={pageW}
      pageH={pageH}
      isSelected={isSelected}
      onClick={onClick}
    />
  );
}

export default memo(MarkupShape);
