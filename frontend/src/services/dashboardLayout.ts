import api from './api';
import { DashboardLayout } from '../components/dashboard/types';

interface SavedLayoutRow {
  layout_json: DashboardLayout;
  updated_at: string;
}

export const dashboardLayoutApi = {
  async get(): Promise<DashboardLayout | null> {
    const response = await api.get<SavedLayoutRow | null>('/dashboard-layout');
    return response.data?.layout_json || null;
  },

  async save(layout: DashboardLayout): Promise<DashboardLayout> {
    const response = await api.put<SavedLayoutRow>('/dashboard-layout', { layout });
    return response.data.layout_json;
  },

  async reset(): Promise<void> {
    await api.delete('/dashboard-layout');
  },
};

export default dashboardLayoutApi;
