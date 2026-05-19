import api from './api';
import { DashboardLayout, ViewScope } from '../components/dashboard/types';

interface SavedLayoutRow {
  layout_json: DashboardLayout;
  default_view_scope: ViewScope | null;
  updated_at: string;
}

export interface DashboardSettings {
  layout: DashboardLayout | null;
  defaultViewScope: ViewScope | null;
}

export const dashboardLayoutApi = {
  async get(): Promise<DashboardSettings> {
    const response = await api.get<SavedLayoutRow | null>('/dashboard-layout');
    return {
      layout: response.data?.layout_json || null,
      defaultViewScope: response.data?.default_view_scope ?? null,
    };
  },

  async save(layout: DashboardLayout, defaultViewScope: ViewScope | null): Promise<DashboardSettings> {
    const response = await api.put<SavedLayoutRow>('/dashboard-layout', { layout, defaultViewScope });
    return {
      layout: response.data.layout_json,
      defaultViewScope: response.data.default_view_scope ?? null,
    };
  },

  async reset(): Promise<void> {
    await api.delete('/dashboard-layout');
  },
};

export default dashboardLayoutApi;
