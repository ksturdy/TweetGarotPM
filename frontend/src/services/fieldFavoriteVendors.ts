import api from './api';

export interface FieldFavoriteVendor {
  id: number;
  tenant_id: number;
  name: string;
  location: string;
  phone: string;
  contact_name: string;
  email: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export const fieldFavoriteVendorsApi = {
  getAll: () => api.get<FieldFavoriteVendor[]>('/field-favorite-vendors'),

  create: (data: Partial<FieldFavoriteVendor>) =>
    api.post<FieldFavoriteVendor>('/field-favorite-vendors', data),

  update: (id: number, data: Partial<FieldFavoriteVendor>) =>
    api.put<FieldFavoriteVendor>(`/field-favorite-vendors/${id}`, data),

  delete: (id: number) => api.delete(`/field-favorite-vendors/${id}`),
};
