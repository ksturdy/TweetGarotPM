import api from './api';

export interface ProjectGoals {
  id: number;
  project_id: number;
  tenant_id: number;
  cash_flow_goal_pct: number | null;
  margin_goal_pct: number | null;
  shop_hours_goal_pct: number | null;
  labor_rate_goal: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectGoalsInput {
  cash_flow_goal_pct?: number | null;
  margin_goal_pct?: number | null;
  shop_hours_goal_pct?: number | null;
  labor_rate_goal?: number | null;
}

export const projectGoalsApi = {
  getByProject: async (projectId: number): Promise<ProjectGoals | null> => {
    const response = await api.get(`/projects/${projectId}/goals`);
    return response.data;
  },

  save: async (projectId: number, data: ProjectGoalsInput): Promise<ProjectGoals> => {
    const response = await api.put(`/projects/${projectId}/goals`, data);
    return response.data;
  },

  clear: async (projectId: number): Promise<void> => {
    await api.delete(`/projects/${projectId}/goals`);
  },
};
