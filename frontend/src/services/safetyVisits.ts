import api from './api';
import type { ObservationSection } from './safetyObservations';

export type VisitType = 'kickoff' | 'routine' | 'follow_up';
export type VisitStatus = 'proposed' | 'confirmed' | 'completed' | 'cancelled';

export interface SafetyVisit {
  id: number;
  tenant_id: number;
  project_id: number;
  project_name?: string;
  project_number?: string;
  project_address?: string;
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
  start_date: string;
  end_date: string | null;
  percent_complete: number;
  project_status: string;
  department_id: number | null;
  department_name: string | null;
  remaining_hours: number;
  last_visit_date: string | null;
  completed_count: number;
  days_since_last_visit: number | null;
  priority_score: number;
  needs_kickoff: boolean;
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
};
