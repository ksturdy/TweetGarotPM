import api from './api';

export interface Project {
  id: number;
  name: string;
  number: string;
  client: string;
  address: string;
  start_date: string;
  end_date: string;
  status: string;
  description: string;
  manager_id: number;
  manager_name: string;
  created_at: string;
}

export const projectsApi = {
  getAll: (filters?: { status?: string; managerId?: number }) =>
    api.get<Project[]>('/projects', { params: filters }),

  getById: (id: number) => api.get<Project>(`/projects/${id}`),

  create: (data: Partial<Project>) => api.post<Project>('/projects', data),

  update: (id: number, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data),

  delete: (id: number) => api.delete(`/projects/${id}`),
};
