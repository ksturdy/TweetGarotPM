import api from './api';

// ─── Types ───

export interface PipeSpec {
  id: number;
  tenant_id: number;
  name: string;
  joint_method: 'BW' | 'GRV' | 'THD' | 'CU';
  material: string;
  schedule: string;
  stock_pipe_length: number;
  joint_type: string;
  pipe_material: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  // EST catalog filter selections
  est_install_type?: string | null;
  est_material?: string | null;
  est_filters?: Record<string, any> | null;
  // Populated when fetching by ID
  pipe_rates?: PipeSpecPipeRate[];
  fitting_rates?: PipeSpecFittingRate[];
  reducing_rates?: PipeSpecReducingRate[];
  reducing_tee_rates?: PipeSpecReducingTeeRate[];
  cross_reducing_rates?: PipeSpecCrossReducingRate[];
}

export interface PipeSpecPipeRate {
  id: number;
  pipe_spec_id: number;
  pipe_size: string;
  hours_per_foot: number;
}

export interface PipeSpecFittingRate {
  id: number;
  pipe_spec_id: number;
  fitting_type: string;
  pipe_size: string;
  hours_per_unit: number;
}

export interface PipeSpecReducingRate {
  id: number;
  pipe_spec_id: number;
  fitting_type: string;
  main_size: string;
  reducing_size: string;
  hours_per_unit: number;
}

export interface PipeSpecReducingTeeRate {
  id: number;
  pipe_spec_id: number;
  main_size: string;
  branch_size: string;
  hours_per_unit: number;
}

export interface PipeSpecCrossReducingRate {
  id: number;
  pipe_spec_id: number;
  main_size: string;
  reducing_size: string;
  hours_per_unit: number;
}

export interface RateLookupResult {
  found: boolean;
  hours_per_foot?: number;
  hours_per_unit?: number;
}

// ─── API ───

export const pipeSpecsApi = {
  // CRUD
  getAll: (opts?: { includeRates?: boolean }) =>
    api.get<PipeSpec[]>('/pipe-specs', { params: opts?.includeRates ? { include: 'rates' } : undefined }),
  getById: (id: number) => api.get<PipeSpec>(`/pipe-specs/${id}`),
  create: (data: Partial<PipeSpec>) => api.post<PipeSpec>('/pipe-specs', data),
  update: (id: number, data: Partial<PipeSpec>) => api.put<PipeSpec>(`/pipe-specs/${id}`, data),
  delete: (id: number) => api.delete(`/pipe-specs/${id}`),
  duplicate: (id: number, name: string) => api.post<PipeSpec>(`/pipe-specs/${id}/duplicate`, { name }),

  // Bulk rate updates
  updatePipeRates: (id: number, rates: { pipe_size: string; hours_per_foot: number }[]) =>
    api.put<PipeSpecPipeRate[]>(`/pipe-specs/${id}/pipe-rates`, { rates }),
  updateFittingRates: (id: number, rates: { fitting_type: string; pipe_size: string; hours_per_unit: number }[]) =>
    api.put<PipeSpecFittingRate[]>(`/pipe-specs/${id}/fitting-rates`, { rates }),
  updateReducingRates: (id: number, rates: { fitting_type: string; main_size: string; reducing_size: string; hours_per_unit: number }[]) =>
    api.put<PipeSpecReducingRate[]>(`/pipe-specs/${id}/reducing-rates`, { rates }),
  updateReducingTeeRates: (id: number, rates: { main_size: string; branch_size: string; hours_per_unit: number }[]) =>
    api.put<PipeSpecReducingTeeRate[]>(`/pipe-specs/${id}/reducing-tee-rates`, { rates }),
  updateCrossReducingRates: (id: number, rates: { main_size: string; reducing_size: string; hours_per_unit: number }[]) =>
    api.put<PipeSpecCrossReducingRate[]>(`/pipe-specs/${id}/cross-reducing-rates`, { rates }),

  // Rate lookups
  lookupPipeRate: (id: number, size: string) =>
    api.get<RateLookupResult>(`/pipe-specs/${id}/lookup/pipe`, { params: { size } }),
  lookupFittingRate: (id: number, type: string, size: string) =>
    api.get<RateLookupResult>(`/pipe-specs/${id}/lookup/fitting`, { params: { type, size } }),
  lookupReducingRate: (id: number, type: string, mainSize: string, reducingSize: string) =>
    api.get<RateLookupResult>(`/pipe-specs/${id}/lookup/reducing`, { params: { type, main_size: mainSize, reducing_size: reducingSize } }),
  lookupReducingTeeRate: (id: number, mainSize: string, branchSize: string) =>
    api.get<RateLookupResult>(`/pipe-specs/${id}/lookup/reducing-tee`, { params: { main_size: mainSize, branch_size: branchSize } }),
};
