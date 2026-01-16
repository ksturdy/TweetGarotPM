import api from './api';

export interface ChangeOrder {
  id: number;
  project_id: number;
  number: number;
  title: string;
  description: string;
  reason: string;
  amount: number;
  days_added: number;
  status: string;
  rejection_reason: string | null;
  created_by: number;
  created_by_name: string;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ChangeOrderTotals {
  total_count: number;
  approved_count: number;
  approved_amount: number;
  approved_days: number;
}

export const changeOrdersApi = {
  getByProject: (projectId: number, filters?: { status?: string }) =>
    api.get<ChangeOrder[]>(`/change-orders/project/${projectId}`, { params: filters }),

  getTotals: (projectId: number) =>
    api.get<ChangeOrderTotals>(`/change-orders/project/${projectId}/totals`),

  getById: (id: number) => api.get<ChangeOrder>(`/change-orders/${id}`),

  create: (data: Partial<ChangeOrder>) => api.post<ChangeOrder>('/change-orders', data),

  update: (id: number, data: Partial<ChangeOrder>) =>
    api.put<ChangeOrder>(`/change-orders/${id}`, data),

  submit: (id: number) => api.post<ChangeOrder>(`/change-orders/${id}/submit`),

  approve: (id: number) => api.post<ChangeOrder>(`/change-orders/${id}/approve`),

  reject: (id: number, rejectionReason: string) =>
    api.post<ChangeOrder>(`/change-orders/${id}/reject`, { rejectionReason }),
};
