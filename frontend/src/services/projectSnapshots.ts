import api from './api';

export interface ProjectSnapshot {
  id: number;
  project_id: number;
  tenant_id: number;
  snapshot_date: string;

  // Contract Values
  orig_contract_amount?: number;
  contract_amount?: number;
  approved_changes?: number;
  pending_change_orders?: number;
  change_order_count?: number;

  // Revenue & Progress
  projected_revenue?: number;
  earned_revenue?: number;
  backlog?: number;
  percent_complete?: number;

  // Margin
  gross_profit_dollars?: number;
  gross_profit_percent?: number;
  original_estimated_margin?: number;
  original_estimated_margin_pct?: number;

  // Billing & AR
  billed_amount?: number;
  received_amount?: number;
  open_receivables?: number;
  cash_flow?: number;

  // Costs
  actual_cost?: number;
  projected_cost?: number;
  current_est_cost?: number;

  // Labor
  actual_labor_rate?: number;
  estimated_labor_rate?: number;
  current_est_labor_cost?: number;
  ttl_labor_projected?: number;

  // Material
  material_estimate?: number;
  material_jtd?: number;
  material_projected?: number;

  // Subcontracts
  subcontracts_estimate?: number;
  subcontracts_jtd?: number;
  subcontracts_projected?: number;

  // Rentals
  rentals_estimate?: number;
  rentals_jtd?: number;
  rentals_projected?: number;

  // MEP Equipment
  mep_equip_estimate?: number;
  mep_equip_jtd?: number;
  mep_equip_projected?: number;

  // Hours - Pipefitter
  pf_hours_estimate?: number;
  pf_hours_jtd?: number;
  pf_hours_projected?: number;

  // Hours - Sheet Metal
  sm_hours_estimate?: number;
  sm_hours_jtd?: number;
  sm_hours_projected?: number;

  // Hours - Plumbing
  pl_hours_estimate?: number;
  pl_hours_jtd?: number;
  pl_hours_projected?: number;

  // Hours - Total
  total_hours_estimate?: number;
  total_hours_jtd?: number;
  total_hours_projected?: number;

  // Metadata
  created_at: string;
  created_by?: number;
}

export const projectSnapshotsApi = {
  /**
   * Get all snapshots for a project
   */
  getAll: (projectId: number) =>
    api.get<ProjectSnapshot[]>(`/projects/${projectId}/snapshots`),

  /**
   * Create a new snapshot (manual capture)
   */
  create: (projectId: number, snapshotDate?: string) =>
    api.post<ProjectSnapshot>(`/projects/${projectId}/snapshots`, { snapshotDate }),

  /**
   * Get the latest snapshot for a project
   */
  getLatest: (projectId: number) =>
    api.get<ProjectSnapshot>(`/projects/${projectId}/snapshots/latest`),
};
