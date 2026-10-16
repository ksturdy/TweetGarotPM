import api from './api';

export interface ScopeJobMapping {
  id: number;
  scope: 'HVAC' | 'Plumbing' | 'BAS';
  vista_job: string;
  cached_est_cost: number | null;
  historical_project_id?: number;
  live_project_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface VistaJobOption {
  job: string;
  job_description: string | null;
  total_est_cost: number;
}

export const scopeJobMappingsApi = {
  getForHistorical(id: number) {
    return api.get<{ mappings: ScopeJobMapping[] }>(`/scope-job-mappings/historical/${id}`);
  },

  getForProject(id: number) {
    return api.get<{ mappings: ScopeJobMapping[] }>(`/scope-job-mappings/project/${id}`);
  },

  saveForHistorical(id: number, scope: string, vista_job: string) {
    return api.put<{ mapping: ScopeJobMapping }>(`/scope-job-mappings/historical/${id}`, { scope, vista_job });
  },

  saveForProject(id: number, scope: string, vista_job: string) {
    return api.put<{ mapping: ScopeJobMapping }>(`/scope-job-mappings/project/${id}`, { scope, vista_job });
  },

  deleteMapping(mappingId: number) {
    return api.delete(`/scope-job-mappings/${mappingId}`);
  },

  // Search Vista jobs by contract number prefix (for historical projects)
  searchJobs(contractPrefix: string) {
    return api.get<VistaJobOption[]>(`/vista/phase-codes/search-jobs?contract_prefix=${encodeURIComponent(contractPrefix)}`);
  },

  // Get available subjobs for a live project (via linked_project_id)
  getProjectJobs(projectId: number) {
    return api.get<{ job: string; job_description: string | null }[]>(
      `/vista/phase-codes/project/${projectId}/jobs`
    );
  },

  // Validate a specific job number and get its total est_cost
  getJobTotal(jobNumber: string) {
    return api.get<{ job: string; total_est_cost: number }>(
      `/vista/phase-codes/job-total?job=${encodeURIComponent(jobNumber)}`
    );
  },
};
