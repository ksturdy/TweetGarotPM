import api from './api';

const API = '/stratus';

export interface ProductionPhaseRow {
  phase_code: string;
  weld_inches_complete: number;
  shop_weld_inches: number;
  field_weld_inches: number;
  jtd_hours: number | null;
  jtd_cost: number | null;
  production_rate: number | null; // weld_inches_complete / jtd_hours
  // summary-only fields
  prior_rate?: number | null;
  rate_delta?: number | null;
  weld_inches_delta?: number | null;
}

export interface ProductionSnapshot {
  snapshot_date: string;
  hours_refreshed_at: string | null;
  phases: ProductionPhaseRow[];
}

export interface ProductionSummary {
  snapshot_date: string | null;
  hours_refreshed_at: string | null;
  phases: (ProductionPhaseRow & {
    prior_rate: number | null;
    rate_delta: number | null;
    weld_inches_delta: number | null;
  })[];
}

const stratusProductionService = {
  async getSnapshots(projectId: number | string): Promise<{ snapshots: ProductionSnapshot[] }> {
    const res = await api.get(`${API}/project/${projectId}/production/snapshots`);
    return res.data;
  },

  async getSummary(projectId: number | string): Promise<ProductionSummary> {
    const res = await api.get(`${API}/project/${projectId}/production/summary`);
    return res.data;
  },
};

export default stratusProductionService;
