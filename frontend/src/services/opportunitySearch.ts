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
