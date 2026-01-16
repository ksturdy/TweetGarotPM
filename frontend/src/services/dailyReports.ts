import api from './api';

export interface DailyReport {
  id: number;
  project_id: number;
  report_date: string;
  weather: string;
  temperature: string;
  work_performed: string;
  materials: string;
  equipment: string;
  visitors: string;
  issues: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export const dailyReportsApi = {
  getByProject: (projectId: number, filters?: { startDate?: string; endDate?: string }) =>
    api.get<DailyReport[]>(`/daily-reports/project/${projectId}`, { params: filters }),

  getByDate: (projectId: number, date: string) =>
    api.get<DailyReport>(`/daily-reports/project/${projectId}/date/${date}`),

  getById: (id: number) => api.get<DailyReport>(`/daily-reports/${id}`),

  create: (data: Partial<DailyReport>) => api.post<DailyReport>('/daily-reports', data),

  update: (id: number, data: Partial<DailyReport>) =>
    api.put<DailyReport>(`/daily-reports/${id}`, data),

  delete: (id: number) => api.delete(`/daily-reports/${id}`),
};
