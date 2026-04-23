import api from './api';

export interface RecurringSearch {
  id: number;
  name: string;
  description: string | null;
  criteria: {
    market_sector?: string;
    location?: string;
    construction_type?: string;
    min_value?: number;
    max_value?: number;
    keywords?: string;
    additional_criteria?: string;
  };
  is_active: boolean;
  created_by: number;
  created_by_name: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_result_count: number;
  last_result_value: number;
  last_results: any[] | null;
}

const recurringSearchesService = {
  async getAll(activeOnly = false): Promise<RecurringSearch[]> {
    const response = await api.get<RecurringSearch[]>('/opportunity-search/recurring', {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  async getById(id: number): Promise<RecurringSearch> {
    const response = await api.get<RecurringSearch>(`/opportunity-search/recurring/${id}`);
    return response.data;
  },

  async create(data: {
    name: string;
    description?: string;
    criteria: RecurringSearch['criteria'];
    is_active?: boolean;
  }): Promise<RecurringSearch> {
    const response = await api.post<RecurringSearch>('/opportunity-search/recurring', data);
    return response.data;
  },

  async createFromSaved(savedSearchId: number, data?: {
    name?: string;
    description?: string;
  }): Promise<RecurringSearch> {
    const response = await api.post<RecurringSearch>(
      `/opportunity-search/recurring/from-saved/${savedSearchId}`,
      data || {}
    );
    return response.data;
  },

  async update(id: number, data: Partial<{
    name: string;
    description: string;
    criteria: RecurringSearch['criteria'];
    is_active: boolean;
  }>): Promise<RecurringSearch> {
    const response = await api.put<RecurringSearch>(`/opportunity-search/recurring/${id}`, data);
    return response.data;
  },

  async toggleActive(id: number): Promise<RecurringSearch> {
    const response = await api.patch<RecurringSearch>(`/opportunity-search/recurring/${id}/toggle`);
    return response.data;
  },

  async updateResults(id: number, data: {
    resultCount: number;
    resultValue: number;
    results: any[];
  }): Promise<RecurringSearch> {
    const response = await api.patch<RecurringSearch>(`/opportunity-search/recurring/${id}/update-results`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/opportunity-search/recurring/${id}`);
  },

  async downloadPdf(id: number): Promise<void> {
    const response = await api.get(`/opportunity-search/recurring/${id}/pdf`, {
      responseType: 'blob',
    });

    const contentDisposition = response.headers['content-disposition'];
    let filename = `Recurring-Search-${new Date().toISOString().split('T')[0]}.pdf`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/"/g, '');
      }
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default recurringSearchesService;
