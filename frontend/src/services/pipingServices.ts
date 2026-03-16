import api from './api';

// ─── Types ───

export interface PipingService {
  id: number;
  tenant_id: number;
  name: string;
  abbreviation: string;
  color: string;
  service_category: string;
  default_pipe_spec_id: number | null;
  fitting_types: string[];
  valve_types: string[];
  accessories: string[];
  created_at: string;
  updated_at: string;
  size_rules?: ServiceSizeRule[];
}

export interface ServiceSizeRule {
  id: number;
  piping_service_id: number;
  max_size_inches: number;
  pipe_spec_id: number;
  pipe_spec_name?: string;
  sort_order: number;
}

export interface ProjectSystem {
  id: number;
  tenant_id: number;
  takeoff_id: number;
  name: string;
  abbreviation: string;
  piping_service_id: number | null;
  color: string;
  service_name?: string;
  service_abbreviation?: string;
  service_category?: string;
  created_at: string;
  updated_at: string;
}

// ─── Service Category Presets ───

export const SERVICE_CATEGORY_PRESETS: Record<string, { name: string; abbreviation: string; color: string }> = {
  heating_water: { name: 'Heating Water', abbreviation: 'HW', color: '#ef4444' },
  chilled_water: { name: 'Chilled Water', abbreviation: 'CHW', color: '#06b6d4' },
  condenser_water: { name: 'Condenser Water', abbreviation: 'CW', color: '#14b8a6' },
  refrigerant_liquid: { name: 'Refrigerant Liquid', abbreviation: 'RL', color: '#ec4899' },
  refrigerant_suction: { name: 'Refrigerant Suction', abbreviation: 'RS', color: '#f472b6' },
  refrigerant_hot_gas: { name: 'Refrigerant Hot Gas', abbreviation: 'RHG', color: '#f97316' },
  condensate: { name: 'Condensate', abbreviation: 'COND', color: '#84cc16' },
  steam: { name: 'Steam', abbreviation: 'STM', color: '#f97316' },
  natural_gas: { name: 'Natural Gas', abbreviation: 'NG', color: '#eab308' },
  fuel_oil: { name: 'Fuel Oil', abbreviation: 'FO', color: '#a3a3a3' },
  domestic_hot: { name: 'Domestic Hot Water', abbreviation: 'DHW', color: '#dc2626' },
  domestic_cold: { name: 'Domestic Cold Water', abbreviation: 'DCW', color: '#2563eb' },
  other: { name: 'Other', abbreviation: 'OTH', color: '#10b981' },
};

// ─── Piping Services API ───

export const pipingServicesApi = {
  // CRUD
  getAll: () => api.get<PipingService[]>('/piping-services'),
  getById: (id: number) => api.get<PipingService>(`/piping-services/${id}`),
  create: (data: Partial<PipingService>) => api.post<PipingService>('/piping-services', data),
  update: (id: number, data: Partial<PipingService>) => api.put<PipingService>(`/piping-services/${id}`, data),
  delete: (id: number) => api.delete(`/piping-services/${id}`),

  // Size rules
  addSizeRule: (serviceId: number, rule: { max_size_inches: number; pipe_spec_id: number }) =>
    api.post<ServiceSizeRule>(`/piping-services/${serviceId}/size-rules`, rule),
  updateSizeRule: (serviceId: number, ruleId: number, data: Partial<ServiceSizeRule>) =>
    api.put<ServiceSizeRule>(`/piping-services/${serviceId}/size-rules/${ruleId}`, data),
  deleteSizeRule: (serviceId: number, ruleId: number) =>
    api.delete(`/piping-services/${serviceId}/size-rules/${ruleId}`),

  // Resolve spec for size
  resolveSpec: (serviceId: number, sizeInches: number) =>
    api.get<{ pipe_spec_id: number | null }>(`/piping-services/${serviceId}/resolve-spec`, { params: { size_inches: sizeInches } }),
};

// ─── Project Systems API (mounted under takeoffs) ───

export const projectSystemsApi = {
  getByTakeoff: (takeoffId: number) =>
    api.get<ProjectSystem[]>(`/takeoffs/${takeoffId}/systems`),
  create: (takeoffId: number, data: Partial<ProjectSystem>) =>
    api.post<ProjectSystem>(`/takeoffs/${takeoffId}/systems`, data),
  update: (takeoffId: number, systemId: number, data: Partial<ProjectSystem>) =>
    api.put<ProjectSystem>(`/takeoffs/${takeoffId}/systems/${systemId}`, data),
  delete: (takeoffId: number, systemId: number) =>
    api.delete(`/takeoffs/${takeoffId}/systems/${systemId}`),
};
