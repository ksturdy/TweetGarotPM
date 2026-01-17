import api from './api';

export interface Company {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCompany extends Company {
  role: string;
  is_primary: boolean;
  project_notes: string | null;
  project_company_id: number;
}

export const companiesApi = {
  getAll: () => api.get<Company[]>('/companies'),

  getByProject: (projectId: number) =>
    api.get<ProjectCompany[]>(`/companies/project/${projectId}`),

  getById: (id: number) => api.get<Company>(`/companies/${id}`),

  create: (data: Partial<Company>) => api.post<Company>('/companies', data),

  update: (id: number, data: Partial<Company>) =>
    api.put<Company>(`/companies/${id}`, data),

  delete: (id: number) => api.delete(`/companies/${id}`),

  addToProject: (projectId: number, data: { companyId: number; role: string; isPrimary?: boolean; notes?: string }) =>
    api.post(`/companies/project/${projectId}`, data),

  updateProjectCompany: (projectCompanyId: number, data: { role?: string; isPrimary?: boolean; notes?: string }) =>
    api.put(`/companies/project-company/${projectCompanyId}`, data),

  removeFromProject: (projectCompanyId: number) =>
    api.delete(`/companies/project-company/${projectCompanyId}`),
};
