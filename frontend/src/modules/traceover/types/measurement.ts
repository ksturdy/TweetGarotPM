export interface Point2D {
  x: number;
  y: number;
}

export type MeasurementUnit = 'ft' | 'in' | 'm' | 'mm';

export interface ScaleCalibration {
  id: string;
  pageNumber: number;
  documentId: string;
  startPoint: Point2D;
  endPoint: Point2D;
  pixelDistance: number;
  realDistance: number;
  unit: MeasurementUnit;
  pixelsPerUnit: number;
  createdAt: Date;
}

export interface Measurement {
  id: string;
  /** Server-side DB ID (from traceover_measurements table) */
  serverId?: number;
  pageNumber: number;
  documentId: string;
  type: 'linear' | 'area' | 'count';
  points: Point2D[];
  label: string;
  color: string;
  pixelValue: number;
  scaledValue: number;
  unit: string;
  createdAt: Date;
}
