import api from './api';

export interface Customer {
  id: number;
  customer_facility: string;
  customer_owner: string;
  account_manager: string;
  field_leads?: string;
  customer_number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  controls?: string;
  department?: string;
  customer_score?: number;
  active_customer: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerStats {
  total_customers: string;
  active_customers: string;
  unique_owners: string;
  account_managers: string;
  states_covered: string;
}

export const customersApi = {
  async getAll() {
    const response = await api.get<Customer[]>('/customers');
    return response.data;
  },

  async getById(id: number) {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  async search(query: string) {
    const response = await api.get<Customer[]>('/customers/search', {
      params: { q: query }
    });
    return response.data;
  },

  async getStats() {
    const response = await api.get<CustomerStats>('/customers/stats');
    return response.data;
  },

  async create(data: Partial<Customer>) {
    const response = await api.post<Customer>('/customers', data);
    return response.data;
  },

  async update(id: number, data: Partial<Customer>) {
    const response = await api.put<Customer>(`/customers/${id}`, data);
    return response.data;
  },

  async delete(id: number) {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  async deleteAll() {
    const response = await api.delete('/customers/all/delete');
    return response.data;
  },

  async importExcel(file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/customers/import/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  }
};
