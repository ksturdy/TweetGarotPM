import api from './api';

export interface EstimateLineItem {
  id?: number;
  estimate_id?: number;
  section_id?: number;
  item_order: number;
  item_type: string;
  description: string;
  specification?: string;
  notes?: string;
  quantity: number;
  unit?: string;
  labor_hours: number;
  labor_rate: number;
  labor_cost: number;
  labor_burden_percentage: number;
  labor_burden_amount: number;
  material_unit_cost: number;
  material_cost: number;
  material_waste_percentage: number;
  material_waste_amount: number;
  equipment_unit_cost: number;
  equipment_cost: number;
  subcontractor_name?: string;
  subcontractor_cost: number;
  rental_description?: string;
  rental_duration: number;
  rental_rate: number;
  rental_cost: number;
  total_cost: number;
}

export interface EstimateSection {
  id?: number;
  estimate_id?: number;
  section_name: string;
  section_order: number;
  description?: string;
  labor_cost?: number;
  material_cost?: number;
  equipment_cost?: number;
  subcontractor_cost?: number;
  rental_cost?: number;
  total_cost?: number;
  items?: EstimateLineItem[];
}

export interface Estimate {
  id?: number;
  estimate_number: string;
  project_name: string;
  customer_id: number | null;
  customer_name?: string;
  building_type?: string;
  square_footage?: number;
  location?: string;
  bid_date?: string;
  project_start_date?: string;
  project_duration?: number;
  estimator_id?: number;
  estimator_name?: string;
  status: string;
  labor_cost?: number;
  material_cost?: number;
  equipment_cost?: number;
  subcontractor_cost?: number;
  rental_cost?: number;
  subtotal?: number;
  overhead_percentage: number;
  overhead_amount?: number;
  profit_percentage: number;
  profit_amount?: number;
  contingency_percentage: number;
  contingency_amount?: number;
  bond_percentage: number;
  bond_amount?: number;
  total_cost?: number;
  scope_of_work?: string;
  exclusions?: string;
  assumptions?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  submitted_at?: string;
  approved_at?: string;
  created_by?: number;
  approved_by?: number;
  sections?: EstimateSection[];
}

export const estimatesApi = {
  getAll: (params?: { status?: string; estimator_id?: number; customer_id?: number; search?: string }) =>
    api.get('/estimates', { params }),

  getById: (id: number) => api.get(`/estimates/${id}`),

  getNextNumber: () => api.get('/estimates/next-number'),

  create: (data: Estimate) => api.post('/estimates', data),

  update: (id: number, data: Partial<Estimate>) => api.put(`/estimates/${id}`, data),

  updateStatus: (id: number, status: string) => api.patch(`/estimates/${id}/status`, { status }),

  delete: (id: number) => api.delete(`/estimates/${id}`),

  // Sections
  getSections: (estimateId: number) => api.get(`/estimates/${estimateId}/sections`),

  createSection: (estimateId: number, data: EstimateSection) =>
    api.post(`/estimates/${estimateId}/sections`, data),

  updateSection: (id: number, data: Partial<EstimateSection>) => api.put(`/estimates/sections/${id}`, data),

  deleteSection: (id: number) => api.delete(`/estimates/sections/${id}`),

  reorderSections: (estimateId: number, sectionOrders: { id: number; section_order: number }[]) =>
    api.patch(`/estimates/${estimateId}/sections/reorder`, { sectionOrders }),

  // Line items
  getItems: (estimateId: number) => api.get(`/estimates/${estimateId}/items`),

  getSectionItems: (sectionId: number) => api.get(`/estimates/sections/${sectionId}/items`),

  createItem: (estimateId: number, data: EstimateLineItem) => api.post(`/estimates/${estimateId}/items`, data),

  bulkCreateItems: (estimateId: number, items: EstimateLineItem[]) =>
    api.post(`/estimates/${estimateId}/items/bulk`, { items }),

  updateItem: (id: number, data: Partial<EstimateLineItem>) => api.put(`/estimates/items/${id}`, data),

  bulkUpdateItems: (estimateId: number, items: Partial<EstimateLineItem>[]) =>
    api.put(`/estimates/${estimateId}/items/bulk`, { items }),

  deleteItem: (id: number) => api.delete(`/estimates/items/${id}`),

  reorderItems: (sectionId: number, itemOrders: { id: number; item_order: number }[]) =>
    api.patch(`/estimates/sections/${sectionId}/items/reorder`, { itemOrders }),
};
