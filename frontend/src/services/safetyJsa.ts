import api from './api';

export interface SafetyJsa {
  id: number;
  project_id: number;
  tenant_id: number;
  number: number;
  task_description: string;
  work_location: string;
  date_of_work: string;
  weather: string;
  temperature: string;
  ppe_required: string[];
  status: string;
  notes: string;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  hazards?: SafetyJsaHazard[];
  signatures?: SafetyJsaSignature[];
}

export interface SafetyJsaHazard {
  id: number;
  jsa_id: number;
  sort_order: number;
  step_description: string;
  hazard: string;
  control_measure: string;
  responsible_person: string;
}

export interface SafetyJsaSignature {
  id: number;
  jsa_id: number;
  employee_name: string;
  employee_id: number | null;
  signed_at: string;
  signature_data: string | null;
}

export const safetyJsaApi = {
  getByProject: (projectId: number, filters?: { status?: string }) =>
    api.get<SafetyJsa[]>(`/safety-jsa/project/${projectId}`, { params: filters }),

  getById: (id: number) => api.get<SafetyJsa>(`/safety-jsa/${id}`),

  create: (data: Partial<SafetyJsa>) => api.post<SafetyJsa>('/safety-jsa', data),

  update: (id: number, data: Partial<SafetyJsa>) =>
    api.put<SafetyJsa>(`/safety-jsa/${id}`, data),

  addHazard: (jsaId: number, data: Partial<SafetyJsaHazard>) =>
    api.post<SafetyJsaHazard>(`/safety-jsa/${jsaId}/hazards`, data),

  updateHazard: (jsaId: number, hazardId: number, data: Partial<SafetyJsaHazard>) =>
    api.put<SafetyJsaHazard>(`/safety-jsa/${jsaId}/hazards/${hazardId}`, data),

  deleteHazard: (jsaId: number, hazardId: number) =>
    api.delete(`/safety-jsa/${jsaId}/hazards/${hazardId}`),

  addSignature: (jsaId: number, data: { employeeName: string; employeeId?: number; signatureData?: string }) =>
    api.post<SafetyJsaSignature>(`/safety-jsa/${jsaId}/sign`, data),

  activate: (id: number) => api.post<SafetyJsa>(`/safety-jsa/${id}/activate`),

  complete: (id: number) => api.post<SafetyJsa>(`/safety-jsa/${id}/complete`),

  delete: (id: number) => api.delete(`/safety-jsa/${id}`),
};
