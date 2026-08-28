import api from './api';

export type SchedulingMode = 'summary' | 'cost_type' | 'phase';

export interface ScheduleSegment {
  segment_key: string;
  label: string;
  start_date: string | null;
  end_date: string | null;
  contour_type: string;
}

export interface SegmentCosts {
  segment_key: string;
  est_cost: number | null;
  est_hours: number | null;
  jtd_cost: number | null;
  jtd_hours: number | null;
  projected_cost: number | null;
}

export interface SegmentsResponse {
  segments: ScheduleSegment[];
  activeKeys: string[];
}

// Canonical order and labels — mirrors SEGMENT_DEFINITIONS in the backend model
export const SEGMENT_DEFINITIONS: { key: string; label: string; isLabor: boolean }[] = [
  { key: '30',          label: 'Sheet Metal Field', isLabor: true },
  { key: '35',          label: 'Sheet Metal Shop',  isLabor: true },
  { key: '40',          label: 'Pipefitter Field',  isLabor: true },
  { key: '45',          label: 'Pipefitter Shop',   isLabor: true },
  { key: '50',          label: 'Plumbing Field',    isLabor: true },
  { key: '55',          label: 'Plumbing Shop',     isLabor: true },
  { key: '70',          label: 'Overhead',          isLabor: true },
  { key: 'bas',         label: 'BAS',               isLabor: true },
  { key: 'material',    label: 'Material',          isLabor: false },
  { key: 'subcontract', label: 'Subcontracts',      isLabor: false },
  { key: 'rental',      label: 'Rentals',           isLabor: false },
  { key: 'equipment',   label: 'MEP Equipment',     isLabor: false },
  { key: 'gc',          label: 'General Conditions',isLabor: false },
];

export const scheduleSegmentsService = {
  getSegments: (projectId: number) =>
    api.get<SegmentsResponse>(`/projects/${projectId}/schedule-segments`).then((r) => r.data),

  getCosts: (projectId: number) =>
    api.get<SegmentCosts[]>(`/projects/${projectId}/schedule-segments/costs`).then((r) => r.data),

  updateSegment: (
    projectId: number,
    segmentKey: string,
    data: { start_date?: string | null; end_date?: string | null; contour_type?: string }
  ) =>
    api.put<ScheduleSegment>(`/projects/${projectId}/schedule-segments/${segmentKey}`, data).then((r) => r.data),

  initialize: (projectId: number) =>
    api.post<ScheduleSegment[]>(`/projects/${projectId}/schedule-segments/initialize`).then((r) => r.data),
};
