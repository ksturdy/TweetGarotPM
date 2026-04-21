import api from './api';

export interface BuyoutMetricProject {
  id: number;
  number: string;
  name: string;
  status: string;
  market?: string;
  manager_id?: number;
  manager_name?: string;
  department_number?: string;
  customer_name?: string;
  phase: string;
  phase_description: string;
  est_cost: number;
  jtd_cost: number;
  committed_cost: number;
  projected_cost: number;
  buyout_remaining: number;
  percent_complete: number | null;
}

export interface BuyoutMetricFilters {
  cost_types?: number[];
  min_percent_complete?: number;
  status?: string;
  pm?: string;
  department?: string;
  market?: string;
  search?: string;
  team?: string;
}

export const buyoutMetricReportApi = {
  getData: (filters: BuyoutMetricFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.cost_types && filters.cost_types.length > 0) {
      params.set('cost_types', filters.cost_types.join(','));
    }
    if (filters.min_percent_complete !== undefined) {
      params.set('min_percent_complete', String(filters.min_percent_complete));
    }
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.pm && filters.pm !== 'all') params.set('pm', filters.pm);
    if (filters.department && filters.department !== 'all') params.set('department', filters.department);
    if (filters.market && filters.market !== 'all') params.set('market', filters.market);
    if (filters.search) params.set('search', filters.search);
    if (filters.team && filters.team !== 'all') params.set('team', filters.team);

    return api.get<BuyoutMetricProject[]>('/reports/buyout-metric', { params }).then(res => res.data);
  },

  downloadPdf: async (filters: BuyoutMetricFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.cost_types && filters.cost_types.length > 0) {
      params.set('cost_types', filters.cost_types.join(','));
    }
    if (filters.min_percent_complete !== undefined) {
      params.set('min_percent_complete', String(filters.min_percent_complete));
    }
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.pm && filters.pm !== 'all') params.set('pm', filters.pm);
    if (filters.department && filters.department !== 'all') params.set('department', filters.department);
    if (filters.market && filters.market !== 'all') params.set('market', filters.market);
    if (filters.search) params.set('search', filters.search);
    if (filters.team && filters.team !== 'all') params.set('team', filters.team);

    const res = await api.get('/reports/buyout-metric/pdf-download', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Buyout-Metric-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
