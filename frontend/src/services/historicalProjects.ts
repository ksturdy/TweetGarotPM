import api from './api';

export interface HistoricalProject {
  id?: number;
  name: string;
  bid_date?: string;
  building_type?: string;
  project_type?: string;
  bid_type?: string;
  total_cost?: number;
  total_sqft?: number;
  cost_per_sqft_with_index?: number;
  total_cost_per_sqft?: number;
  // Additional fields will be included when fetched
  created_at?: string;
  updated_at?: string;
}

export const historicalProjectsService = {
  async importProjects(projects: any[]) {
    const response = await api.post('/historical-projects/import', { projects });
    return response.data;
  },

  async getAll() {
    const response = await api.get<HistoricalProject[]>('/historical-projects');
    return response.data;
  },

  async getById(id: number) {
    const response = await api.get<HistoricalProject>(`/historical-projects/${id}`);
    return response.data;
  },

  async update(id: number, data: Partial<HistoricalProject>) {
    const response = await api.put<HistoricalProject>(`/historical-projects/${id}`, data);
    return response.data;
  },

  async delete(id: number) {
    const response = await api.delete(`/historical-projects/${id}`);
    return response.data;
  },

  async deleteAll() {
    const response = await api.delete('/historical-projects/all');
    return response.data;
  }
};
