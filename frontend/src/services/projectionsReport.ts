import api from './api';
import { ProjectionNote } from './projectionNotes';

export interface ProjectionsReportFilters {
  pms: { employee_no: string; name: string }[];
  departments: { code: string; name: string }[];
}

export interface SnapshotData {
  id: number;
  snapshot_date: string;
  orig_contract_amount: number | string | null;
  contract_amount: number | string | null;
  approved_changes: number | string | null;
  pending_change_orders: number | string | null;
  projected_revenue: number | string | null;
  earned_revenue: number | string | null;
  backlog: number | string | null;
  percent_complete: number | string | null;
  gross_profit_dollars: number | string | null;
  gross_profit_percent: number | string | null;
  billed_amount: number | string | null;
  received_amount: number | string | null;
  open_receivables: number | string | null;
  cash_flow: number | string | null;
  actual_cost: number | string | null;
  projected_cost: number | string | null;
  current_est_cost: number | string | null;
  actual_labor_rate: number | string | null;
  total_hours_jtd: number | string | null;
  total_hours_projected: number | string | null;
  pm_name: string | null;
  pm_employee_no: string | null;
  department_code: string | null;
  department_name: string | null;
}

export interface ProjectionDeltas {
  orig_contract_amount: number;
  contract_amount: number;
  approved_changes: number;
  pending_change_orders: number;
  projected_revenue: number;
  earned_revenue: number;
  backlog: number;
  percent_complete: number;
  gross_profit_dollars: number;
  gross_profit_percent: number;
  billed_amount: number;
  received_amount: number;
  open_receivables: number;
  cash_flow: number;
  projected_cost: number;
  current_est_cost: number;
  actual_cost: number;
  total_hours_jtd: number;
  total_hours_projected: number;
  actual_labor_rate: number;
}

export interface ProjectionProjectSection {
  project_id: number;
  project_number: string;
  project_name: string;
  pm_name: string | null;
  pm_employee_no: string | null;
  department_code: string | null;
  department_name: string | null;
  current_snapshot: SnapshotData;
  prior_snapshot: SnapshotData | null;
  deltas: ProjectionDeltas | null;
  notes: ProjectionNote[];
  tasks: ProjectionNote[];
  open_tasks: number;
  gain_fade: {
    items: ProjectionNote[];
    totals: {
      gain: number;
      fade: number;
      net: number;
      recognized: number;
      unrecognized: number;
    };
  };
}

export interface ProjectionRollupRow {
  key: string;
  name: string;
  code: string | null;
  project_count: number;
  revenue_delta: number;
  projected_cost_delta: number;
  gross_profit_delta: number;
  gross_profit_pct_delta: number;
  open_tasks: number;
  net_gain_fade: number;
  unrecognized_gain_fade: number;
}

export interface ProjectionsReport {
  generated_at: string;
  projects: ProjectionProjectSection[];
  rollup_by_pm: ProjectionRollupRow[];
  rollup_by_department: ProjectionRollupRow[];
}

export interface ProjectionsReportQuery {
  pm_employee_no?: string[];
  department_code?: string[];
  team_id?: number[];
  start_date?: string;
  end_date?: string;
}

export const projectionsReportApi = {
  getFilters: (teamIds?: number[]) =>
    api.get<ProjectionsReportFilters>('/reports/projections-report/filters', {
      params: teamIds && teamIds.length ? { team_id: teamIds.join(',') } : undefined,
    }),

  get: (query: ProjectionsReportQuery = {}) => {
    const params: any = {};
    if (query.pm_employee_no?.length) params.pm_employee_no = query.pm_employee_no.join(',');
    if (query.department_code?.length) params.department_code = query.department_code.join(',');
    if (query.team_id?.length) params.team_id = query.team_id.join(',');
    if (query.start_date) params.start_date = query.start_date;
    if (query.end_date) params.end_date = query.end_date;
    return api.get<ProjectionsReport>('/reports/projections-report', { params });
  },

  downloadPdf: async (query: ProjectionsReportQuery = {}) => {
    const params: any = {};
    if (query.pm_employee_no?.length) params.pm_employee_no = query.pm_employee_no.join(',');
    if (query.department_code?.length) params.department_code = query.department_code.join(',');
    if (query.team_id?.length) params.team_id = query.team_id.join(',');
    if (query.start_date) params.start_date = query.start_date;
    if (query.end_date) params.end_date = query.end_date;
    const res = await api.get('/reports/projections-report/pdf-download', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const cd = res.headers?.['content-disposition'] as string | undefined;
    const match = cd && /filename="?([^"]+)"?/.exec(cd);
    const filename = match ? match[1] : `Projections-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
