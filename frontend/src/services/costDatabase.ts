import api from './api';

export interface CostDbFilters {
  status?: string[];
  department?: string[];
  market?: string[];
  manager_id?: number[];
  date_from?: string;
  date_to?: string;
  value_min?: number | null;
  value_max?: number | null;
  cost_type?: number;
  phase_prefix?: string;
  excluded_project_ids?: number[];
}

export interface CostDbFilterOptions {
  statuses: string[];
  departments: { number: string; name: string }[];
  markets: string[];
  managers: { id: number; name: string }[];
  valueRange: { min: number | null; max: number | null };
  dateRange: {
    minStart: string | null;
    maxStart: string | null;
    minEnd: string | null;
    maxEnd: string | null;
  };
}

export interface CostDbSummary {
  project_count: number;
  est_cost: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  est_hours: number;
  jtd_hours: number;
  contract_value_total: number;
}

export interface CostTypeRow {
  cost_type: number;
  project_count: number;
  phase_count: number;
  est_cost: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  est_hours: number;
  jtd_hours: number;
}

export interface PhaseRow {
  phase: string;
  cost_type: number;
  phase_description: string | null;
  project_count: number;
  est_cost: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  est_hours: number;
  jtd_hours: number;
  avg_percent_complete: number | null;
}

export interface PhaseProjectRow {
  project_id: number;
  number: string;
  name: string;
  status: string;
  department_number: string | null;
  department_name: string | null;
  market: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  cost_type: number;
  est_cost: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  est_hours: number;
  jtd_hours: number;
  percent_complete: number | null;
}

export interface ProjectRow {
  id: number;
  number: string;
  name: string;
  status: string;
  department_number: string | null;
  department_name: string | null;
  market: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  actual_cost: number | null;
  projected_cost: number | null;
  phase_est_cost: number;
  phase_jtd_cost: number;
}

function toParams(filters: CostDbFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (filters.status?.length) p.status = filters.status.join(',');
  if (filters.department?.length) p.department = filters.department.join(',');
  if (filters.market?.length) p.market = filters.market.join(',');
  if (filters.manager_id?.length) p.manager_id = filters.manager_id.join(',');
  if (filters.date_from) p.date_from = filters.date_from;
  if (filters.date_to) p.date_to = filters.date_to;
  if (filters.value_min != null) p.value_min = String(filters.value_min);
  if (filters.value_max != null) p.value_max = String(filters.value_max);
  if (filters.cost_type) p.cost_type = String(filters.cost_type);
  if (filters.phase_prefix) p.phase_prefix = filters.phase_prefix;
  if (filters.excluded_project_ids?.length) p.excluded_ids = filters.excluded_project_ids.join(',');
  return p;
}

export const costDatabaseService = {
  getFilters: () => api.get<CostDbFilterOptions>('/cost-database/filters').then(r => r.data),
  getSummary: (filters: CostDbFilters) =>
    api.get<CostDbSummary>('/cost-database/summary', { params: toParams(filters) }).then(r => r.data),
  getByCostType: (filters: CostDbFilters) =>
    api.get<CostTypeRow[]>('/cost-database/by-cost-type', { params: toParams(filters) }).then(r => r.data),
  getByPhase: (filters: CostDbFilters) =>
    api.get<PhaseRow[]>('/cost-database/by-phase', { params: toParams(filters) }).then(r => r.data),
  getPhaseProjects: (phase: string, filters: CostDbFilters) =>
    api.get<PhaseProjectRow[]>(`/cost-database/phase/${encodeURIComponent(phase)}/projects`, {
      params: toParams(filters),
    }).then(r => r.data),
  getProjects: (filters: CostDbFilters) =>
    api.get<ProjectRow[]>('/cost-database/projects', { params: toParams(filters) }).then(r => r.data),
};

export const COST_TYPE_LABELS: Record<number, string> = {
  1: 'Labor',
  2: 'Material',
  3: 'Subcontracts',
  4: 'Rentals',
  5: 'MEP Equipment',
  6: 'General Conditions',
};

// ============== Estimates types ==============

export interface EstDbFilters {
  status?: string[];
  estimator_id?: number[];
  market?: string[];
  date_from?: string;
  date_to?: string;
  value_min?: number | null;
  value_max?: number | null;
  excluded_estimate_ids?: number[];
}

export interface EstFilterOptions {
  statuses: string[];
  estimators: { id: number; name: string }[];
  markets: string[];
  valueRange: { min: number | null; max: number | null };
  dateRange: { minDate: string | null; maxDate: string | null };
}

export interface EstimateSummary {
  estimate_count: number;
  total_cost_sum: number;
  labor_cost: number;
  material_cost: number;
  equipment_cost: number;
  subcontractor_cost: number;
  rental_cost: number;
  est_hours: number;
}

export interface EstCostTypeRow {
  cost_type: number;
  estimate_count: number;
  est_cost: number;
  est_hours: number;
}

export interface EstSectionRow {
  section_name: string;
  estimate_count: number;
  labor_cost: number;
  material_cost: number;
  equipment_cost: number;
  subcontractor_cost: number;
  rental_cost: number;
  est_cost: number;
}

export interface EstimateListRow {
  id: number;
  estimate_number: string;
  project_name: string;
  customer_name: string | null;
  status: string;
  bid_date: string | null;
  total_cost: number;
  labor_cost: number;
  material_cost: number;
  equipment_cost: number;
  subcontractor_cost: number;
  rental_cost: number;
  estimator_name: string | null;
}

function toEstParams(filters: EstDbFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (filters.status?.length) p.status = filters.status.join(',');
  if (filters.estimator_id?.length) p.estimator_id = filters.estimator_id.join(',');
  if (filters.market?.length) p.market = filters.market.join(',');
  if (filters.date_from) p.date_from = filters.date_from;
  if (filters.date_to) p.date_to = filters.date_to;
  if (filters.value_min != null) p.value_min = String(filters.value_min);
  if (filters.value_max != null) p.value_max = String(filters.value_max);
  if (filters.excluded_estimate_ids?.length) p.excluded_ids = filters.excluded_estimate_ids.join(',');
  return p;
}

export const estimateDbService = {
  getFilters: () => api.get<EstFilterOptions>('/cost-database/estimates/filters').then(r => r.data),
  getSummary: (filters: EstDbFilters) =>
    api.get<EstimateSummary>('/cost-database/estimates/summary', { params: toEstParams(filters) }).then(r => r.data),
  getByCostType: (filters: EstDbFilters) =>
    api.get<EstCostTypeRow[]>('/cost-database/estimates/by-cost-type', { params: toEstParams(filters) }).then(r => r.data),
  getBySection: (filters: EstDbFilters) =>
    api.get<EstSectionRow[]>('/cost-database/estimates/by-section', { params: toEstParams(filters) }).then(r => r.data),
  getList: (filters: EstDbFilters) =>
    api.get<EstimateListRow[]>('/cost-database/estimates/list', { params: toEstParams(filters) }).then(r => r.data),
};
