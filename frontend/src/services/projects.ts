import api from './api';
import { favoritesService } from './favorites';

export interface Project {
  id: number;
  name: string;
  number: string;
  client: string;
  address: string;
  start_date: string;
  end_date: string;
  status: string;
  description: string;
  market?: string;
  manager_id: number;
  manager_name: string;
  department_id?: number;
  department_name?: string;
  department_number?: string;
  contract_value?: number;
  gross_margin_percent?: number;
  backlog?: number;
  customer_id?: number;
  customer_name?: string;
  owner_customer_id?: number;
  owner_name?: string;
  ship_address?: string;
  ship_city?: string;
  ship_state?: string;
  ship_zip?: string;
  email_distribution_list?: string;
  created_at: string;
  // Note: favorite is now managed per-user via favoritesService
  isFavorited?: boolean; // Runtime property added by UI
}

export const projectsApi = {
  getAll: (filters?: { status?: string; managerId?: number }) =>
    api.get<Project[]>('/projects', { params: filters }),

  getById: (id: number) => api.get<Project>(`/projects/${id}`),

  create: (data: Partial<Project>) => api.post<Project>('/projects', data),

  update: (id: number, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data),

  delete: (id: number) => api.delete(`/projects/${id}`),

  // Use the new per-user favorites system
  toggleFavorite: (id: number) => favoritesService.toggle('project', id),
};
