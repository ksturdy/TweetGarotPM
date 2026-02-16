import api from './api';

// TypeScript Interfaces
export interface WeeklyGoalPlan {
  id: number;
  project_id: number;
  tenant_id: number;
  week_start_date: string;
  week_end_date: string;
  include_sunday: boolean;

  // Plumbing trade
  plumbing_foreman: string | null;
  plumbing_crew_size: number;
  plumbing_hours_per_day: number;
  plumbing_days_worked: number;
  plumbing_planned_hours: number;
  plumbing_actual_hours: number;

  // Piping trade
  piping_foreman: string | null;
  piping_crew_size: number;
  piping_hours_per_day: number;
  piping_days_worked: number;
  piping_planned_hours: number;
  piping_actual_hours: number;

  // Sheet Metal trade
  sheet_metal_foreman: string | null;
  sheet_metal_crew_size: number;
  sheet_metal_hours_per_day: number;
  sheet_metal_days_worked: number;
  sheet_metal_planned_hours: number;
  sheet_metal_actual_hours: number;

  // Metadata
  status: 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  task_count?: number;
  project_name?: string;
  project_number?: string;
}

export interface WeeklyGoalTask {
  id: number;
  weekly_goal_plan_id: number;
  tenant_id: number;
  trade: 'plumbing' | 'piping' | 'sheet_metal';
  task_date: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  status: 'complete' | 'incomplete';
  incomplete_reason: 'rescheduled' | 'weather' | 'materials' | 'equipment' | 'labor' | 'gc_delay' | 'other_trade' | 'other' | null;
  incomplete_notes: string | null;
  actual_hours: number;
  sort_order: number;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  week_start_date?: string;
  week_end_date?: string;
  project_id?: number;
}

export interface TradeSummary {
  planned_hours: number;
  actual_hours: number;
  variance: number;
  percent_complete: number;
}

export interface WeeklyGoalSummary {
  plumbing: TradeSummary;
  piping: TradeSummary;
  sheet_metal: TradeSummary;
  total: TradeSummary;
}

export interface DailyTradeActual {
  id: number;
  weekly_goal_plan_id: number;
  tenant_id: number;
  work_date: string;
  trade: 'plumbing' | 'piping' | 'sheet_metal';
  actual_crew_size: number;
  actual_hours_worked: number;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// API Service
export const weeklyGoalPlansApi = {
  // ========== WEEKLY GOAL PLANS ==========

  getByProject: (projectId: number, filters?: { startDate?: string; endDate?: string; status?: string }) =>
    api.get<WeeklyGoalPlan[]>(`/weekly-goal-plans/project/${projectId}`, { params: filters }),

  getById: (id: number) =>
    api.get<WeeklyGoalPlan>(`/weekly-goal-plans/${id}`),

  getSummary: (id: number) =>
    api.get<WeeklyGoalSummary>(`/weekly-goal-plans/${id}/summary`),

  create: (data: Partial<WeeklyGoalPlan>) =>
    api.post<WeeklyGoalPlan>('/weekly-goal-plans', data),

  update: (id: number, data: Partial<WeeklyGoalPlan>) =>
    api.put<WeeklyGoalPlan>(`/weekly-goal-plans/${id}`, data),

  delete: (id: number) =>
    api.delete(`/weekly-goal-plans/${id}`),

  // ========== WEEKLY GOAL TASKS ==========

  getTasks: (planId: number, filters?: { trade?: string; date?: string; status?: string }) =>
    api.get<WeeklyGoalTask[]>(`/weekly-goal-plans/${planId}/tasks`, { params: filters }),

  createTask: (planId: number, data: Partial<WeeklyGoalTask>) =>
    api.post<WeeklyGoalTask>(`/weekly-goal-plans/${planId}/tasks`, data),

  updateTask: (taskId: number, data: Partial<WeeklyGoalTask>) =>
    api.put<WeeklyGoalTask>(`/weekly-goal-plans/tasks/${taskId}`, data),

  updateTaskStatus: (taskId: number, status: string, incompleteReason?: string | null, incompleteNotes?: string | null) =>
    api.patch<WeeklyGoalTask>(`/weekly-goal-plans/tasks/${taskId}/status`, {
      status,
      incompleteReason: incompleteReason === null ? null : incompleteReason,
      incompleteNotes: incompleteNotes === null ? null : incompleteNotes
    }),

  deleteTask: (taskId: number) =>
    api.delete(`/weekly-goal-plans/tasks/${taskId}`),

  // ========== TASK MOVEMENT ==========

  moveTaskEarlier: (taskId: number) =>
    api.patch<WeeklyGoalTask>(`/weekly-goal-plans/tasks/${taskId}/move-earlier`),

  moveTaskLater: (taskId: number) =>
    api.patch<WeeklyGoalTask>(`/weekly-goal-plans/tasks/${taskId}/move-later`),

  moveTaskNextWeek: (taskId: number) =>
    api.patch<WeeklyGoalTask>(`/weekly-goal-plans/tasks/${taskId}/move-next-week`),

  // ========== DAILY TRADE ACTUALS ==========

  getDailyActuals: (planId: number) =>
    api.get<DailyTradeActual[]>(`/weekly-goal-plans/${planId}/daily-actuals`),

  saveDailyActuals: (planId: number, data: Partial<DailyTradeActual>) =>
    api.post<DailyTradeActual>(`/weekly-goal-plans/${planId}/daily-actuals`, data),
};

export default weeklyGoalPlansApi;
