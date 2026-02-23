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
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  location: string;
  construction_type: string;
  market_sector: string;
  general_contractor: string;
  estimated_start_date: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  timeline: string;
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

const opportunitySearchService = {
  async search(criteria: SearchCriteria): Promise<OpportunitySearchResponse> {
    const response = await api.post<OpportunitySearchResponse>(
      '/opportunity-search/generate',
      criteria
    );
    return response.data;
  }
};

export default opportunitySearchService;
