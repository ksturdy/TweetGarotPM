import api from './api';

export interface Submittal {
  id: number;
  project_id: number;
  number: number;
  spec_section: string;
  description: string;
  subcontractor: string;
  status: string;
  due_date: string;
  review_notes: string | null;
  created_by: number;
  created_by_name: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export const submittalsApi = {
  getByProject: (projectId: number, filters?: { status?: string; specSection?: string }) =>
    api.get<Submittal[]>(`/submittals/project/${projectId}`, { params: filters }),

  getById: (id: number) => api.get<Submittal>(`/submittals/${id}`),

  create: (data: Partial<Submittal>) => api.post<Submittal>('/submittals', data),

  update: (id: number, data: Partial<Submittal>) => api.put<Submittal>(`/submittals/${id}`, data),

  review: (id: number, data: { status: string; reviewNotes?: string }) =>
    api.post<Submittal>(`/submittals/${id}/review`, data),
};
