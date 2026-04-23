import api from './api';

export interface ScheduledReportRecipient {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ScheduledReport {
  id: number;
  tenant_id: number;
  name: string;
  report_type: 'executive_report' | 'backlog_fit' | 'cash_flow' | 'buyout_metric' | 'campaign' | 'opportunity_search';
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  filters: Record<string, unknown>;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: number | null;
  created_by_name: string | null;
  recipients: ScheduledReportRecipient[];
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportInput {
  name: string;
  report_type: string;
  frequency: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  time_of_day?: string;
  timezone?: string;
  filters?: Record<string, unknown>;
  is_enabled?: boolean;
  recipient_user_ids: number[];
}

export const scheduledReportsApi = {
  getAll: () => api.get<ScheduledReport[]>('/scheduled-reports').then(r => r.data),

  getById: (id: number) => api.get<ScheduledReport>(`/scheduled-reports/${id}`).then(r => r.data),

  create: (data: ScheduledReportInput) => api.post<ScheduledReport>('/scheduled-reports', data).then(r => r.data),

  update: (id: number, data: Partial<ScheduledReportInput>) => api.put<ScheduledReport>(`/scheduled-reports/${id}`, data).then(r => r.data),

  delete: (id: number) => api.delete(`/scheduled-reports/${id}`),

  sendNow: (id: number) => api.post<{ message: string; result: unknown }>(`/scheduled-reports/${id}/send-now`).then(r => r.data),
};
