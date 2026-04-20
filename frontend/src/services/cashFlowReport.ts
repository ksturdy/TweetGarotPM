import api from './api';

export interface CashFlowProject {
  id: number;
  number: string;
  name: string;
  status: string;
  market?: string;
  manager_id?: number;
  manager_name?: string;
  department_number?: string;
  department_name?: string;
  customer_name?: string;
  owner_name?: string;
  contract_value?: number;
  orig_contract_amount?: number;
  earned_revenue?: number;
  billed_amount?: number;
  received_amount?: number;
  open_receivables?: number;
  cash_flow?: number;
  actual_cost?: number;
  projected_cost?: number;
  projected_revenue?: number;
  gross_profit_percent?: number;
  gross_profit_dollars?: number;
  backlog?: number;
  pending_change_orders?: number;
  approved_changes?: number;
  change_order_count?: number;
  percent_complete?: number;
}

export interface CashFlowMetrics {
  avg_pct_at_first_positive: number;
  projects_that_turned_positive: number;
  per_project: {
    project_id: number;
    first_positive_date: string;
    percent_complete_at_positive: number;
  }[];
}

export interface CashFlowPdfFilters {
  status?: string;
  pm?: string;
  department?: string;
  market?: string;
  search?: string;
  team?: string;
  scheduleName?: string;
}

export const cashFlowReportApi = {
  getData: () =>
    api.get<CashFlowProject[]>('/reports/cash-flow').then(res => res.data),
  getMetrics: () =>
    api.get<CashFlowMetrics>('/reports/cash-flow/metrics').then(res => res.data),
  downloadPdf: async (filters: CashFlowPdfFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v);
    });
    const res = await api.get('/reports/cash-flow/pdf-download', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cash-Flow-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
