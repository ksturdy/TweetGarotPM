import api from './api';
import type { ObservationSection } from './safetyObservations';

export type VisitType = 'kickoff' | 'routine' | 'follow_up';
export type VisitStatus = 'proposed' | 'confirmed' | 'completed' | 'cancelled';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  type: RecurrenceFrequency;

  // Daily
  dailyInterval?: number;
  dailyWeekdaysOnly?: boolean;

  // Weekly
  weeklyInterval?: number;
  weeklyDays?: number[]; // 0=Mon … 6=Sun

  // Monthly
  monthlyInterval?: number;
  monthlyType?: 'day_of_month' | 'day_of_week';
  monthlyDay?: number;       // 1–31
  monthlyWeek?: number;      // 1–4 or -1 (last)
  monthlyWeekday?: number;   // 0=Mon … 6=Sun

  // Yearly
  yearlyInterval?: number;
  yearlyMonth?: number;      // 1–12
  yearlyDay?: number;
  yearlyType?: 'day_of_month' | 'day_of_week';
  yearlyWeek?: number;
  yearlyWeekday?: number;

  // Range
  endType: 'occurrences' | 'by_date' | 'no_end';
  occurrences?: number;
  endByDate?: string;
}

export interface SafetyVisitSeries {
  id: number;
  tenant_id: number;
  project_id: number;
  frequency: RecurrenceFrequency;
  occurrences: number | null;
  end_by_date: string | null;
  visit_type: VisitType;
  assigned_to: number | null;
  created_at: string;
}

export interface SafetyVisit {
  id: number;
  tenant_id: number;
  project_id: number;
  project_name?: string;
  project_number?: string;
  project_address?: string;
  project_city?: string | null;
  project_state?: string | null;
  series_id?: number | null;
  series_position?: number | null;
  series_frequency?: RecurrenceFrequency | null;
  number: number;
  visit_type: VisitType;
  status: VisitStatus;
  scheduled_date: string | null;
  end_date: string | null;
  assigned_to: number | null;
  assigned_to_name?: string | null;
  travel_hours_ow: number | null;
  travel_notes: string | null;
  is_out_of_state: boolean;
  completed_date: string | null;
  completed_by: number | null;
  completed_by_name?: string | null;
  report_weather: string | null;
  report_temp: number | null;
  report_notes: string | null;
  report_sections: ObservationSection[];
  created_by: number;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithPriority {
  id: number;
  name: string;
  number: string;
  address: string | null;
  ship_city: string | null;
  ship_state: string | null;
  start_date: string;
  end_date: string | null;
  percent_complete: number;
  project_status: string;
  department_id: number | null;
  department_name: string | null;
  manager_name: string | null;
  remaining_hours: number;
  last_visit_date: string | null;
  completed_count: number;
  days_since_last_visit: number | null;
  priority_score: number;
  needs_kickoff: boolean;
}

export interface LaborByTrade {
  trade: string;
  est_hours: number;
  jtd_hours: number;
  remaining_hours: number;
}

export interface ProjectInfo {
  id: number;
  name: string;
  number: string;
  address: string | null;
  ship_city: string | null;
  ship_state: string | null;
  start_date: string | null;
  end_date: string | null;
  percent_complete: number;
  project_status: string;
  manager_name: string | null;
  department_name: string | null;
  labor_by_trade: LaborByTrade[];
}

export const safetyVisitsApi = {
  getProjects: (params?: { teamId?: number; departmentId?: number; statuses?: string[] }) =>
    api.get<ProjectWithPriority[]>('/safety-visits/projects', {
      params: params ? { ...params, statuses: params.statuses?.join(',') } : undefined,
    }),

  getAll: (params?: { start?: string; end?: string; assigned_to?: number }) =>
    api.get<SafetyVisit[]>('/safety-visits', { params }),

  getByProject: (projectId: number) =>
    api.get<SafetyVisit[]>(`/safety-visits/project/${projectId}`),

  getById: (id: number) =>
    api.get<SafetyVisit>(`/safety-visits/${id}`),

  create: (data: {
    project_id: number;
    visit_type?: VisitType;
    status?: VisitStatus;
    scheduled_date?: string | null;
    end_date?: string | null;
    assigned_to?: number | null;
    travel_hours_ow?: number | null;
    travel_notes?: string | null;
    is_out_of_state?: boolean;
  }) => api.post<SafetyVisit>('/safety-visits', data),

  update: (id: number, data: Partial<SafetyVisit>) =>
    api.put<SafetyVisit>(`/safety-visits/${id}`, data),

  reschedule: (id: number, scheduledDate: string, endDate?: string | null) =>
    api.put<SafetyVisit>(`/safety-visits/${id}/reschedule`, { scheduled_date: scheduledDate, end_date: endDate ?? null }),

  complete: (id: number, data: {
    completed_date?: string;
    report_weather?: string | null;
    report_temp?: number | null;
    report_notes?: string | null;
    report_sections?: ObservationSection[];
  }) => api.post<SafetyVisit>(`/safety-visits/${id}/complete`, data),

  delete: (id: number) =>
    api.delete(`/safety-visits/${id}`),

  createSeries: (data: {
    project_id: number;
    recurrence_rule: RecurrenceRule;
    anchor_date: string;
    duration_days?: number;
    visit_type?: VisitType;
    assigned_to?: number | null;
    travel_hours_ow?: number | null;
    travel_notes?: string | null;
    is_out_of_state?: boolean;
  }) => api.post<{ series: SafetyVisitSeries; visitIds: number[] }>('/safety-visits/series', data),

  updateSeries: (seriesId: number, data: {
    scope: 'forward' | 'all';
    from_position?: number;
    visit_type?: VisitType;
    assigned_to?: number | null;
    travel_hours_ow?: number | null;
    travel_notes?: string | null;
    is_out_of_state?: boolean;
  }) => api.put(`/safety-visits/series/${seriesId}`, data),

  deleteSeries: (seriesId: number) =>
    api.delete(`/safety-visits/series/${seriesId}`),

  deleteSeriesForward: (visitId: number) =>
    api.delete(`/safety-visits/${visitId}/series-forward`),

  getProjectInfo: (projectId: number) =>
    api.get<ProjectInfo>(`/safety-visits/project-info/${projectId}`),
};
