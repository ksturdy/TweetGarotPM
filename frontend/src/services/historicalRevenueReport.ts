import api from './api';

export type GroupByOption = 'market' | 'department' | 'pm' | 'customer';
export type MetricOption = 'contract_amount' | 'earned_revenue' | 'billed_amount';

export interface HistoricalRevenueTeam {
  id: number;
  name: string;
  color: string;
}

export interface HistoricalRevenueFilters {
  years: number[];
  markets: string[];
  departments: string[];
  pms: string[];
  customers: string[];
  teams: HistoricalRevenueTeam[];
}

export interface HistoricalRevenueRow {
  year: number;
  group_value: string;
  contract_amount: number;
  earned_revenue: number;
  billed_amount: number;
  contract_count: number;
}

export interface HistoricalRevenueData {
  generated_at: string;
  groupBy: GroupByOption;
  years: number[];
  groups: string[];
  data: HistoricalRevenueRow[];
  totals_by_year: Record<number, number>;
  grand_total: number;
  total_contracts: number;
}

export interface HistoricalRevenueParams {
  groupBy?: GroupByOption;
  startYear?: number;
  endYear?: number;
  markets?: string[];
  departments?: string[];
  pms?: string[];
  customers?: string[];
  teams?: number[];
}

const BASE = '/reports/historical-revenue';

export const historicalRevenueApi = {
  getFilters: () => api.get<HistoricalRevenueFilters>(`${BASE}/filters`),

  get: (p: HistoricalRevenueParams = {}) => {
    const qs: Record<string, string> = {};
    if (p.groupBy) qs.groupBy = p.groupBy;
    if (p.startYear != null) qs.startYear = String(p.startYear);
    if (p.endYear != null) qs.endYear = String(p.endYear);
    if (p.markets?.length) qs.markets = p.markets.join(',');
    if (p.departments?.length) qs.departments = p.departments.join(',');
    if (p.pms?.length) qs.pms = p.pms.join(',');
    if (p.customers?.length) qs.customers = p.customers.join(',');
    if (p.teams?.length) qs.teams = p.teams.join(',');
    return api.get<HistoricalRevenueData>(BASE, { params: qs });
  },
};
