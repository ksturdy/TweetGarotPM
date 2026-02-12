import api from './api';

export interface LayoutSection {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

export interface LayoutConfig {
  sections: LayoutSection[];
  page_size?: string;
  orientation?: string;
}

export interface CaseStudyTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  category?: string;
  layout_config: LayoutConfig;
  color_scheme: string;
  show_logo: boolean;
  show_images: boolean;
  show_metrics: boolean;
  is_default: boolean;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export const caseStudyTemplatesApi = {
  getAll: (filters?: { category?: string; is_active?: boolean }) =>
    api.get<CaseStudyTemplate[]>('/case-study-templates', { params: filters }),

  getById: (id: number) =>
    api.get<CaseStudyTemplate>(`/case-study-templates/${id}`),

  getDefault: () =>
    api.get<CaseStudyTemplate>('/case-study-templates/default'),

  getCategories: () =>
    api.get<string[]>('/case-study-templates/categories'),

  create: (data: Partial<CaseStudyTemplate>) =>
    api.post<CaseStudyTemplate>('/case-study-templates', data),

  update: (id: number, data: Partial<CaseStudyTemplate>) =>
    api.put<CaseStudyTemplate>(`/case-study-templates/${id}`, data),

  delete: (id: number) =>
    api.delete(`/case-study-templates/${id}`),
};
