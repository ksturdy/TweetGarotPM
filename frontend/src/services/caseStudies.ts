import api from './api';

export interface CaseStudy {
  id: number;
  tenant_id: number;
  title: string;
  subtitle?: string;
  project_id?: number;
  project_name?: string;
  project_value?: number;
  project_start_date?: string;
  project_end_date?: string;
  project_square_footage?: number;
  customer_id?: number;
  customer_name?: string;
  challenge: string;
  solution: string;
  results: string;
  executive_summary?: string;
  cost_savings?: number;
  timeline_improvement_days?: number;
  quality_score?: number;
  additional_metrics?: Record<string, any>;
  market?: string;
  construction_type?: string;
  project_size?: string;
  services_provided?: string[];
  status: 'draft' | 'under_review' | 'published' | 'archived';
  featured: boolean;
  display_order?: number;
  template_id?: number;
  template_name?: string;
  customer_logo_url?: string;
  customer_logo_resolved_url?: string;
  created_by: number;
  created_by_name?: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  image_count?: number;
  hero_image_path?: string;
  hero_image_url?: string;
  images?: { id: number; file_path: string; image_url?: string; is_hero_image: boolean; caption?: string }[];
}

export interface CaseStudyImage {
  id: number;
  case_study_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  caption?: string;
  display_order: number;
  is_hero_image: boolean;
  is_before_photo: boolean;
  is_after_photo: boolean;
  uploaded_at: string;
}

export const caseStudiesApi = {
  // Case study CRUD
  getAll: (filters?: {
    status?: string;
    featured?: boolean;
    market?: string;
    customer_id?: number;
    project_id?: number;
  }) => api.get<CaseStudy[]>('/case-studies', { params: filters }),

  getFeatured: (limit?: number) =>
    api.get<CaseStudy[]>('/case-studies/featured', { params: { limit } }),

  getById: (id: number) => api.get<CaseStudy & { images: CaseStudyImage[] }>(`/case-studies/${id}`),

  create: (data: Partial<CaseStudy>) => api.post<CaseStudy>('/case-studies', data),

  update: (id: number, data: Partial<CaseStudy>) =>
    api.put<CaseStudy>(`/case-studies/${id}`, data),

  delete: (id: number) => api.delete(`/case-studies/${id}`),

  // Workflow actions
  publish: (id: number) => api.patch<CaseStudy>(`/case-studies/${id}/publish`),

  submitForReview: (id: number) => api.patch<CaseStudy>(`/case-studies/${id}/submit`),

  archive: (id: number) => api.patch<CaseStudy>(`/case-studies/${id}/archive`),

  // Image management
  getImages: (caseStudyId: number) =>
    api.get<CaseStudyImage[]>(`/case-studies/${caseStudyId}/images`),

  uploadImage: (caseStudyId: number, formData: FormData) =>
    api.post<CaseStudyImage>(`/case-studies/${caseStudyId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateImage: (imageId: number, data: Partial<CaseStudyImage>) =>
    api.put<CaseStudyImage>(`/case-studies/images/${imageId}`, data),

  deleteImage: (imageId: number) => api.delete(`/case-studies/images/${imageId}`),

  downloadImage: (imageId: number) =>
    api.get(`/case-studies/images/${imageId}/download`, { responseType: 'blob' }),

  // Customer logo
  uploadCustomerLogo: (caseStudyId: number, formData: FormData) =>
    api.post<{ customer_logo_url: string; file_path: string }>(`/case-studies/${caseStudyId}/customer-logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteCustomerLogo: (caseStudyId: number) =>
    api.delete(`/case-studies/${caseStudyId}/customer-logo`),

  // PDF
  downloadPdf: (id: number) =>
    api.get(`/case-studies/${id}/pdf-download`, { responseType: 'blob' }),
};
