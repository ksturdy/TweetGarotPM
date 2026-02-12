import api from './api';

export interface ProposalTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  category?: string;
  default_executive_summary?: string;
  default_company_overview?: string;
  default_terms_and_conditions?: string;
  is_default: boolean;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
  sections?: ProposalTemplateSection[];
  section_count?: number;
}

export interface ProposalTemplateSection {
  id?: number;
  template_id?: number;
  section_type: string;
  title: string;
  content: string;
  display_order: number;
  is_required: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
}

export const proposalTemplatesApi = {
  getAll: (filters?: { category?: string; is_active?: boolean }) =>
    api.get('/proposal-templates', { params: filters }),

  getById: (id: number) => api.get(`/proposal-templates/${id}`),

  getDefault: () => api.get('/proposal-templates/default'),

  getCategories: () => api.get('/proposal-templates/categories'),

  getVariables: () => api.get<TemplateVariable[]>('/proposal-templates/variables'),

  create: (data: Partial<ProposalTemplate>) => api.post('/proposal-templates', data),

  update: (id: number, data: Partial<ProposalTemplate>) =>
    api.put(`/proposal-templates/${id}`, data),

  delete: (id: number) => api.delete(`/proposal-templates/${id}`),
};
