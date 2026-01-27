import api from './api';

export interface Team {
  id: number;
  name: string;
  description: string | null;
  team_lead_id: number | null;
  team_lead_name: string | null;
  color: string;
  is_active: boolean;
  member_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  employee_id: number;
  role: 'lead' | 'member';
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department_id: number | null;
  department_name: string | null;
  user_id: number | null;
  joined_at: string;
}

export interface TeamDashboard {
  opportunities: {
    total: number;
    total_value: number;
    won: number;
    won_value: number;
  };
  customers: {
    total: number;
    active: number;
  };
  estimates: {
    total: number;
    total_value: number;
    pending: number;
    won: number;
  };
}

export interface TeamOpportunity {
  id: number;
  title: string;
  client_name: string;
  estimated_value: number;
  stage_id: number;
  stage_name: string;
  stage_color: string;
  assigned_to: number;
  assigned_to_name: string;
  priority: string;
  last_activity_at: string;
  created_at: string;
}

export interface TeamCustomer {
  id: number;
  customer_facility: string;
  customer_owner: string;
  account_manager: string;
  city: string;
  state: string;
  active_customer: boolean;
  customer_score: number | null;
}

export interface TeamEstimate {
  id: number;
  estimate_number: string;
  project_name: string;
  customer_name: string;
  status: string;
  total_cost: number;
  bid_date: string;
  estimator_id: number;
  estimator_full_name: string;
  created_at: string;
}

export interface TeamInput {
  name: string;
  description?: string;
  team_lead_id?: number;
  color?: string;
  is_active?: boolean;
}

export const teamsApi = {
  getAll: () => api.get<{ data: Team[] }>('/teams'),

  getById: (id: number) => api.get<{ data: Team }>(`/teams/${id}`),

  create: (data: TeamInput) => api.post<{ data: Team }>('/teams', data),

  update: (id: number, data: Partial<TeamInput>) =>
    api.put<{ data: Team }>(`/teams/${id}`, data),

  delete: (id: number) => api.delete<{ message: string }>(`/teams/${id}`),

  getMembers: (id: number) =>
    api.get<{ data: TeamMember[] }>(`/teams/${id}/members`),

  addMember: (teamId: number, employeeId: number, role: string = 'member') =>
    api.post<{ data: TeamMember }>(`/teams/${teamId}/members`, {
      employee_id: employeeId,
      role,
    }),

  removeMember: (teamId: number, employeeId: number) =>
    api.delete<{ message: string }>(`/teams/${teamId}/members/${employeeId}`),

  updateMemberRole: (teamId: number, employeeId: number, role: string) =>
    api.patch<{ data: TeamMember }>(
      `/teams/${teamId}/members/${employeeId}/role`,
      { role }
    ),

  getDashboard: (id: number) =>
    api.get<{ data: TeamDashboard }>(`/teams/${id}/dashboard`),

  getOpportunities: (id: number) =>
    api.get<{ data: TeamOpportunity[] }>(`/teams/${id}/opportunities`),

  getCustomers: (id: number) =>
    api.get<{ data: TeamCustomer[] }>(`/teams/${id}/customers`),

  getEstimates: (id: number) =>
    api.get<{ data: TeamEstimate[] }>(`/teams/${id}/estimates`),
};
