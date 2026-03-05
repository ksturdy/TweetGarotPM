import api from './api';

export interface ProjectAssignment {
  id: number;
  employee_id: number;
  user_id: number | null;
  project_id: number;
  tenant_id: number;
  trade: string | null;
  assigned_by: number;
  assigned_at: string;
  // Joined fields
  project_name?: string;
  project_number?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export const FOREMAN_TRADES = ['Pipefitter', 'Plumber', 'Sheet Metal'] as const;

export const projectAssignmentsApi = {
  getByUser: (userId: number) =>
    api.get<ProjectAssignment[]>(`/project-assignments/user/${userId}`).then(res => res.data),

  getByProject: (projectId: number) =>
    api.get<ProjectAssignment[]>(`/project-assignments/project/${projectId}`).then(res => res.data),

  addToProject: (projectId: number, employeeId: number, trade?: string) =>
    api.post<ProjectAssignment[]>(`/project-assignments/project/${projectId}`, { employeeId, trade }).then(res => res.data),

  removeFromProject: (projectId: number, employeeId: number) =>
    api.delete<ProjectAssignment[]>(`/project-assignments/project/${projectId}/employee/${employeeId}`).then(res => res.data),

  updateTrade: (projectId: number, employeeId: number, trade: string) =>
    api.patch<ProjectAssignment[]>(`/project-assignments/project/${projectId}/employee/${employeeId}/trade`, { trade }).then(res => res.data),

  syncForUser: (userId: number, projectIds: number[]) =>
    api.put<ProjectAssignment[]>(`/project-assignments/user/${userId}`, { projectIds }).then(res => res.data),
};
