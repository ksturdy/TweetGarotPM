import api from './api';

export type AssignmentStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type TimeOffType = 'vacation' | 'fmla' | 'laid_off' | 'light_duty';
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

export interface NominationRecord extends AssignmentRecord {
  nominator_first_name: string | null;
  nominator_last_name: string | null;
  nominator_email: string | null;
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
  current_account_id: number | null;
  current_project_name: string | null;
  current_project_number: string | null;
  current_end_date: string | null;
  current_start_date: string | null;
  current_role: string | null;
  next_project_id: number | null;
  next_account_id: number | null;
  next_project_name: string | null;
  next_project_number: string | null;
  next_start_date: string | null;
  next_role: string | null;
  availability: 'available' | 'assigned' | 'time_off';
  time_off_type: TimeOffType | null;
  time_off_end_date: string | null;
}

export interface TimeOffRecord {
  id: number;
  tenant_id: number;
  employee_id: number;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
  employee_trade?: string | null;
  employee_group?: string | null;
}

export interface TimeOffPayload {
  employeeId: number;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  notes?: string;
}

export const TIME_OFF_LABELS: Record<TimeOffType, string> = {
  vacation:   'Vacation',
  fmla:       'FMLA',
  laid_off:   'Laid Off',
  light_duty: 'Light Duty',
};

export const TIME_OFF_COLORS: Record<TimeOffType, { bg: string; border: string; color: string }> = {
  vacation:   { bg: '#fef3c7', border: '#d97706', color: '#92400e' },
  fmla:       { bg: '#ede9fe', border: '#7c3aed', color: '#4c1d95' },
  laid_off:   { bg: '#f1f5f9', border: '#64748b', color: '#1e293b' },
  light_duty: { bg: '#dcfce7', border: '#16a34a', color: '#14532d' },
};

export interface LaborSummary {
  total_employees: string;
  currently_assigned: string;
  upcoming_assignments: string;
  ending_within_two_weeks: string;
  unfilled_roles: string;
}

export interface UnfilledRole {
  id: number;
  project_id: number | null;
  labor_account_id: number | null;
  project_name: string | null;
  project_number: string | null;
  project_address: string | null;
  project_start_date: string | null;
  project_end_date: string | null;
  labor_account_name: string | null;
  labor_account_code: string | null;
  trade: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  fill_notes: string | null;
  status: AssignmentStatus | null;
}

export interface RoleCandidate {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  employee_trade: string | null;
  title: string | null;
  employee_group: string | null;
  is_available: boolean;
  trade_match: number;
}

export interface UnfilledRolePayload {
  projectId?: number;
  laborAccountId?: number;
  trade?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  fillNotes?: string;
  shiftPattern?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  status?: AssignmentStatus;
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

export const SHIFT_PATTERNS = ['M-F', 'M-Th', 'M-Sa', 'T-F', 'Tu-Sa', 'Weekend', 'Su-Sa'] as const;

export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['planned', 'active', 'completed', 'cancelled'];

export interface LaborAccount {
  id: number;
  tenant_id: number;
  name: string;
  department_code: string | null;
  location: string | null;
  customer_id: number | null;
  customer_name?: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface LaborAccountPayload {
  name: string;
  departmentCode?: string;
  location?: string;
  customerId?: number;
  notes?: string;
}

export interface HeadcountChartRow {
  month: string; // YYYY-MM
  pf: number;
  sm: number;
  pl: number;
  other: number;
  total: number;
}

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

  getHeadcountChart: (months = 12) =>
    api.get<HeadcountChartRow[]>(`/labor/headcount-chart?months=${months}`).then((r) => r.data),

  getCalendar: (from: string, to: string, filters?: { trade?: string; group?: string; title?: string }) => {
    const qs = new URLSearchParams({ from, to });
    if (filters?.trade) qs.append('trade', filters.trade);
    if (filters?.group) qs.append('group', filters.group);
    if (filters?.title) qs.append('title', filters.title);
    return api.get<AssignmentRecord[]>(`/labor/calendar?${qs.toString()}`).then((r) => r.data);
  },

  getAssignmentsList: (params: { status?: string; search?: string; from?: string; to?: string; trade?: string; group?: string; title?: string; project?: string }) => {
    const qs = new URLSearchParams();
    if (params.status) qs.append('status', params.status);
    if (params.search) qs.append('search', params.search);
    if (params.from) qs.append('from', params.from);
    if (params.to) qs.append('to', params.to);
    if (params.trade) qs.append('trade', params.trade);
    if (params.group) qs.append('group', params.group);
    if (params.title) qs.append('title', params.title);
    if (params.project) qs.append('project', params.project);
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

  getTimeOff: (from: string, to: string) =>
    api.get<TimeOffRecord[]>(`/labor/time-off?from=${from}&to=${to}`).then((r) => r.data),

  getEmployeeTimeOff: (employeeId: number) =>
    api.get<TimeOffRecord[]>(`/labor/time-off/employee/${employeeId}`).then((r) => r.data),

  createTimeOff: (payload: TimeOffPayload) =>
    api.post<TimeOffRecord>('/labor/time-off', {
      employeeId: payload.employeeId,
      type: payload.type,
      startDate: payload.startDate,
      endDate: payload.endDate,
      notes: payload.notes,
    }).then((r) => r.data),

  updateTimeOff: (id: number, patch: Partial<Omit<TimeOffPayload, 'employeeId'>>) =>
    api.patch<TimeOffRecord>(`/labor/time-off/${id}`, {
      type: patch.type,
      start_date: patch.startDate,
      end_date: patch.endDate,
      notes: patch.notes,
    }).then((r) => r.data),

  deleteTimeOff: (id: number) =>
    api.delete<{ deleted: TimeOffRecord }>(`/labor/time-off/${id}`).then((r) => r.data),

  getAccounts: (includeInactive = false) =>
    api.get<LaborAccount[]>(`/labor/accounts${includeInactive ? '?include_inactive=true' : ''}`).then((r) => r.data),

  createAccount: (payload: LaborAccountPayload) =>
    api.post<LaborAccount>('/labor/accounts', payload).then((r) => r.data),

  updateAccount: (id: number, patch: Partial<LaborAccountPayload> & { is_active?: boolean }) =>
    api.patch<LaborAccount>(`/labor/accounts/${id}`, patch).then((r) => r.data),

  deleteAccount: (id: number) =>
    api.delete<{ deleted: LaborAccount }>(`/labor/accounts/${id}`).then((r) => r.data),

  getUnfilledRoles: () =>
    api.get<UnfilledRole[]>('/project-assignments/unfilled').then((r) => r.data),

  createUnfilledRole: (payload: UnfilledRolePayload) =>
    api.post<UnfilledRole>('/project-assignments/unfilled', payload).then((r) => r.data),

  getCandidates: (assignmentId: number) =>
    api.get<RoleCandidate[]>(`/project-assignments/${assignmentId}/candidates`).then((r) => r.data),

  fillRole: (assignmentId: number, employeeId: number) =>
    api.post<AssignmentRecord>(`/project-assignments/${assignmentId}/fill`, { employeeId }).then((r) => r.data),

  assignToAccount: (accountId: number, payload: Omit<AssignPayload, 'projectId'>) =>
    api.post<AssignmentRecord>(`/labor/accounts/${accountId}/assign`, {
      employeeId: payload.employeeId,
      role: payload.role,
      trade: payload.trade,
      startDate: payload.startDate,
      endDate: payload.endDate,
      shiftPattern: payload.shiftPattern,
      shiftStartTime: payload.shiftStartTime,
      shiftEndTime: payload.shiftEndTime,
      status: payload.status,
      notes: payload.notes,
      tags: payload.tags,
    }).then((r) => r.data),

  getNominations: (filters?: { project?: string; trade?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.project) params.set('project', filters.project);
    if (filters?.trade) params.set('trade', filters.trade);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString();
    return api.get<NominationRecord[]>(`/project-assignments/nominations${qs ? `?${qs}` : ''}`).then((r) => r.data);
  },

  approveNomination: (id: number) =>
    api.patch<AssignmentRecord>(`/project-assignments/${id}`, { status: 'active' }).then((r) => r.data),

  declineNomination: (id: number, reason?: string) =>
    api.patch<AssignmentRecord>(`/project-assignments/${id}`, { status: 'cancelled', ...(reason ? { notes: reason } : {}) }).then((r) => r.data),

  reassignNomination: (id: number, employeeId: number) =>
    api.post<AssignmentRecord>(`/project-assignments/${id}/reassign`, { employeeId }).then((r) => r.data),
};
