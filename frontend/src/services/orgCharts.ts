import api from './api';

export interface OrgChart {
  id: number;
  tenant_id: number;
  project_id?: number;
  project_name?: string;
  name: string;
  description?: string;
  created_by?: number;
  created_by_name?: string;
  member_count?: number;
  members?: OrgChartMember[];
  created_at: string;
  updated_at: string;
}

export interface OrgChartMember {
  id: number;
  org_chart_id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  reports_to?: number | null;
  manager_name?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const orgChartsApi = {
  getAll: async (filters?: { project_id?: number; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', String(filters.project_id));
    if (filters?.search) params.set('search', filters.search);
    const query = params.toString();
    const response = await api.get(`/org-charts${query ? `?${query}` : ''}`);
    return response.data;
  },

  getById: async (id: number): Promise<OrgChart> => {
    const response = await api.get(`/org-charts/${id}`);
    return response.data;
  },

  create: async (data: { name: string; description?: string; project_id?: number }) => {
    const response = await api.post('/org-charts', data);
    return response.data;
  },

  update: async (id: number, data: { name: string; description?: string; project_id?: number }) => {
    const response = await api.put(`/org-charts/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/org-charts/${id}`);
    return response.data;
  },

  // Members
  getMembers: async (orgChartId: number): Promise<OrgChartMember[]> => {
    const response = await api.get(`/org-charts/${orgChartId}/members`);
    return response.data;
  },

  createMember: async (orgChartId: number, data: Partial<OrgChartMember>) => {
    const response = await api.post(`/org-charts/${orgChartId}/members`, data);
    return response.data;
  },

  updateMember: async (orgChartId: number, memberId: number, data: Partial<OrgChartMember>) => {
    const response = await api.put(`/org-charts/${orgChartId}/members/${memberId}`, data);
    return response.data;
  },

  deleteMember: async (orgChartId: number, memberId: number) => {
    const response = await api.delete(`/org-charts/${orgChartId}/members/${memberId}`);
    return response.data;
  },
};
