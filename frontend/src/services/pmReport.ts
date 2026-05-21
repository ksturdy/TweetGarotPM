import api from './api';

export type HealthLevel = 'green' | 'yellow' | 'red';

export interface SnapshotSeriesPoint {
  date: string;
  projectedCost: number;
  grossProfitPct: number;
  backlog: number;
  earnedRevenue: number;
  cashFlow: number;
}

export interface SnapshotDelta {
  projectedCost: number | null;
  grossProfitPct: number | null;
  backlog: number | null;
  earnedRevenue: number | null;
  cashFlow: number | null;
}

export interface PMReportTrend {
  snapshotCount: number;
  latestDate: string;
  series: SnapshotSeriesPoint[];
  weekOverWeek: SnapshotDelta | null;
  fourWeek: {
    projectedCost: number | null;
    grossProfitPct: number | null;
    backlog: number | null;
  } | null;
}

export interface PMReportJob {
  contractNumber: string;
  description: string | null;
  customerName: string | null;
  projectId: number | null;
  projectNumber: string | null;
  projectName: string | null;
  status: string | null;
  departmentCode: string | null;

  contractAmount: number;
  origContractAmount: number;
  approvedChanges: number;
  pendingChangeOrders: number;
  projectedRevenue: number;
  earnedRevenue: number;
  billedAmount: number;
  receivedAmount: number;
  openReceivables: number;
  backlog: number;
  cashFlow: number;

  projectedCost: number;
  actualCost: number;
  currentEstCost: number;

  grossProfitDollars: number;
  grossProfitPercent: number;
  originalEstimatedMarginPct: number;

  totalHoursEstimate: number;
  totalHoursJtd: number;

  health: HealthLevel;
  healthScore: number;
  healthReasons: string[];
  pctComplete: number;
  overUnderBilled: number;
  costVariance: number;

  trend: PMReportTrend | null;
}

export interface PMReportTotals {
  activeJobs: number;
  contractAmount: number;
  projectedRevenue: number;
  earnedRevenue: number;
  projectedCost: number;
  estimatedCost: number;
  grossProfitDollars: number;
  backlog: number;
  billed: number;
  openReceivables: number;
  cashFlow: number;
  aggregateGrossProfitPct: number;
  aggregateCostVariance: number;
}

export interface PMReportRow {
  key: string;
  employeeId: number | null;
  pmName: string;
  departmentId: number | null;
  departmentName: string | null;
  linked: boolean;
  jobs: PMReportJob[];
  totals: PMReportTotals;
  healthCounts: { green: number; yellow: number; red: number };
  overallHealth: HealthLevel;
}

export interface PMReportResponse {
  generatedAt: string;
  pms: PMReportRow[];
  meta: {
    totalContractsScanned: number;
    activeJobsCounted: number;
    pmCount: number;
    projectsWithSnapshots: number;
  };
}

export interface PMSummaryResponse {
  summary: string;
  pmName: string;
  generatedAt: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface PMReportFilters {
  pm_keys?: string[];
  departments?: string[];
  health?: HealthLevel;
}

export const pmReportApi = {
  getReport: () => api.get<PMReportResponse>('/reports/pm-report'),
  generateSummary: (pm: PMReportRow) =>
    api.post<PMSummaryResponse>('/reports/pm-report/summary', { pm }),
  downloadPdf: async (filters: PMReportFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.pm_keys?.length) params.set('pm_keys', filters.pm_keys.join(','));
    if (filters.departments?.length) params.set('departments', filters.departments.join(','));
    if (filters.health) params.set('health', filters.health);
    const res = await api.get('/reports/pm-report/pdf-download', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project-Manager-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
