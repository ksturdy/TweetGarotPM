import api from './api';

export interface RFI {
  id: number;
  project_id: number;
  number: number;
  subject: string;
  question: string;
  response: string | null;
  priority: string;
  status: string;
  due_date: string;
  assigned_to: number;
  assigned_to_name: string;
  ball_in_court: number | null;
  ball_in_court_name: string | null;
  created_by: number;
  created_by_name: string;
  responded_by: number | null;
  responded_at: string | null;
  created_at: string;
}

export const rfisApi = {
  getByProject: (projectId: number, filters?: { status?: string }) =>
    api.get<RFI[]>(`/rfis/project/${projectId}`, { params: filters }),

  getById: (id: number) => api.get<RFI>(`/rfis/${id}`),

  create: (data: Partial<RFI>) => api.post<RFI>('/rfis', data),

  update: (id: number, data: Partial<RFI>) => api.put<RFI>(`/rfis/${id}`, data),

  respond: (id: number, response: string) => api.post<RFI>(`/rfis/${id}/respond`, { response }),

  close: (id: number) => api.post<RFI>(`/rfis/${id}/close`),
};
