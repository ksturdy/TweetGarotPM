import api from './api';

// ─── Types ───

export interface RateTableColumn {
  id: number;
  rate_table_id: number;
  column_key: string;
  column_label: string;
  sort_order: number;
  rates: Record<string, number>;
}

export interface RateTable {
  id: number;
  tenant_id: number;
  name: string;
  category: string;
  notes: string;
  column_count?: number;
  columns?: RateTableColumn[];
  created_at: string;
  updated_at: string;
}

// ─── API ───

export const rateTablesApi = {
  getAll: () =>
    api.get<RateTable[]>('/rate-tables'),

  getById: (id: number) =>
    api.get<RateTable>(`/rate-tables/${id}`),

  create: (data: { name: string; category: string; notes?: string; columns?: Partial<RateTableColumn>[] }) =>
    api.post<RateTable>('/rate-tables', data),

  update: (id: number, data: { name?: string; category?: string; notes?: string }) =>
    api.put<RateTable>(`/rate-tables/${id}`, data),

  delete: (id: number) =>
    api.delete(`/rate-tables/${id}`),

  duplicate: (id: number, name: string) =>
    api.post<RateTable>(`/rate-tables/${id}/duplicate`, { name }),

  // Column endpoints
  updateColumn: (tableId: number, colId: number, data: Partial<RateTableColumn>) =>
    api.put<RateTableColumn>(`/rate-tables/${tableId}/columns/${colId}`, data),

  addColumns: (tableId: number, columns: Partial<RateTableColumn>[]) =>
    api.post<RateTableColumn[]>(`/rate-tables/${tableId}/columns`, { columns }),

  removeColumn: (tableId: number, colId: number) =>
    api.delete(`/rate-tables/${tableId}/columns/${colId}`),
};
