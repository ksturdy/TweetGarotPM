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

export const dashboardApi = {
  getAttentionItems: async (scope: 'my' | 'team' | 'company' = 'my'): Promise<AttentionItem[]> => {
    const response = await api.get(`/dashboard/attention-items?scope=${scope}`);
    return response.data;
  },
};

export default dashboardApi;
