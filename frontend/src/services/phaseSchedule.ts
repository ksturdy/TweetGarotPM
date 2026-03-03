import api from './api';

export interface PhaseCode {
  id: number;
  tenant_id: number;
  contract: string;
  job: string;
  job_description: string;
  cost_type: number;
  phase: string;
  phase_description: string;
  est_hours: number;
  est_cost: number;
  jtd_hours: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  percent_complete: number;
  linked_project_id: number;
}

export interface PhaseScheduleItem {
  id: number;
  project_id: number;
  tenant_id: number;
  name: string;
  phase_code_ids: number[];
  cost_types: number[];
  start_date: string | null;
  end_date: string | null;
  contour_type: string;
  use_manual_values: boolean;
  manual_monthly_values: Record<string, number> | null;
  total_est_cost: number;
  total_est_hours: number;
  total_jtd_cost: number;
  total_jtd_hours: number;
  total_projected_cost: number;
  percent_complete: number;
  quantity: number | null;
  quantity_uom: string | null;
  quantity_installed: number;
  use_manual_qty_values: boolean;
  manual_monthly_qty: Record<string, number> | null;
  sort_order: number;
  created_by: number;
  created_by_name: string;
  phase_code_display: string | null;
  created_at: string;
  updated_at: string;
}

export const phaseScheduleApi = {
  getPhaseCodesByProject: (projectId: number) =>
    api.get<PhaseCode[]>(`/phase-schedule/project/${projectId}/phase-codes`),

  getScheduleItems: (projectId: number) =>
    api.get<PhaseScheduleItem[]>(`/phase-schedule/project/${projectId}`),

  createItems: (data: { projectId: number; phaseCodeIds: number[]; groupBy?: string }) =>
    api.post<PhaseScheduleItem[]>('/phase-schedule', data),

  updateItem: (id: number, data: Partial<PhaseScheduleItem>) =>
    api.put<PhaseScheduleItem>(`/phase-schedule/${id}`, data),

  deleteItem: (id: number) =>
    api.delete(`/phase-schedule/${id}`),

  reorder: (projectId: number, itemIds: number[]) =>
    api.put(`/phase-schedule/project/${projectId}/reorder`, { itemIds }),
};
