import api from './api';

export interface ForecastDurationRule {
  minValue: number;
  maxValue: number;
  months: number;
  label: string;
}

export interface ForecastRules {
  pursuitRules: ForecastDurationRule[];
  workDurationRules: ForecastDurationRule[];
}

export interface TenantSettings {
  branding?: {
    logo_url?: string | null;
    primary_color?: string;
    company_name?: string;
  };
  notifications?: {
    email_enabled?: boolean;
    daily_digest?: boolean;
  };
  defaults?: {
    timezone?: string;
    date_format?: string;
  };
  forecastRules?: ForecastRules;
}

export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website?: string;
  settings: TenantSettings;
  plan_name: string;
  plan_display_name: string;
  plan_limits?: {
    max_users?: number;
    max_projects?: number;
    max_customers?: number;
    max_opportunities?: number;
    storage_gb?: number;
  };
  plan_features?: Record<string, boolean>;
  usage?: {
    users: number;
    projects: number;
    customers: number;
    opportunities: number;
  };
}

/**
 * Get current tenant info
 */
export const getTenant = async (): Promise<TenantInfo> => {
  const response = await api.get('/tenant');
  return response.data;
};

/**
 * Update tenant info
 */
export const updateTenant = async (data: Partial<TenantInfo>): Promise<TenantInfo> => {
  const response = await api.put('/tenant', data);
  return response.data;
};

/**
 * Update tenant settings
 */
export const updateTenantSettings = async (settings: TenantSettings): Promise<TenantInfo> => {
  const response = await api.patch('/tenant/settings', { settings });
  return response.data;
};

/**
 * Upload tenant logo
 */
export const uploadLogo = async (file: File): Promise<{ logoUrl: string; tenant: TenantInfo }> => {
  const formData = new FormData();
  formData.append('logo', file);

  const response = await api.post('/tenant/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Delete tenant logo
 */
export const deleteLogo = async (): Promise<{ message: string; tenant: TenantInfo }> => {
  const response = await api.delete('/tenant/logo');
  return response.data;
};

/**
 * Get forecast rules (global, tenant-wide)
 */
export const getForecastRules = async (): Promise<ForecastRules | null> => {
  const response = await api.get('/tenant/forecast-rules');
  return response.data;
};

/**
 * Save forecast rules (global, tenant-wide)
 */
export const saveForecastRules = async (rules: ForecastRules): Promise<ForecastRules> => {
  const response = await api.put('/tenant/forecast-rules', rules);
  return response.data;
};

/**
 * Get backlog fit analysis settings (global, tenant-wide)
 */
export interface RegionTarget {
  label: string;
  revenueTarget: number;
  laborTarget: number;
}

export interface BacklogFitSettings {
  capacityTarget: number;
  horizonMonths: number;
  comparisonMode: 'revenue' | 'labor';
  laborCapacityTarget: number;
  laborPctOfValue: number;
  avgLaborRate: number;
  hoursPerPersonPerMonth: number;
  regionTargets?: { [prefix: string]: RegionTarget };
}

export const getBacklogFitSettings = async (): Promise<BacklogFitSettings | null> => {
  const response = await api.get('/tenant/backlog-fit-settings');
  return response.data;
};

/**
 * Save backlog fit analysis settings (global, tenant-wide)
 */
export const saveBacklogFitSettings = async (settings: BacklogFitSettings): Promise<BacklogFitSettings> => {
  const response = await api.put('/tenant/backlog-fit-settings', settings);
  return response.data;
};

/**
 * Get tenant usage statistics
 */
export const getTenantUsage = async (): Promise<{
  usage: TenantInfo['usage'];
  limits: TenantInfo['plan_limits'];
  plan: { name: string; displayName: string };
}> => {
  const response = await api.get('/tenant/usage');
  return response.data;
};
