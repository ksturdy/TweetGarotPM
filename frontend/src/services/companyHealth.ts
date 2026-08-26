import api from './api';

export interface CompanyHealthKPIs {
  active_projects: number;
  total_backlog: number;
  backlog_6mo: number;
  backlog_12mo: number;
  total_contract_value: number;
  total_gross_profit: number;
  avg_gm_pct: number;
  total_cash_flow: number;
  total_pipeline_value: number;
  weighted_pipeline: number;
  total_opps_count: number;
}

export interface BacklogByMarket { market: string; backlog: number; }
export interface OppsByStage { stage_name: string; stage_color: string; count: number; total_value: number; weighted_value: number; }
export interface OppsByMarket { market: string; count: number; total_value: number; }
export interface ProjectStatusDist { status: string; count: number; }
export interface DeptBreakdown { group_name: string; project_count: number; backlog: number; gm_pct: number; gross_profit: number; }

export interface LaborSummary {
  total_employees: string;
  currently_assigned: string;
  upcoming_assignments: string;
  ending_within_two_weeks: string;
  unfilled_roles: string;
}

export interface LaborByMonth {
  month_key: string;
  month_label: string;
  month_offset: number;
  total_headcount: number;
}

export interface LaborByTrade {
  trade: string;
  h6: number;
  h12: number;
  h18: number;
}

export interface LaborByGroup {
  emp_group: string;
  h6: number;
  h12: number;
  h18: number;
}

export interface LaborForecast {
  by_month: LaborByMonth[];
  by_trade: LaborByTrade[];
  by_group: LaborByGroup[];
  horizons: { h6: number; h12: number; h18: number };
}

export interface CompanyHealthData {
  as_of: string | null;
  kpis: CompanyHealthKPIs;
  backlog_by_market: BacklogByMarket[];
  opps_by_stage: OppsByStage[];
  opps_by_market: OppsByMarket[];
  project_status_dist: ProjectStatusDist[];
  dept_breakdown: DeptBreakdown[];
  labor_summary: LaborSummary;
  labor_forecast: LaborForecast;
}

export interface CompanyHealthNarrative {
  overview: string;
  backlog: string;
  pipeline: string;
  financial: string;
  pmWorkload: string;
  labor: string;
}

export const companyHealthApi = {
  get: () => api.get<CompanyHealthData>('/reports/company-health'),

  generateNarrative: (payload: object) =>
    api.post<{ narrative: CompanyHealthNarrative; generatedAt: string }>(
      '/reports/company-health/narrative',
      payload
    ),

  downloadPdf: async () => {
    const response = await api.get('/reports/company-health/pdf-download', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Company-Health-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
