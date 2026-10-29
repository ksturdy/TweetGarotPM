// ── Coordinate primitives ────────────────────────────────────────────────────

export interface Point2D { x: number; y: number; }
export type MeasurementUnit = 'ft' | 'in' | 'm' | 'mm';

// ── PDF loader result ────────────────────────────────────────────────────────

export interface LoadPdfResult {
  document: import('pdfjs-dist').PDFDocumentProxy;
  pageCount: number;
}

export interface RenderResult { width: number; height: number; }

// ── Markup tool types ────────────────────────────────────────────────────────

export type MarkupToolType =
  | 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'line'
  | 'revision_cloud' | 'text' | 'callout' | 'stamp';

export type StampType =
  | 'APPROVED' | 'FOR_CONSTRUCTION' | 'NOT_FOR_CONSTRUCTION' | 'REJECTED';

export type ActiveTool =
  | 'pan' | 'select'
  | MarkupToolType
  | 'issue_pin' | 'submittal_tag'
  | 'calibrate' | 'measure_linear' | 'measure_area';

// Geometry stored as normalized fractions (0–1 of page dimensions)
export type MarkupGeometry =
  | { type: 'pencil';         points: number[] }
  | { type: 'revision_cloud'; points: number[] }
  | { type: 'rectangle';      x: number; y: number; width: number; height: number }
  | { type: 'circle';         cx: number; cy: number; rx: number; ry: number }
  | { type: 'arrow';          x1: number; y1: number; x2: number; y2: number }
  | { type: 'line';           x1: number; y1: number; x2: number; y2: number }
  | { type: 'text';           x: number; y: number; text: string; fontSize: number }
  | { type: 'callout';        x: number; y: number; text: string; leaderX: number; leaderY: number }
  | { type: 'stamp';          x: number; y: number; width: number; height: number; stampType: StampType };

export interface MarkupStyle {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
}

// ── API shapes (from backend) ────────────────────────────────────────────────

export interface DrawingMarkupLayer {
  id: number;
  tenant_id: number;
  drawing_id: number;
  page_number: number;
  name: string;
  color: string;
  is_visible: boolean;
  is_personal: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DrawingMarkup {
  id: number;
  tenant_id: number;
  layer_id: number;
  drawing_id: number;
  page_number: number;
  tool_type: MarkupToolType;
  geometry: MarkupGeometry;
  style: MarkupStyle;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DrawingIssuePin {
  id: number;
  drawing_id: number;
  page_number: number;
  x: number;
  y: number;
  pin_number: number;
  field_issue_id: number | null;
  created_by: number;
  created_at: string;
  // Joined fields
  issue_title?: string;
  issue_status?: string;
  issue_priority?: string;
}

export interface DrawingSubmittalTag {
  id: number;
  drawing_id: number;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  submittal_id: number | null;
  created_by: number;
  created_at: string;
  // Joined fields
  submittal_name?: string;
  submittal_status?: string;
  submittal_number?: number;
}

export interface DrawingScaleCalibration {
  id: number;
  drawing_id: number;
  page_number: number;
  x1: number; y1: number;
  x2: number; y2: number;
  real_world_value: number;
  real_world_unit: MeasurementUnit;
  created_by: number;
  created_at: string;
}

export interface DrawingMeasurement {
  id: number;
  drawing_id: number;
  page_number: number;
  measure_type: 'linear' | 'area';
  points: Point2D[];
  computed_value: number | null;
  unit: string | null;
  label: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DrawingPageMarkupData {
  layers: DrawingMarkupLayer[];
  markups: DrawingMarkup[];
  issuePins: DrawingIssuePin[];
  submittalTags: DrawingSubmittalTag[];
  measurements: DrawingMeasurement[];
  scaleCalibration: DrawingScaleCalibration | null;
}

// ── Viewport state ───────────────────────────────────────────────────────────

export interface ViewportState {
  scale: number;
  offsetX: number;  // scroll position of the container
  offsetY: number;
}

export interface PageDimensions {
  width: number;   // rendered CSS pixels at current scale
  height: number;
}
