import api from './api';

// ─── Types ───

export interface TraceoverDocument {
  id: number;
  tenant_id: number;
  takeoff_id: number;
  file_name: string;
  original_name: string;
  storage_key: string;
  mime_type: string;
  file_size: number;
  page_count: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  run_count?: number;
  calibrated_pages?: number;
  pages?: PageMetadata[];
  calibrations?: Calibration[];
  created_at: string;
  updated_at: string;
}

export interface PageMetadata {
  id: number;
  document_id: number;
  page_number: number;
  name: string;
  drawing_number: string;
  level: string;
  area: string;
  revision: string;
}

export interface Calibration {
  id: number;
  document_id: number;
  page_number: number;
  start_point: { x: number; y: number };
  end_point: { x: number; y: number };
  pixel_distance: number;
  real_distance: number;
  unit: 'ft' | 'in' | 'm' | 'mm';
  pixels_per_unit: number;
  created_at: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface TraceoverConfig {
  material: string;
  pipeSize: { nominal: string; nominalInches: number; displayLabel: string };
  serviceType: string;
  projectSystemId: string | null;
  color: string;
  label: string;
  startingElevation: number;
}

export interface TraceoverSegment {
  id: string;
  startPoint: Point2D;
  endPoint: Point2D;
  pixelLength: number;
  scaledLength: number;
  unit: string;
  angleRad: number;
  angleFromPrevious: number | null;
  fitting: string | null;
  jointType: string | null;
  elevation: number;
}

export interface BranchConnection {
  id: string;
  parentRunId: string;
  parentSegmentId: string;
  connectionPoint: Point2D;
  direction: 'top' | 'bottom';
  childRunId: string;
  teeId: string;
  parentPipeSize: { nominal: string; nominalInches: number; displayLabel: string };
}

export interface TraceoverRun {
  id: number;
  tenant_id: number;
  takeoff_id: number;
  document_id: number | null;
  page_number: number | null;
  config: TraceoverConfig;
  segments: TraceoverSegment[];
  branches: BranchConnection[];
  is_complete: boolean;
  total_pixel_length: number;
  total_scaled_length: number;
  vertical_pipe_length: number;
  fitting_counts: Record<string, number>;
  generated_takeoff_item_ids: number[];
  branch_parent_pipe_size: { nominal: string; nominalInches: number; displayLabel: string } | null;
  document_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TraceoverRunSummary {
  total_runs: number;
  complete_runs: number;
  total_pipe_length: number;
  total_vertical_length: number;
}

export interface TraceoverMeasurement {
  id: number;
  document_id: number;
  page_number: number;
  measurement_type: 'linear' | 'area' | 'count';
  points: Point2D[];
  label: string;
  color: string;
  pixel_value: number;
  scaled_value: number;
  unit: string;
  created_at: string;
}

// ─── Documents API ───

export const traceoverDocumentsApi = {
  getByTakeoff: (takeoffId: number) =>
    api.get<TraceoverDocument[]>(`/takeoffs/${takeoffId}/documents`),

  getById: (takeoffId: number, docId: number) =>
    api.get<TraceoverDocument>(`/takeoffs/${takeoffId}/documents/${docId}`),

  upload: (takeoffId: number, file: File, pageCount?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (pageCount) formData.append('page_count', String(pageCount));
    return api.post<TraceoverDocument>(`/takeoffs/${takeoffId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (takeoffId: number, docId: number, data: Partial<TraceoverDocument>) =>
    api.put<TraceoverDocument>(`/takeoffs/${takeoffId}/documents/${docId}`, data),

  delete: (takeoffId: number, docId: number) =>
    api.delete(`/takeoffs/${takeoffId}/documents/${docId}`),

  getFileUrl: (takeoffId: number, docId: number) =>
    api.get<{ url: string }>(`/takeoffs/${takeoffId}/documents/${docId}/url`),

  getFileStreamUrl: (takeoffId: number, docId: number) =>
    `/api/takeoffs/${takeoffId}/documents/${docId}/file`,

  // Page metadata
  getPages: (takeoffId: number, docId: number) =>
    api.get<PageMetadata[]>(`/takeoffs/${takeoffId}/documents/${docId}/pages`),

  updatePage: (takeoffId: number, docId: number, pageNumber: number, data: Partial<PageMetadata>) =>
    api.put<PageMetadata>(`/takeoffs/${takeoffId}/documents/${docId}/pages/${pageNumber}`, data),

  // Calibrations
  getCalibrations: (takeoffId: number, docId: number) =>
    api.get<Calibration[]>(`/takeoffs/${takeoffId}/documents/${docId}/calibrations`),

  getCalibration: (takeoffId: number, docId: number, pageNumber: number) =>
    api.get<Calibration>(`/takeoffs/${takeoffId}/documents/${docId}/calibrations/${pageNumber}`),

  setCalibration: (takeoffId: number, docId: number, pageNumber: number, data: Omit<Calibration, 'id' | 'document_id' | 'page_number' | 'created_at'>) =>
    api.put<Calibration>(`/takeoffs/${takeoffId}/documents/${docId}/calibrations/${pageNumber}`, data),

  deleteCalibration: (takeoffId: number, docId: number, pageNumber: number) =>
    api.delete(`/takeoffs/${takeoffId}/documents/${docId}/calibrations/${pageNumber}`),
};

// ─── Runs API ───

export const traceoverRunsApi = {
  getByTakeoff: (takeoffId: number) =>
    api.get<TraceoverRun[]>(`/takeoffs/${takeoffId}/runs`),

  getByDocumentPage: (takeoffId: number, documentId: number, pageNumber: number) =>
    api.get<TraceoverRun[]>(`/takeoffs/${takeoffId}/runs`, {
      params: { document_id: documentId, page_number: pageNumber },
    }),

  getSummary: (takeoffId: number) =>
    api.get<TraceoverRunSummary>(`/takeoffs/${takeoffId}/runs/summary`),

  getById: (takeoffId: number, runId: number) =>
    api.get<TraceoverRun>(`/takeoffs/${takeoffId}/runs/${runId}`),

  create: (takeoffId: number, data: Partial<TraceoverRun>) =>
    api.post<TraceoverRun>(`/takeoffs/${takeoffId}/runs`, data),

  update: (takeoffId: number, runId: number, data: Partial<TraceoverRun>) =>
    api.put<TraceoverRun>(`/takeoffs/${takeoffId}/runs/${runId}`, data),

  delete: (takeoffId: number, runId: number) =>
    api.delete(`/takeoffs/${takeoffId}/runs/${runId}`),
};

// ─── Measurements API ───

export const traceoverMeasurementsApi = {
  getByDocument: (takeoffId: number, documentId: number, pageNumber?: number) =>
    api.get<TraceoverMeasurement[]>(`/takeoffs/${takeoffId}/runs/documents/${documentId}/measurements`, {
      params: pageNumber !== undefined ? { page_number: pageNumber } : undefined,
    }),

  create: (takeoffId: number, documentId: number, data: Partial<TraceoverMeasurement>) =>
    api.post<TraceoverMeasurement>(`/takeoffs/${takeoffId}/runs/documents/${documentId}/measurements`, data),

  update: (takeoffId: number, documentId: number, measId: number, data: Partial<TraceoverMeasurement>) =>
    api.put<TraceoverMeasurement>(`/takeoffs/${takeoffId}/runs/documents/${documentId}/measurements/${measId}`, data),

  delete: (takeoffId: number, documentId: number, measId: number) =>
    api.delete(`/takeoffs/${takeoffId}/runs/documents/${documentId}/measurements/${measId}`),
};
