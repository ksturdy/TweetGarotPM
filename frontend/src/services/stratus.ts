import api from './api';

export interface StratusImport {
  id: number;
  tenant_id: number;
  project_id: number;
  filename: string | null;
  source_project_name: string | null;
  row_count: number;
  snapshot_at: string | null;
  imported_by: number | null;
  imported_by_name?: string | null;
  imported_at: string;
}

export interface StratusPart {
  id: number;
  stratus_part_id: string | null;
  cad_id: string | null;
  part_number: string | null;
  service_name: string | null;
  service_abbreviation: string | null;
  item_description: string | null;
  area: string | null;
  size: string | null;
  part_division: string | null;
  package_category: string | null;
  category: string | null;
  length: string | number | null;
  item_weight: string | number | null;
  install_hours: string | number | null;
  material_cost: string | number | null;
  install_cost: string | number | null;
  total_cost: string | number | null;
  part_tracking_status: string | null;
  part_field_phase_code: string | null;
  part_shop_phase_code: string | null;
  part_issue_to_shop_dt: string | null;
  part_shipped_dt: string | null;
  part_field_installed_dt: string | null;
  fab_complete_date: string | null;
  qaqc_complete_date: string | null;
  assembly_name: string | null;
}

export interface StratusSummaryRow {
  part_field_phase_code: string | null;
  part_tracking_status: string | null;
  part_count: number;
  total_hours: string | number;
  total_weight: string | number;
  total_length: string | number;
  total_cost: string | number;
}

export interface StratusFilterOptions {
  statuses: string[];
  phase_codes: string[];
  services: string[];
  areas: string[];
  sizes: string[];
  divisions: string[];
  package_categories: string[];
}

export interface StratusPartsResult {
  total: number;
  rows: StratusPart[];
  import_id: number | null;
  limit: number;
  offset: number;
}

export interface StratusPartFilters {
  status?: string;
  phase_code?: string;
  service?: string;
  area?: string;
  size?: string;
  division?: string;
  package_category?: string;
  search?: string;
}

const stratusService = {
  async uploadImport(projectId: number, file: File): Promise<{ import: StratusImport; sourceProjectName: string | null; rowCount: number }> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`/stratus/project/${projectId}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async listImports(projectId: number): Promise<StratusImport[]> {
    const res = await api.get(`/stratus/project/${projectId}/imports`);
    return res.data;
  },

  async getLatestImport(projectId: number): Promise<StratusImport | null> {
    const res = await api.get(`/stratus/project/${projectId}/latest`);
    return res.data;
  },

  async deleteImport(importId: number): Promise<void> {
    await api.delete(`/stratus/imports/${importId}`);
  },

  async listParts(
    projectId: number,
    opts: { importId?: number; limit?: number; offset?: number; filters?: StratusPartFilters } = {}
  ): Promise<StratusPartsResult> {
    const params: Record<string, string | number> = {};
    if (opts.importId) params.import_id = opts.importId;
    if (opts.limit) params.limit = opts.limit;
    if (opts.offset) params.offset = opts.offset;
    if (opts.filters) {
      Object.entries(opts.filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
    }
    const res = await api.get(`/stratus/project/${projectId}/parts`, { params });
    return res.data;
  },

  async getSummary(projectId: number, importId?: number): Promise<{ import_id: number | null; rows: StratusSummaryRow[] }> {
    const params: Record<string, number> = {};
    if (importId) params.import_id = importId;
    const res = await api.get(`/stratus/project/${projectId}/summary`, { params });
    return res.data;
  },

  async getFilterOptions(projectId: number, importId?: number): Promise<StratusFilterOptions> {
    const params: Record<string, number> = {};
    if (importId) params.import_id = importId;
    const res = await api.get(`/stratus/project/${projectId}/filter-options`, { params });
    return res.data;
  },
};

export default stratusService;
