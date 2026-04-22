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
  projected_revenue?: number;
  projected_cost?: number;
  actual_cost?: number;
  percent_complete?: number;
  customer_id?: number;
  customer_name?: string;
  owner_customer_id?: number;
  owner_name?: string;
  ship_address?: string;
  ship_city?: string;
  ship_state?: string;
  ship_zip?: string;
  email_distribution_list?: string;
  override_original_estimated_margin?: number | null;
  override_original_estimated_margin_pct?: number | null;
  created_at: string;
  // Note: favorite is now managed per-user via favoritesService
  isFavorited?: boolean; // Runtime property added by UI
}

export interface MapProject {
  id: number;
  name: string;
  number: string;
  status: string;
  market?: string;
  latitude: number;
  longitude: number;
  address?: string;
  start_date?: string;
  manager_name?: string;
  customer_name?: string;
  contract_value?: number;
  ship_city?: string;
  ship_state?: string;
  department_name?: string;
}

export interface GeocodeResult {
  status: 'started' | 'running' | 'complete';
  running?: boolean;
  total: number;
  geocoded: number;
  failed: number;
}

export const projectsApi = {
  getAll: (filters?: { status?: string; managerId?: number }) =>
    api.get<Project[]>('/projects', { params: filters }),

  getById: (id: number) => api.get<Project>(`/projects/${id}`),

  create: (data: Partial<Project>) => api.post<Project>('/projects', data),

  update: (id: number, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data),

  delete: (id: number) => api.delete(`/projects/${id}`),

  // Map locations
  getMapLocations: (filters?: { status?: string; managerId?: number }) =>
    api.get<MapProject[]>('/projects/map-locations', { params: filters }),

  geocodeProjects: (force?: boolean) =>
    api.post<GeocodeResult>(`/projects/geocode${force ? '?force=true' : ''}`),

  geocodeStatus: () =>
    api.get<GeocodeResult>('/projects/geocode/status'),

  downloadLocationsPdf: async (options: {
    status?: string;
    markets?: string[];
    manager?: string;
    customer?: string;
    dateFrom?: string;
    dateTo?: string;
    mapImage?: string;
    includeList?: boolean;
  } = {}) => {
    const res = await api.post('/projects/map-locations/pdf', options, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Project-Locations-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadComparisonPdf: async (options: {
    customers: string[];
    customerColors: Record<string, string>;
    status?: string;
    markets?: string[];
    department?: string;
    dateFrom?: string;
    dateTo?: string;
    mapImage?: string;
    includeList?: boolean;
  } = { customers: [], customerColors: {} }) => {
    const res = await api.post('/projects/map-locations/comparison-pdf', options, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Customer-Comparison-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Use the new per-user favorites system
  toggleFavorite: (id: number) => favoritesService.toggle('project', id),
};
