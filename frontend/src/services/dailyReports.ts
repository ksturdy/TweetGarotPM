import api from './api';

export interface DailyReportCrew {
  id: number;
  daily_report_id: number;
  trade: string;
  foreman: string;
  crew_size: number;
  hours_worked: number;
  work_description: string;
}

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
  status: string;
  delay_hours: number;
  delay_reason: string;
  safety_incidents: number;
  safety_notes: string;
  submitted_by: number | null;
  submitted_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  crews?: DailyReportCrew[];
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

  submit: (id: number) => api.post<DailyReport>(`/daily-reports/${id}/submit`),

  approve: (id: number) => api.post<DailyReport>(`/daily-reports/${id}/approve`),

  addCrew: (reportId: number, data: Partial<DailyReportCrew>) =>
    api.post<DailyReportCrew>(`/daily-reports/${reportId}/crews`, data),

  updateCrew: (reportId: number, crewId: number, data: Partial<DailyReportCrew>) =>
    api.put<DailyReportCrew>(`/daily-reports/${reportId}/crews/${crewId}`, data),

  deleteCrew: (reportId: number, crewId: number) =>
    api.delete(`/daily-reports/${reportId}/crews/${crewId}`),
};
