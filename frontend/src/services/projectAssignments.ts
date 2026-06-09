import api from './api';

export interface ProjectAssignment {
  id: number;
  employee_id: number;
  user_id: number | null;
  project_id: number;
  tenant_id: number;
  trade: string | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  shift_pattern: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  status: string | null;
  notes: string | null;
  tags: string[] | null;
  assigned_by: number;
  assigned_at: string;
  // joined
  project_name?: string;
  project_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  job_title?: string;
}

export interface AssignToProjectInput {
  employeeId: number;
  trade?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  shiftPattern?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  status?: string;
  notes?: string;
  tags?: string[];
}

export const FOREMAN_TRADES = ['Pipefitter', 'Plumber', 'Sheet Metal'] as const;

export const projectAssignmentsApi = {
  getByUser: (userId: number) =>
    api.get<ProjectAssignment[]>(`/project-assignments/user/${userId}`).then(res => res.data),

  getByProject: (projectId: number) =>
    api.get<ProjectAssignment[]>(`/project-assignments/project/${projectId}`).then(res => res.data),

  addToProject: (projectId: number, input: AssignToProjectInput | number, legacyTrade?: string) => {
    // Backwards-compatible signature: callers that still pass (projectId, employeeId, trade)
    // continue to work; new callers pass a full input object.
    const payload: AssignToProjectInput =
      typeof input === 'number' ? { employeeId: input, trade: legacyTrade } : input;
    return api
      .post<ProjectAssignment[]>(`/project-assignments/project/${projectId}`, payload)
      .then(res => res.data);
  },

  removeFromProject: (projectId: number, employeeId: number) =>
    api.delete<ProjectAssignment[]>(`/project-assignments/project/${projectId}/employee/${employeeId}`).then(res => res.data),

  updateTrade: (projectId: number, employeeId: number, trade: string) =>
    api.patch<ProjectAssignment[]>(`/project-assignments/project/${projectId}/employee/${employeeId}/trade`, { trade }).then(res => res.data),

  patchAssignment: (id: number, patch: Partial<ProjectAssignment>) =>
    api.patch<ProjectAssignment>(`/project-assignments/${id}`, patch).then(res => res.data),

  deleteAssignment: (id: number) =>
    api.delete<{ deleted: ProjectAssignment }>(`/project-assignments/${id}`).then(res => res.data),

  syncForUser: (userId: number, projectIds: number[]) =>
    api.put<ProjectAssignment[]>(`/project-assignments/user/${userId}`, { projectIds }).then(res => res.data),
};
