import api from './api';

export interface OfficeLocation {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  employee_count?: number;
  created_at: string;
  updated_at: string;
}

export interface OfficeLocationInput {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
}

export const officeLocationsApi = {
  getAll: () => api.get<{ data: OfficeLocation[] }>('/office-locations'),

  getById: (id: number) => api.get<{ data: OfficeLocation }>(`/office-locations/${id}`),

  create: (data: OfficeLocationInput) => {
    const payload = {
      name: data.name,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zipCode || null,
      phone: data.phone || null,
    };
    return api.post<{ data: OfficeLocation }>('/office-locations', payload);
  },

  update: (id: number, data: OfficeLocationInput) => {
    const payload = {
      name: data.name,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zipCode || null,
      phone: data.phone || null,
    };
    return api.put<{ data: OfficeLocation }>(`/office-locations/${id}`, payload);
  },

  delete: (id: number) => api.delete<{ message: string }>(`/office-locations/${id}`),
};
