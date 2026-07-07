import api from './api';

export type AssignmentStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type NotificationChannel = 'email' | 'sms';

export interface AssignmentRecord {
  id: number;
  employee_id: number;
  project_id: number;
  tenant_id: number;
  trade: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  shift_pattern: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  status: AssignmentStatus | null;
  notes: string | null;
  tags: string[] | null;
  start_date_overridden?: boolean;
  end_date_overridden?: boolean;
  assigned_by: number;
  assigned_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  job_title?: string;
  employee_title?: string | null;
  employee_trade?: string | null;
  employee_group?: string | null;
  profile_type?: string | null;
  project_name?: string;
  project_number?: string;
  project_address?: string;
  project_city?: string;
  project_state?: string;
  project_zip?: string;
  project_start_date?: string | null;
  project_end_date?: string | null;
}

export interface LaborBoardRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  job_title: string | null;
  title: string | null;
  trade: string | null;
  employee_group: string | null;
  profile_type: string | null;
  hire_date: string | null;
  current_project_id: number | null;
  current_project_name: string | null;
  current_project_number: string | null;
  current_end_date: string | null;
  current_start_date: string | null;
  current_role: string | null;
  next_project_id: number | null;
  next_project_name: string | null;
  next_project_number: string | null;
  next_start_date: string | null;
  next_role: string | null;
  availability: 'available' | 'assigned';
}

export interface LaborSummary {
  total_employees: string;
  currently_assigned: string;
  upcoming_assignments: string;
  ending_within_two_weeks: string;
}

export interface BoardFilters {
  trade?: string;
  title?: string;
  group?: string;
  profile_type?: string;
  search?: string;
}

export interface AssignPayload {
  projectId: number;
  employeeId: number;
  role?: string;
  trade?: string;
  startDate?: string;
  endDate?: string;
  startDateOverridden?: boolean;
  endDateOverridden?: boolean;
  shiftPattern?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  status?: AssignmentStatus;
  notes?: string;
  tags?: string[];
}

export interface ProjectDefaultDates {
  start_date: string | null;
  end_date: string | null;
  end_source: 'user_override' | 'computed' | 'project_table' | 'none';
}

export interface NotificationLog {
  id: number;
  assignment_id: number;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  body: string | null;
  status: string;
  error: string | null;
  sent_at: string;
  sent_by_first_name?: string;
  sent_by_last_name?: string;
}

export interface NotifyResult {
  channel: NotificationChannel;
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
  preview?: boolean;
}

export interface EmployeeHistoryRecord {
  id: number;
  project_id: number;
  role: string | null;
  trade: string | null;
  start_date: string | null;
  end_date: string | null;
  status: AssignmentStatus | null;
  first_name: string;
  last_name: string;
  employee_title: string | null;
  employee_trade: string | null;
  project_name: string;
  project_number: string;
  project_address: string | null;
  market: string | null;
  square_footage: number | null;
  project_start_date: string | null;
  project_end_date: string | null;
  customer_name: string | null;
  contract_amount: string | null;
}

export const ASSIGNMENT_ROLES = [
  'Foreman',
  'Journeyman',
  'Apprentice 5',
  'Apprentice 4',
  'Apprentice 3',
  'Apprentice 2',
  'Apprentice 1',
  'Pre-Apprentice',
  'Helper',
] as const;

export const ASSIGNMENT_TRADES = ['Pipefitter', 'Plumber', 'Sheet Metal', 'HVAC Service'] as const;

export const SHIFT_PATTERNS = ['M-F', 'M-Th', 'M-Sa', 'T-F', 'Tu-Sa', 'Weekend'] as const;

export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['planned', 'active', 'completed', 'cancelled'];

export const laborApi = {
  getBoard: (filters?: BoardFilters) => {
    const params = new URLSearchParams();
    if (filters?.trade) params.append('trade', filters.trade);
    if (filters?.title) params.append('title', filters.title);
    if (filters?.group) params.append('group', filters.group);
    if (filters?.profile_type) params.append('profile_type', filters.profile_type);
    if (filters?.search) params.append('search', filters.search);
    const qs = params.toString();
    return api.get<LaborBoardRow[]>(`/labor/board${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },

  getSummary: () => api.get<LaborSummary>('/labor/dashboard/summary').then((r) => r.data),

  getCalendar: (from: string, to: string, filters?: { trade?: string; group?: string; title?: string }) => {
    const qs = new URLSearchParams({ from, to });
    if (filters?.trade) qs.append('trade', filters.trade);
    if (filters?.group) qs.append('group', filters.group);
    if (filters?.title) qs.append('title', filters.title);
    return api.get<AssignmentRecord[]>(`/labor/calendar?${qs.toString()}`).then((r) => r.data);
  },

  getAssignmentsList: (params: { status?: string; search?: string; from?: string; to?: string; trade?: string; group?: string; title?: string }) => {
    const qs = new URLSearchParams();
    if (params.status) qs.append('status', params.status);
    if (params.search) qs.append('search', params.search);
    if (params.from) qs.append('from', params.from);
    if (params.to) qs.append('to', params.to);
    if (params.trade) qs.append('trade', params.trade);
    if (params.group) qs.append('group', params.group);
    if (params.title) qs.append('title', params.title);
    const s = qs.toString();
    return api.get<AssignmentRecord[]>(`/labor/assignments${s ? `?${s}` : ''}`).then((r) => r.data);
  },

  getEmployeeHistory: (employeeId: number) =>
    api.get<EmployeeHistoryRecord[]>(`/labor/employees/${employeeId}/history`).then((r) => r.data),

  getEmployeeAssignments: (employeeId: number, scope: 'current' | 'upcoming' | 'past') =>
    api
      .get<AssignmentRecord[]>(`/project-assignments/employee/${employeeId}/assignments?scope=${scope}`)
      .then((r) => r.data),

  assign: (payload: AssignPayload) =>
    api
      .post<AssignmentRecord[]>(`/project-assignments/project/${payload.projectId}`, {
        employeeId: payload.employeeId,
        role: payload.role,
        trade: payload.trade,
        startDate: payload.startDate,
        endDate: payload.endDate,
        startDateOverridden: payload.startDateOverridden,
        endDateOverridden: payload.endDateOverridden,
        shiftPattern: payload.shiftPattern,
        shiftStartTime: payload.shiftStartTime,
        shiftEndTime: payload.shiftEndTime,
        status: payload.status,
        notes: payload.notes,
        tags: payload.tags,
      })
      .then((r) => r.data),

  getProjectDefaultDates: (projectId: number) =>
    api.get<ProjectDefaultDates>(`/labor/projects/${projectId}/default-dates`).then((r) => r.data),

  updateAssignment: (id: number, patch: Partial<AssignmentRecord>) =>
    api.patch<AssignmentRecord>(`/project-assignments/${id}`, patch).then((r) => r.data),

  cancelAssignment: (id: number) =>
    api.delete<{ deleted: AssignmentRecord }>(`/project-assignments/${id}`).then((r) => r.data),

  notify: (assignmentId: number, channels: NotificationChannel[], customMessage?: string) =>
    api
      .post<{ results: NotifyResult[]; history: NotificationLog[] }>(
        `/project-assignments/${assignmentId}/notify`,
        { channels, customMessage }
      )
      .then((r) => r.data),

  getNotifications: (assignmentId: number) =>
    api.get<NotificationLog[]>(`/project-assignments/${assignmentId}/notifications`).then((r) => r.data),
};
