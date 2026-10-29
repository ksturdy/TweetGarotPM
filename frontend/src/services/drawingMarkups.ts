import api from './api';
import type {
  DrawingPageMarkupData,
  DrawingMarkupLayer,
  DrawingMarkup,
  DrawingIssuePin,
  DrawingSubmittalTag,
  DrawingScaleCalibration,
  DrawingMeasurement,
  MarkupGeometry,
  MarkupStyle,
  MeasurementUnit,
} from '../lib/drawingViewer/types';

export type { DrawingPageMarkupData };

const base = (drawingId: number) => `/drawings/${drawingId}`;

// ── Combined load ────────────────────────────────────────────────────────────

export async function loadMarkupData(
  drawingId: number,
  pageNumber: number
): Promise<DrawingPageMarkupData> {
  const { data } = await api.get(`${base(drawingId)}/pages/${pageNumber}/markup-data`);
  return data;
}

// ── Markup layers ────────────────────────────────────────────────────────────

export async function createLayer(
  drawingId: number,
  pageNumber: number,
  payload: { name: string; color?: string; is_personal?: boolean }
): Promise<DrawingMarkupLayer> {
  const { data } = await api.post(`${base(drawingId)}/pages/${pageNumber}/layers`, payload);
  return data;
}

export async function updateLayer(
  drawingId: number,
  layerId: number,
  payload: Partial<{ name: string; color: string; is_visible: boolean }>
): Promise<DrawingMarkupLayer> {
  const { data } = await api.put(`${base(drawingId)}/layers/${layerId}`, payload);
  return data;
}

export async function deleteLayer(drawingId: number, layerId: number): Promise<void> {
  await api.delete(`${base(drawingId)}/layers/${layerId}`);
}

// ── Markups ──────────────────────────────────────────────────────────────────

export async function createMarkup(
  drawingId: number,
  pageNumber: number,
  payload: { layer_id: number; tool_type: string; geometry: MarkupGeometry; style?: MarkupStyle }
): Promise<DrawingMarkup> {
  const { data } = await api.post(`${base(drawingId)}/pages/${pageNumber}/markups`, payload);
  return data;
}

export async function updateMarkup(
  drawingId: number,
  markupId: number,
  payload: { geometry?: MarkupGeometry; style?: MarkupStyle; layer_id?: number }
): Promise<DrawingMarkup> {
  const { data } = await api.put(`${base(drawingId)}/markups/${markupId}`, payload);
  return data;
}

export async function deleteMarkup(drawingId: number, markupId: number): Promise<void> {
  await api.delete(`${base(drawingId)}/markups/${markupId}`);
}

export async function bulkDeleteMarkups(drawingId: number, pageNumber: number, ids: number[]): Promise<void> {
  await api.post(`${base(drawingId)}/pages/${pageNumber}/markups/bulk-delete`, { ids });
}

// ── Issue pins ────────────────────────────────────────────────────────────────

export async function createIssuePin(
  drawingId: number,
  pageNumber: number,
  payload: {
    x: number; y: number;
    field_issue_id?: number | null;
    create_issue?: boolean;
    issue_title?: string;
    issue_priority?: string;
    issue_trade?: string;
    issue_location?: string;
  }
): Promise<{ pin: DrawingIssuePin; issue: unknown }> {
  const { data } = await api.post(`${base(drawingId)}/pages/${pageNumber}/issue-pins`, payload);
  return data;
}

export async function updateIssuePin(
  drawingId: number,
  pinId: number,
  payload: { x?: number; y?: number; field_issue_id?: number | null }
): Promise<DrawingIssuePin> {
  const { data } = await api.put(`${base(drawingId)}/issue-pins/${pinId}`, payload);
  return data;
}

export async function deleteIssuePin(drawingId: number, pinId: number): Promise<void> {
  await api.delete(`${base(drawingId)}/issue-pins/${pinId}`);
}

// ── Submittal tags ────────────────────────────────────────────────────────────

export async function createSubmittalTag(
  drawingId: number,
  pageNumber: number,
  payload: { x: number; y: number; width: number; height: number; submittal_id?: number | null }
): Promise<DrawingSubmittalTag> {
  const { data } = await api.post(`${base(drawingId)}/pages/${pageNumber}/submittal-tags`, payload);
  return data;
}

export async function updateSubmittalTag(
  drawingId: number,
  tagId: number,
  payload: { x?: number; y?: number; width?: number; height?: number; submittal_id?: number | null }
): Promise<DrawingSubmittalTag> {
  const { data } = await api.put(`${base(drawingId)}/submittal-tags/${tagId}`, payload);
  return data;
}

export async function deleteSubmittalTag(drawingId: number, tagId: number): Promise<void> {
  await api.delete(`${base(drawingId)}/submittal-tags/${tagId}`);
}

// ── Scale calibration ─────────────────────────────────────────────────────────

export async function saveScaleCalibration(
  drawingId: number,
  pageNumber: number,
  payload: {
    x1: number; y1: number; x2: number; y2: number;
    real_world_value: number; real_world_unit: MeasurementUnit;
  }
): Promise<DrawingScaleCalibration> {
  const { data } = await api.put(
    `${base(drawingId)}/pages/${pageNumber}/scale-calibration`,
    payload
  );
  return data;
}

export async function deleteScaleCalibration(
  drawingId: number,
  pageNumber: number
): Promise<void> {
  await api.delete(`${base(drawingId)}/pages/${pageNumber}/scale-calibration`);
}

// ── Measurements ──────────────────────────────────────────────────────────────

export async function createMeasurement(
  drawingId: number,
  pageNumber: number,
  payload: {
    measure_type: 'linear' | 'area';
    points: Array<{ x: number; y: number }>;
    computed_value?: number;
    unit?: string;
    label?: string;
  }
): Promise<DrawingMeasurement> {
  const { data } = await api.post(`${base(drawingId)}/pages/${pageNumber}/measurements`, payload);
  return data;
}

export async function updateMeasurement(
  drawingId: number,
  measureId: number,
  payload: { label?: string; computed_value?: number; unit?: string }
): Promise<DrawingMeasurement> {
  const { data } = await api.put(`${base(drawingId)}/measurements/${measureId}`, payload);
  return data;
}

export async function deleteMeasurement(drawingId: number, measureId: number): Promise<void> {
  await api.delete(`${base(drawingId)}/measurements/${measureId}`);
}
