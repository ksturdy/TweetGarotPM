import api from './api';

export interface Takeoff {
  id: number;
  tenant_id: number;
  takeoff_number: string;
  name: string;
  description: string;
  estimate_id: number | null;
  pipe_spec_id: number | null;
  takeoff_type: 'manual' | 'traceover';
  performance_factor: number;
  total_base_hours: number;
  total_adjusted_hours: number;
  total_material_cost: number;
  total_items: number;
  status: string;
  notes: string;
  created_by: number;
  created_by_name?: string;
  estimator_id: number | null;
  estimator_name?: string;
  estimate_number?: string;
  estimate_project_name?: string;
  created_at: string;
  updated_at: string;
  items?: TakeoffItem[];
}

export interface TakeoffItem {
  id?: number;
  takeoff_id: number;
  sort_order: number;
  fitting_type: string;
  size: string;
  join_type: string;
  quantity: number;
  base_hours_per_unit: number;
  base_hours_total: number;
  adjusted_hours: number;
  material_unit_cost: number;
  material_cost: number;
  remarks: string;
}

export interface ProductivityRateLookup {
  hours_per_unit: number;
  unit: string;
  found: boolean;
}

export const takeoffsApi = {
  getAll: (params?: { status?: string; search?: string; estimate_id?: number }) =>
    api.get('/takeoffs', { params }),
  getById: (id: number) => api.get(`/takeoffs/${id}`),
  getNextNumber: () => api.get('/takeoffs/next-number'),
  create: (data: Partial<Takeoff>) => api.post('/takeoffs', data),
  update: (id: number, data: Partial<Takeoff>) => api.put(`/takeoffs/${id}`, data),
  updateStatus: (id: number, status: string) => api.patch(`/takeoffs/${id}/status`, { status }),
  delete: (id: number) => api.delete(`/takeoffs/${id}`),
  recalculate: (id: number) => api.post(`/takeoffs/${id}/recalculate`),

  // Items
  getItems: (takeoffId: number) => api.get(`/takeoffs/${takeoffId}/items`),
  addItem: (takeoffId: number, data: Partial<TakeoffItem>) =>
    api.post(`/takeoffs/${takeoffId}/items`, data),
  updateItem: (takeoffId: number, itemId: number, data: Partial<TakeoffItem>) =>
    api.put(`/takeoffs/${takeoffId}/items/${itemId}`, data),
  deleteItem: (takeoffId: number, itemId: number) =>
    api.delete(`/takeoffs/${takeoffId}/items/${itemId}`),

  // Productivity rate lookup
  lookupRate: (fittingType: string, joinType: string | null, pipeDiameter: string) =>
    api.get<ProductivityRateLookup>('/takeoffs/productivity-rates/lookup', {
      params: { fitting_type: fittingType, join_type: joinType || undefined, pipe_diameter: pipeDiameter },
    }),
};
