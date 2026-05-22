import api from './api';

export type ProjectionNoteType = 'note' | 'gain_fade';

export interface ProjectionNote {
  id: number;
  tenant_id: number;
  project_id: number;
  snapshot_id: number | null;
  snapshot_date: string | null;

  cost_type: number | null;
  trade: string | null;

  category: string | null;
  groups_affected: string[] | null;

  type: ProjectionNoteType;
  body: string;

  // Homework
  assigned_to: number | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  due_date: string | null;
  status: 'open' | 'done';
  completed_at: string | null;
  completed_by: number | null;
  completed_by_name: string | null;

  // Gain/fade
  amount: number | string | null;
  recognized_in_financials: boolean;
  recognized_at: string | null;

  // Audit
  created_by: number;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectionNoteCount {
  cost_type: number; // 0 = contract-wide
  type: ProjectionNoteType;
  count: number;
  open_homework: number;
  net_gain_fade: number | string;
}

export interface CreateProjectionNotePayload {
  type: ProjectionNoteType;
  body: string;
  cost_type?: number | null;
  trade?: string | null;
  category?: string | null;
  groups_affected?: string[] | null;
  assigned_to?: number | null;
  due_date?: string | null;
  amount?: number | null;
  recognized_in_financials?: boolean;
  recognized_at?: string | null;
  snapshot_id?: number | null;
}

export interface UpdateProjectionNotePayload {
  body?: string;
  cost_type?: number | null;
  trade?: string | null;
  category?: string | null;
  groups_affected?: string[] | null;
  assigned_to?: number | null;
  due_date?: string | null;
  amount?: number | null;
  recognized_in_financials?: boolean;
  recognized_at?: string | null;
}

export const NOTE_CATEGORIES = [
  'Open Receivable',
  'Open Payables',
  'Committed Costs',
  'Projected Revenue',
  'Change Orders',
  'JTD Cost',
] as const;

export const GAIN_FADE_GROUPS = [
  'Virtual Construction',
  'Project Management',
  'Labor',
  'Takeoff',
  'Bid Manager',
] as const;

export const projectionNotesApi = {
  list: (projectId: number, params?: { type?: ProjectionNoteType; snapshot_id?: number | 'null' }) =>
    api.get<ProjectionNote[]>(`/projects/${projectId}/projection-notes`, { params }),

  counts: (projectId: number) =>
    api.get<ProjectionNoteCount[]>(`/projects/${projectId}/projection-notes/counts`),

  create: (projectId: number, payload: CreateProjectionNotePayload) =>
    api.post<ProjectionNote>(`/projects/${projectId}/projection-notes`, payload),

  update: (projectId: number, id: number, payload: UpdateProjectionNotePayload) =>
    api.patch<ProjectionNote>(`/projects/${projectId}/projection-notes/${id}`, payload),

  setStatus: (projectId: number, id: number, status: 'open' | 'done') =>
    api.patch<ProjectionNote>(`/projects/${projectId}/projection-notes/${id}/status`, { status }),

  delete: (projectId: number, id: number) =>
    api.delete(`/projects/${projectId}/projection-notes/${id}`),
};
