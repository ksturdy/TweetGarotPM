import api from './api';

export interface SearchCriteria {
  market_sector?: string;
  location?: string;
  construction_type?: string;
  min_value?: number;
  max_value?: number;
  keywords?: string;
  additional_criteria?: string;
}

export interface GeneratedLead {
  id: number;
  company_name: string;
  project_name: string;
  project_description: string;
  estimated_value: number;
  estimated_total_project_value: number;
  value_is_estimated: boolean;
  contact_name: string | null;
  contact_title: string;
  contact_email: string | null;
  contact_phone: string | null;
  location: string;
  construction_type: string;
  market_sector: string;
  project_phase: string | null;
  general_contractor: string;
  estimated_start_date: string;
  mechanical_scope: string;
  square_footage: string;
  intelligence_source: string;
  next_steps: string;
  source_url: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_explanation: string;
  timeline: string;
  verification_status: 'verifiable' | 'unverified' | 'suspect';
  verification_flags: string[];
}

export interface SearchSummary {
  total_leads: number;
  total_estimated_value: number;
  market_breakdown: { [key: string]: number };
  search_criteria_used: string;
}

export interface OpportunitySearchResponse {
  leads: GeneratedLead[];
  summary: SearchSummary;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface SavedSearch {
  id: number;
  name: string;
  criteria: SearchCriteria;
  results: GeneratedLead[];
  summary: SearchSummary;
  lead_count: number;
  total_estimated_value: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface SavedSearchListItem {
  id: number;
  name: string;
  criteria: SearchCriteria;
  lead_count: number;
  total_estimated_value: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

const opportunitySearchService = {
  async search(criteria: SearchCriteria): Promise<OpportunitySearchResponse> {
    const response = await api.post<OpportunitySearchResponse>(
      '/opportunity-search/generate',
      criteria
    );
    return response.data;
  },

  async getSavedSearches(): Promise<SavedSearchListItem[]> {
    const response = await api.get<SavedSearchListItem[]>(
      '/opportunity-search/saved'
    );
    return response.data;
  },

  async getSavedSearch(id: number): Promise<SavedSearch> {
    const response = await api.get<SavedSearch>(
      `/opportunity-search/saved/${id}`
    );
    return response.data;
  },

  async saveSearch(data: {
    name: string;
    criteria: SearchCriteria;
    results: GeneratedLead[];
    summary: SearchSummary;
  }): Promise<SavedSearch> {
    const response = await api.post<SavedSearch>(
      '/opportunity-search/saved',
      data
    );
    return response.data;
  },

  async deleteSavedSearch(id: number): Promise<void> {
    await api.delete(`/opportunity-search/saved/${id}`);
  },

  async deleteSavedSearches(ids: number[]): Promise<void> {
    await api.post('/opportunity-search/saved/bulk-delete', { ids });
  },

  async duplicateSavedSearch(id: number, name?: string): Promise<SavedSearch> {
    const response = await api.post<SavedSearch>(
      `/opportunity-search/saved/${id}/duplicate`,
      { name }
    );
    return response.data;
  },

  async downloadPdf(id: number): Promise<void> {
    const response = await api.get(`/opportunity-search/saved/${id}/pdf`, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    // Extract filename from content-disposition header if available
    const contentDisposition = response.headers['content-disposition'];
    let filename = `Opportunity-Search-${new Date().toISOString().split('T')[0]}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default opportunitySearchService;
