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
  all_ids?: number[];  // all underlying vp_phase_codes IDs (when deduplicated across jobs)
}

export interface PhaseScheduleItem {
  id: number;
  project_id: number;
  tenant_id: number;
  name: string;
  phase_code_ids: number[];
  cost_types: number[];
  row_number: number;
  predecessor_id: number | null;
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

  downloadPdf: (projectId: number, view: 'grid' | 'gantt', mode?: 'cost' | 'qty', itemIds?: number[]) => {
    const params = new URLSearchParams({ view });
    if (mode) params.set('mode', mode);
    if (itemIds && itemIds.length > 0) params.set('itemIds', itemIds.join(','));
    return api.get(`/phase-schedule/project/${projectId}/pdf-download?${params}`, {
      responseType: 'blob',
    });
  },

  syncStratusQuantities: (projectId: number) =>
    api.post<StratusSyncResult>(`/phase-schedule/project/${projectId}/sync-stratus-quantities`),
};

export interface StratusSyncRowChange {
  id: number;
  name: string;
  quantity_uom: string;
  old_quantity: number;
  new_quantity: number;
  old_installed: number;
  new_installed: number;
}

export interface StratusSyncSkip {
  id: number;
  name: string;
  reason: string;
}

export interface StratusSyncResult {
  import_id: number | null;
  updated: StratusSyncRowChange[];
  skipped: StratusSyncSkip[];
  message?: string;
}
