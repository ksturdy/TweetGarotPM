import type { Point2D } from './measurement';

export type ToolType =
  | 'select'
  | 'pan'
  | 'window_select'
  | 'calibrate'
  | 'linear'
  | 'area'
  | 'count'
  | 'traceover'
  | 'zoom_in'
  | 'zoom_out'
  | 'place_piping_item'
  | 'place_equipment'
  | 'place_assembly';

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export interface ActiveDrawing {
  tool: ToolType;
  points: Point2D[];
  isComplete: boolean;
}
