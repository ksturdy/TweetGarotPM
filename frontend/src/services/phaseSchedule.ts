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
  is_provisional?: boolean;
}

export interface LinkedGCActivity {
  activity_id: string;
  activity_name: string | null;
  wbs_code: string | null;
  start_date: string | null;
  finish_date: string | null;
  missing: boolean;
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
  manual_start_date: string | null;
  manual_end_date: string | null;
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
  billable_rate_id: number | null;
  sort_order: number;
  created_by: number;
  created_by_name: string;
  phase_code_display: string | null;
  created_at: string;
  updated_at: string;
  linked_gc_activities: LinkedGCActivity[];
  linked_resolved_count: number;
  active_gc_version_id: number | null;
  has_provisional: boolean;
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

  downloadPdf: (
    projectId: number,
    view: 'grid' | 'gantt',
    mode?: 'cost' | 'qty' | 'manpower' | 'billable',
    itemIds?: number[],
    groups?: string[],
    shift?: string,
  ) => {
    const params = new URLSearchParams({ view });
    if (mode)  params.set('mode', mode);
    if (shift) params.set('shift', shift);
    if (itemIds && itemIds.length > 0) params.set('itemIds', itemIds.join(','));
    if (groups  && groups.length  > 0) params.set('groups',  groups.join(','));
    return api.get(`/phase-schedule/project/${projectId}/pdf-download?${params}`, {
      responseType: 'blob',
    });
  },

  downloadExcel: (
    projectId: number,
    mode: 'cost' | 'qty' | 'manpower' | 'billable',
    itemIds?: number[],
    groups?: string[],
    shift?: string,
  ) => {
    const params = new URLSearchParams({ mode });
    if (shift) params.set('shift', shift);
    if (itemIds && itemIds.length > 0) params.set('itemIds', itemIds.join(','));
    if (groups  && groups.length  > 0) params.set('groups',  groups.join(','));
    return api.get(`/phase-schedule/project/${projectId}/excel-download?${params}`, {
      responseType: 'blob',
    });
  },

  syncStratusQuantities: (projectId: number) =>
    api.post<StratusSyncResult>(`/phase-schedule/project/${projectId}/sync-stratus-quantities`),

  listProvisional: (projectId: number) =>
    api.get<ProvisionalPhaseCode[]>(`/phase-schedule/project/${projectId}/provisional`),

  createProvisional: (projectId: number, data: ProvisionalPhaseCodeInput) =>
    api.post<ProvisionalPhaseCode>(`/phase-schedule/project/${projectId}/provisional`, data),

  bulkCreateProvisional: (projectId: number, rows: ProvisionalPhaseCodeInput[]) =>
    api.post<{ inserted: ProvisionalPhaseCode[]; skipped: number }>(
      `/phase-schedule/project/${projectId}/provisional/bulk`,
      { rows }
    ),

  updateProvisional: (id: number, data: Partial<ProvisionalPhaseCodeInput>) =>
    api.patch<ProvisionalPhaseCode>(`/phase-schedule/provisional/${id}`, data),

  deleteProvisional: (id: number) =>
    api.delete(`/phase-schedule/provisional/${id}`),

  reconcileProvisional: (provisionalId: number, realPhaseCodeId: number) =>
    api.post<{ provisional_id: number; real_id: number; schedule_items_updated: number }>(
      `/phase-schedule/provisional/${provisionalId}/reconcile`,
      { realPhaseCodeId }
    ),

  listReconciliations: (projectId: number) =>
    api.get<PendingReconciliation[]>(`/phase-schedule/project/${projectId}/reconciliations`),

  countReconciliations: (projectId: number) =>
    api.get<{ count: number }>(`/phase-schedule/project/${projectId}/reconciliations/count`),

  acceptReconciliation: (id: number) =>
    api.post<{ id: number; action: 'accepted'; phase_code_id: number }>(`/phase-schedule/reconciliations/${id}/accept`),

  rejectReconciliation: (id: number, notes?: string) =>
    api.post<{ id: number; action: 'rejected'; phase_code_id: number }>(
      `/phase-schedule/reconciliations/${id}/reject`,
      { notes }
    ),
};

export interface PhaseCodeSnapshot {
  contract?: string | null;
  job_description?: string | null;
  phase_description?: string | null;
  est_hours?: number;
  est_cost?: number;
  jtd_hours?: number;
  jtd_cost?: number;
  committed_cost?: number;
  projected_cost?: number;
  percent_complete?: number;
  prior_week_cost?: number;
}

export interface PendingReconciliation {
  id: number;
  provisional_phase_code_id: number;
  snapshot: PhaseCodeSnapshot;
  vista_import_batch_id: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  // current vp_phase_codes row (Vista's values after the import)
  phase_code_id: number;
  contract: string | null;
  job: string;
  job_description: string | null;
  cost_type: number;
  phase: string;
  phase_description: string | null;
  est_hours: number;
  est_cost: number;
  jtd_hours: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  percent_complete: number;
  is_provisional: boolean;
  linked_project_id: number;
}

export interface ProvisionalPhaseCodeInput {
  contract?: string;
  job: string;
  job_description?: string;
  cost_type: number;
  phase: string;
  phase_description?: string;
  est_hours?: number;
  est_cost?: number;
  provisional_notes?: string;
}

export interface ProvisionalPhaseCode extends PhaseCode {
  is_provisional: true;
  provisional_notes: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  reconciled_to_id: number | null;
  reconciled_at: string | null;
}

export interface StratusSyncRowChange {
  id: number;
  name: string;
  quantity_uom: string;
  uom_inferred: boolean;
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
