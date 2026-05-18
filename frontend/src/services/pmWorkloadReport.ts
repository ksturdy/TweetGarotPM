import api from './api';

export interface PMWorkloadContract {
  contractNumber: string;
  description: string | null;
  backlog: number;
  backlogHours: number;
  hoursOverEstimate: number;
  pctComplete: number;
}

export type WorkloadBucket = 'overloaded' | 'available' | 'sideways' | 'healthy';

export interface PMWorkloadRow {
  key: string;
  employeeId: number | null;
  pmName: string;
  departmentId: number | null;
  departmentName: string | null;
  linked: boolean;
  activeProjects: number;
  backlogDollars: number;
  backlogHours: number;
  hoursOverEstimate: number;
  projectsOverEstimate: number;
  pctOverEstimate: number;
  nearCompletionCount: number;
  nearCompletionRatio: number;
  weeksUntilFree: number | null;
  pfBacklogHours: number;
  smBacklogHours: number;
  bucket: WorkloadBucket;
  reasons: string[];
  contracts: PMWorkloadContract[];
}

export interface PMWorkloadThresholds {
  maxActiveProjects: number;
  maxBacklogHours: number;
  maxBacklogDollars: number;
  forecastCreepPct: number;
  hoursOverEstimateAbs: number;
  lowBacklogHours: number;
  nearCompletionPct: number;
  windingDownPct: number;
  availableWeeksHorizon: number;
}

export interface PMWorkloadFilterOption {
  id: number;
  name: string;
}

export interface PMWorkloadResponse {
  generatedAt: string;
  filters: {
    departmentId: number | null;
    teamId: number | null;
    applied: boolean;
  };
  filterOptions: {
    departments: PMWorkloadFilterOption[];
    teams: PMWorkloadFilterOption[];
  };
  thresholds: PMWorkloadThresholds;
  defaultThresholds: PMWorkloadThresholds;
  attention: {
    overloaded: PMWorkloadRow[];
    available: PMWorkloadRow[];
    sideways: PMWorkloadRow[];
  };
  pms: PMWorkloadRow[];
  unmatched: {
    contractCount: number;
    backlogHours: number;
  };
  meta: {
    totalContractsScanned: number;
    activeContractsCounted: number;
  };
}

export const pmWorkloadReportApi = {
  getReport: (filters: { departmentId?: number | null; teamId?: number | null } = {}) => {
    const params: Record<string, number> = {};
    if (filters.departmentId) params.departmentId = filters.departmentId;
    if (filters.teamId) params.teamId = filters.teamId;
    return api.get<PMWorkloadResponse>('/reports/pm-workload', { params });
  },
};

export interface PMWorkloadSavedThresholds {
  maxBacklogHours?: number;
  maxBacklogDollars?: number;
  lowBacklogHours?: number;
}

export const pmWorkloadSettingsApi = {
  get: () => api.get<PMWorkloadSavedThresholds | null>('/tenant/pm-workload-settings'),
  save: (settings: PMWorkloadSavedThresholds) =>
    api.put<PMWorkloadSavedThresholds>('/tenant/pm-workload-settings', settings),
};
