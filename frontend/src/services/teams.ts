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
  projects: {
    total: number;
    active: number;
    total_value: number;
    total_backlog: number;
    avg_gross_margin: number | null;
  };
  cashFlow: {
    net_cash_position: number;
    positive_count: number;
    total_count: number;
    total_open_receivables: number;
  };
  buyout: {
    total_buyout_remaining: number;
    total_committed: number;
    total_est_cost: number;
    project_count: number;
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
  name: string;
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

export interface TeamProject {
  id: number;
  project_number: string;
  name: string;
  status: string;
  market: string;
  manager_name: string;
  customer_name: string;
  owner_name: string;
  department_name: string;
  department_number: string;
  contract_value: number;
  gross_margin_percent: number;
  backlog: number;
  actual_cost: number;
  percent_complete: number;
  client: string;
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

  // Get all employee IDs, user IDs, and names from teams where the current user is a member
  // employeeIds: for project filtering (manager_id references employees)
  // userIds: for opportunity/estimate filtering (assigned_to/estimator_id reference users)
  // names: for matching estimates by estimator_name text field
  getMyTeamMemberIds: () => api.get<{ data: { employeeIds: number[]; userIds: number[]; names: string[] } }>('/teams/my-team-members'),

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

  getDashboard: (id: number, filter: string = 'active') =>
    api.get<{ data: TeamDashboard }>(`/teams/${id}/dashboard`, { params: { filter } }),

  getOpportunities: (id: number, filter: string = 'active') =>
    api.get<{ data: TeamOpportunity[] }>(`/teams/${id}/opportunities`, { params: { filter } }),

  getCustomers: (id: number, filter: string = 'active') =>
    api.get<{ data: TeamCustomer[] }>(`/teams/${id}/customers`, { params: { filter } }),

  getEstimates: (id: number, filter: string = 'active') =>
    api.get<{ data: TeamEstimate[] }>(`/teams/${id}/estimates`, { params: { filter } }),

  getProjects: (id: number, filter: string = 'active') =>
    api.get<{ data: TeamProject[] }>(`/teams/${id}/projects`, { params: { filter } }),
};
