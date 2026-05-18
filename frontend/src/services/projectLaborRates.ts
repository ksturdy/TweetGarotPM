import api from './api';

export interface ProjectLaborRate {
  id: number;
  project_id: number;
  tenant_id: number;
  label: string;
  billable_rate: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const projectLaborRatesApi = {
  list: (projectId: number) =>
    api.get<ProjectLaborRate[]>(`/project-labor-rates/project/${projectId}`),

  create: (projectId: number, data: { label: string; billable_rate?: number; sort_order?: number }) =>
    api.post<ProjectLaborRate>(`/project-labor-rates/project/${projectId}`, data),

  update: (id: number, data: Partial<{ label: string; billable_rate: number; sort_order: number }>) =>
    api.put<ProjectLaborRate>(`/project-labor-rates/${id}`, data),

  delete: (id: number) =>
    api.delete(`/project-labor-rates/${id}`),
};
