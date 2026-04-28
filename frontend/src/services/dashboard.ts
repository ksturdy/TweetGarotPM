import api from './api';

export interface AttentionItem {
  id: string;
  type: 'rfi' | 'submittal' | 'report';
  message: string;
  project: string;
  path: string;
  severity: 'high' | 'medium' | 'low';
  dueDate?: string;
  responsiblePerson?: string;
}

export interface ActivityItem {
  type: 'project' | 'opportunity' | 'estimate' | 'rfi' | 'submittal' | 'change_order' | 'daily_report';
  entityId: number;
  title: string;
  parentName: string | null;
  parentId: number | null;
  status: string | null;
  actorName: string | null;
  action: 'created' | 'updated';
  timestamp: string;
}

export const dashboardApi = {
  getAttentionItems: async (scope: 'my' | 'team' | 'company' = 'my'): Promise<AttentionItem[]> => {
    const response = await api.get(`/dashboard/attention-items?scope=${scope}`);
    return response.data;
  },

  getRecentActivity: async (limit: number = 30): Promise<ActivityItem[]> => {
    const response = await api.get(`/dashboard/recent-activity?limit=${limit}`);
    return response.data;
  },
};

export default dashboardApi;
