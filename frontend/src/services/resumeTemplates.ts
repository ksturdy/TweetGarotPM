import api from './api';

export interface ResumeTemplateSectionLimits {
  summary_chars?: number;
  projects?: number;
  certifications?: number;
  skills?: number;
  languages?: number;
  hobbies?: number;
  references?: number;
}

export interface ResumeTemplateSectionVisibility {
  contact?: boolean;
  references?: boolean;
  hobbies?: boolean;
  summary?: boolean;
  projects?: boolean;
  education?: boolean;
  skills?: boolean;
  languages?: boolean;
}

export interface ResumeTemplateLayoutConfig {
  show_photo?: boolean;
  show_years_experience?: boolean;
  sidebar_color?: string;
  sections?: ResumeTemplateSectionVisibility;
}

export interface ResumeTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  template_key: string;
  page_size: string;
  orientation: string;
  max_pages: number;
  section_limits?: ResumeTemplateSectionLimits;
  layout_config?: ResumeTemplateLayoutConfig;
  is_default: boolean;
  is_active: boolean;
  preview_image_path: string | null;
  created_at: string;
  updated_at: string;
}

export const resumeTemplatesApi = {
  getAll: (filters?: { is_active?: boolean }) =>
    api.get<ResumeTemplate[]>('/resume-templates', { params: filters }),

  getDefault: () => api.get<ResumeTemplate>('/resume-templates/default'),

  getById: (id: number) => api.get<ResumeTemplate>(`/resume-templates/${id}`),

  create: (data: Partial<ResumeTemplate>) =>
    api.post<ResumeTemplate>('/resume-templates', data),

  update: (id: number, data: Partial<ResumeTemplate>) =>
    api.put<ResumeTemplate>(`/resume-templates/${id}`, data),

  setDefault: (id: number) =>
    api.patch<ResumeTemplate>(`/resume-templates/${id}/set-default`),

  delete: (id: number) => api.delete(`/resume-templates/${id}`),
};
