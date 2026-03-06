import api from './api';

export interface ExecutiveReportItem {
  rank: number;
  projectId: number;
  projectName: string;
  projectNumber: string;
  managerName: string;
  market: string;
  value: number;
  previousValue: number | null;
  change: number;
  changePercent: number;
}

export interface ExecutiveReportCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  formatType: 'currency' | 'percent' | 'number';
  items: ExecutiveReportItem[];
}

export interface ExecutiveReportSummary {
  totalProjects: number;
  totalContractValue: number;
  totalGrossProfit: number;
  avgGrossMarginPct: number;
  totalBacklog: number;
  totalEarnedRevenue: number;
}

export interface ExecutiveReportResponse {
  reportDate: string | null;
  previousDate: string | null;
  availableDates: string[];
  summary: ExecutiveReportSummary | null;
  categories: ExecutiveReportCategory[];
}

export const executiveReportApi = {
  getReport: (snapshotDate?: string) =>
    api.get<ExecutiveReportResponse>('/executive-report', {
      params: snapshotDate ? { snapshotDate } : undefined,
    }),
};
