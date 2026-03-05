import api from './api';

export interface NearMissReport {
  id: number;
  project_id: number;
  tenant_id: number;
  number: number;
  report_type: 'near_miss' | 'hazard_identification' | 'incentive';
  date_of_incident: string;
  location_on_site: string;
  description: string;
  corrective_action: string;
  date_corrected: string | null;
  reported_by: string;
  status: string;
  notes: string;
  created_by: number;
  created_by_name: string;
  project_name?: string;
  project_number?: string;
  created_at: string;
  updated_at: string;
}

export const REPORT_TYPE_LABELS: Record<string, string> = {
  near_miss: 'Near Miss',
  hazard_identification: 'Hazard Identification',
  incentive: 'Incentive',
};

export const nearMissReportsApi = {
  getByProject: (projectId: number, filters?: { status?: string; report_type?: string }) =>
    api.get<NearMissReport[]>(`/near-miss-reports/project/${projectId}`, { params: filters }),

  getById: (id: number) => api.get<NearMissReport>(`/near-miss-reports/${id}`),

  create: (data: Partial<NearMissReport>) => api.post<NearMissReport>('/near-miss-reports', data),

  update: (id: number, data: Partial<NearMissReport>) =>
    api.put<NearMissReport>(`/near-miss-reports/${id}`, data),

  submit: (id: number) => api.post<NearMissReport>(`/near-miss-reports/${id}/submit`),

  delete: (id: number) => api.delete(`/near-miss-reports/${id}`),
};
