import api from './api';

export interface FieldPurchaseOrder {
  id: number;
  project_id: number;
  project_name?: string;
  project_number?: string;
  tenant_id: number;
  number: number;
  vendor_id: number | null;
  vendor_name: string;
  vendor_contact: string;
  vendor_phone: string;
  vendor_email: string;
  description: string;
  delivery_date: string | null;
  delivery_location: string;
  shipping_method: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  shipping_cost: number;
  total: number;
  cost_code: string;
  phase_code: string;
  status: string;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  notes: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  items?: FieldPurchaseOrderItem[];
}

export interface FieldPurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  sort_order: number;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  quantity_received: number;
  received_date: string | null;
  received_by: number | null;
  received_by_name: string | null;
}

export interface FieldPurchaseOrderTotals {
  total_count: number;
  approved_count: number;
  total_amount: number;
  approved_amount: number;
}

/** Format FPO display number: ProjectNumber-FPO-Sequence-UserInitials */
export function formatFpoNumber(po: { project_number?: string; number: number; created_by_name?: string }): string {
  const initials = (po.created_by_name || '')
    .split(' ')
    .map(n => n.charAt(0).toUpperCase())
    .filter(Boolean)
    .join('');
  return `${po.project_number || ''}-FPO-${po.number}${initials ? '-' + initials : ''}`;
}

export const fieldPurchaseOrdersApi = {
  getByProject: (projectId: number, filters?: { status?: string }) =>
    api.get<FieldPurchaseOrder[]>(`/field-purchase-orders/project/${projectId}`, { params: filters }),

  getTotals: (projectId: number) =>
    api.get<FieldPurchaseOrderTotals>(`/field-purchase-orders/project/${projectId}/totals`),

  getById: (id: number) => api.get<FieldPurchaseOrder>(`/field-purchase-orders/${id}`),

  create: (data: Partial<FieldPurchaseOrder>) => api.post<FieldPurchaseOrder>('/field-purchase-orders', data),

  update: (id: number, data: Partial<FieldPurchaseOrder>) =>
    api.put<FieldPurchaseOrder>(`/field-purchase-orders/${id}`, data),

  submit: (id: number) => api.post<FieldPurchaseOrder>(`/field-purchase-orders/${id}/submit`),

  approve: (id: number) => api.post<FieldPurchaseOrder>(`/field-purchase-orders/${id}/approve`),

  delete: (id: number) => api.delete(`/field-purchase-orders/${id}`),

  addItem: (poId: number, data: Partial<FieldPurchaseOrderItem>) =>
    api.post<FieldPurchaseOrderItem>(`/field-purchase-orders/${poId}/items`, data),

  updateItem: (poId: number, itemId: number, data: Partial<FieldPurchaseOrderItem>) =>
    api.put<FieldPurchaseOrderItem>(`/field-purchase-orders/${poId}/items/${itemId}`, data),

  deleteItem: (poId: number, itemId: number) =>
    api.delete(`/field-purchase-orders/${poId}/items/${itemId}`),
};
