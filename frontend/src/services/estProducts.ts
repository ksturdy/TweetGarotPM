import api from './api';

// ==================== INTERFACES ====================

export interface EstProduct {
  id: number;
  tenant_id: number;
  product_id: string;
  group_name: string | null;
  manufacturer: string | null;
  product: string | null;
  description: string | null;
  size: string | null;
  size_normalized: string | null;
  material: string | null;
  spec: string | null;
  install_type: string | null;
  source_description: string | null;
  range: string | null;
  finish: string | null;
  cost: number | null;
  cost_factor: string | null;
  cost_unit: string | null;
  cost_date: string | null;
  cost_status: string | null;
  labor_time: number | null;
  labor_units: string | null;
  unit_type: string;
  import_batch_id: number | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface EstProductStats {
  total_products: number;
  products_with_cost: number;
  products_with_labor: number;
  products_with_both: number;
  last_import: string | null;
  groups: { group_name: string; count: number }[];
}

export interface EstProductSearchResult {
  items: EstProduct[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface EstProductSearchFilters {
  group?: string;
  material?: string;
  size?: string;
  installType?: string;
  manufacturer?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EstProductImportResult {
  message: string;
  mapProd: { total: number; new: number; updated: number };
  cost: { total: number; matched: number; unmatched: number };
  labor: { total: number; matched: number; unmatched: number };
  sheetsFound: string[];
  sheetsProcessed: string[];
  batch_id: number;
}

export interface EstImportBatch {
  id: number;
  tenant_id: number;
  file_name: string;
  file_type: string;
  records_total: number;
  records_new: number;
  records_updated: number;
  records_auto_matched: number;
  imported_by: number;
  imported_at: string;
  imported_by_name?: string;
}

// ==================== SERVICE ====================

export const estProductService = {
  getStats: async (): Promise<EstProductStats> => {
    const response = await api.get('/est-products/stats');
    return response.data;
  },

  getImportHistory: async (): Promise<EstImportBatch[]> => {
    const response = await api.get('/est-products/import/history');
    return response.data;
  },

  uploadEstProducts: async (file: File): Promise<EstProductImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/est-products/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000, // 10-minute timeout for large files (104K+ rows)
    });
    return response.data;
  },

  search: async (filters: EstProductSearchFilters): Promise<EstProductSearchResult> => {
    const params = new URLSearchParams();
    if (filters.group) params.append('group', filters.group);
    if (filters.material) params.append('material', filters.material);
    if (filters.size) params.append('size', filters.size);
    if (filters.installType) params.append('installType', filters.installType);
    if (filters.manufacturer) params.append('manufacturer', filters.manufacturer);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    const response = await api.get(`/est-products/search?${params.toString()}`);
    return response.data;
  },

  getGroups: async (): Promise<string[]> => {
    const response = await api.get('/est-products/groups');
    return response.data;
  },

  getMaterials: async (group?: string): Promise<string[]> => {
    const params = group ? `?group=${encodeURIComponent(group)}` : '';
    const response = await api.get(`/est-products/materials${params}`);
    return response.data;
  },

  getSizes: async (group?: string, material?: string): Promise<string[]> => {
    const params = new URLSearchParams();
    if (group) params.append('group', group);
    if (material) params.append('material', material);
    const qs = params.toString();
    const response = await api.get(`/est-products/sizes${qs ? '?' + qs : ''}`);
    return response.data;
  },

  getInstallTypes: async (group?: string): Promise<string[]> => {
    const params = group ? `?group=${encodeURIComponent(group)}` : '';
    const response = await api.get(`/est-products/install-types${params}`);
    return response.data;
  },

  getManufacturers: async (group?: string): Promise<string[]> => {
    const params = group ? `?group=${encodeURIComponent(group)}` : '';
    const response = await api.get(`/est-products/manufacturers${params}`);
    return response.data;
  },

  getById: async (id: number): Promise<EstProduct> => {
    const response = await api.get(`/est-products/${id}`);
    return response.data;
  },

  getSpecFilterOptions: async (filters?: {
    installType?: string;
    product?: string;
    material?: string;
  }): Promise<{
    installTypes: { value: string; count: number }[];
    materials: { value: string; count: number }[];
    specs: { value: string; count: number }[];
  }> => {
    const params = new URLSearchParams();
    if (filters?.installType) params.append('installType', filters.installType);
    if (filters?.product) params.append('product', filters.product);
    if (filters?.material) params.append('material', filters.material);
    const qs = params.toString();
    const response = await api.get(`/est-products/spec-filter-options${qs ? '?' + qs : ''}`);
    return response.data;
  },

  getRatesForSpec: async (filters: {
    installType?: string;
    material?: string;
    group?: string;
    manufacturer?: string;
    product?: string;
  }): Promise<{
    pipeRates: { size: string; size_normalized: string; labor_time: number; product_id: string; product: string; description: string; cost?: number | null }[];
    fittingProducts: { size: string; size_normalized: string; labor_time: number; product_id: string; product: string; description: string; group_name?: string; cost?: number | null }[];
    schedules: string[];
    summary: { total: number; perFt: number; perEach: number };
  }> => {
    const params = new URLSearchParams();
    if (filters.installType) params.append('installType', filters.installType);
    if (filters.material) params.append('material', filters.material);
    if (filters.group) params.append('group', filters.group);
    if (filters.manufacturer) params.append('manufacturer', filters.manufacturer);
    if (filters.product) params.append('product', filters.product);
    const response = await api.get(`/est-products/rates-for-spec?${params.toString()}`);
    return response.data;
  },
};
