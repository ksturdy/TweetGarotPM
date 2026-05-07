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

export type MaterialType =
  | 'pipe' | 'pipe_fitting' | 'weld' | 'valve' | 'coupling' | 'hanger'
  | 'equipment' | 'duct' | 'duct_accessory' | 'other';

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
  service_type: string | null;
  cut_type: string | null;
  service_group: string | null;
  material_type: MaterialType | null;
  material_type_auto: MaterialType | null;
  material_type_override: MaterialType | null;
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

export interface PipeLengthRow {
  part_field_phase_code: string | null;
  pipe_count: number;
  total_length: string | number;
  installed_length: string | number;
  total_hours: string | number;
  installed_hours: string | number;
  total_cost: string | number;
  installed_cost: string | number;
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
  service_types: string[];
  material_types: string[];
}

export interface StratusPartsResult {
  total: number;
  rows: StratusPart[];
  import_id: number | null;
  limit: number;
  offset: number;
}

// Each filter is a list — empty array means "no constraint". `search` is a free-text contains match.
export interface StratusPartFilters {
  status?: string[];
  phase_code?: string[];
  service?: string[];
  area?: string[];
  size?: string[];
  division?: string[];
  package_category?: string[];
  service_type?: string[];
  material_type?: string[];
  search?: string;
}

function appendFilters(params: Record<string, string | number>, filters: StratusPartFilters) {
  Object.entries(filters).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      if (v.length > 0) params[k] = v.join(',');
    } else if (v) {
      params[k] = v as string;
    }
  });
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
    if (opts.filters) appendFilters(params, opts.filters);
    const res = await api.get(`/stratus/project/${projectId}/parts`, { params });
    return res.data;
  },

  async getPipeLengthSummary(
    projectId: number,
    opts: { importId?: number; installedStatuses?: string[]; filters?: StratusPartFilters } = {}
  ): Promise<{ import_id: number | null; installed_statuses: string[]; rows: PipeLengthRow[] }> {
    const params: Record<string, string | number> = {};
    if (opts.importId) params.import_id = opts.importId;
    if (opts.installedStatuses && opts.installedStatuses.length > 0) {
      params.installed_statuses = opts.installedStatuses.join(',');
    }
    if (opts.filters) appendFilters(params, opts.filters);
    const res = await api.get(`/stratus/project/${projectId}/pipe-length`, { params });
    return res.data;
  },

  async setMaterialTypeOverride(partId: number, materialType: MaterialType | null): Promise<StratusPart> {
    const res = await api.put(`/stratus/parts/${partId}/material-type-override`, { material_type: materialType });
    return res.data;
  },

  async getSummary(
    projectId: number,
    opts: { importId?: number; filters?: StratusPartFilters } = {}
  ): Promise<{ import_id: number | null; rows: StratusSummaryRow[] }> {
    const params: Record<string, string | number> = {};
    if (opts.importId) params.import_id = opts.importId;
    if (opts.filters) appendFilters(params, opts.filters);
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
