import api from './api';

export interface ContractRiskFinding {
  id?: number;
  contract_review_id?: number;
  category: string;
  title: string;
  risk_level: 'HIGH' | 'MODERATE' | 'LOW';
  finding: string;
  recommendation?: string;
  status?: 'open' | 'resolved' | 'accepted' | 'mitigated';
  resolution_notes?: string;
  resolved_by?: number;
  resolved_by_name?: string;
  resolved_at?: string;
  page_number?: number;
  location_start?: number;
  location_end?: number;
  quoted_text?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContractAnnotation {
  id?: number;
  contract_review_id?: number;
  annotation_type: 'strikethrough' | 'comment' | 'highlight' | 'note';
  page_number?: number;
  location_start?: number;
  location_end?: number;
  quoted_text?: string;
  content?: string;
  color?: string;
  risk_finding_id?: number;
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContractReview {
  id?: number;
  file_name: string;
  file_size?: number;
  file_path?: string;
  project_name?: string;
  general_contractor?: string;
  contract_value?: number;
  overall_risk?: 'HIGH' | 'MODERATE' | 'LOW';
  analysis_completed_at?: string;
  status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_revision';
  needs_legal_review?: boolean;
  uploaded_by?: number;
  uploaded_by_name?: string;
  reviewed_by?: number;
  reviewed_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  review_notes?: string;
  approval_notes?: string;
  created_at?: string;
  updated_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  findings?: ContractRiskFinding[];
  annotations?: ContractAnnotation[];
}

export interface ContractReviewStats {
  total: number;
  pending: number;
  under_review: number;
  approved: number;
  rejected: number;
  high_risk: number;
  moderate_risk: number;
  low_risk: number;
  needs_legal_review: number;
  total_contract_value: number;
  avg_contract_value: number;
}

export interface ContractReviewFilters {
  status?: string;
  overall_risk?: string;
  needs_legal_review?: boolean;
  uploaded_by?: number;
  search?: string;
}

export const contractReviewsApi = {
  // Get all contract reviews with optional filters
  getAll: (filters?: ContractReviewFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.overall_risk) params.append('overall_risk', filters.overall_risk);
    if (filters?.needs_legal_review !== undefined)
      params.append('needs_legal_review', filters.needs_legal_review.toString());
    if (filters?.uploaded_by) params.append('uploaded_by', filters.uploaded_by.toString());
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    return api.get(`/contract-reviews${queryString ? `?${queryString}` : ''}`);
  },

  // Get statistics
  getStats: () => api.get('/contract-reviews/stats'),

  // Get single contract review by ID
  getById: (id: number) => api.get(`/contract-reviews/${id}`),

  // Create new contract review
  create: (data: ContractReview, file?: File) => {
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_name', data.file_name);
      if (data.file_size) formData.append('file_size', data.file_size.toString());
      if (data.project_name) formData.append('project_name', data.project_name);
      if (data.general_contractor) formData.append('general_contractor', data.general_contractor);
      if (data.contract_value) formData.append('contract_value', data.contract_value.toString());
      if (data.overall_risk) formData.append('overall_risk', data.overall_risk);
      if (data.status) formData.append('status', data.status);
      if (data.needs_legal_review !== undefined) formData.append('needs_legal_review', data.needs_legal_review.toString());
      if (data.findings) formData.append('findings', JSON.stringify(data.findings));

      return api.post('/contract-reviews', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.post('/contract-reviews', data);
  },

  // Update contract review
  update: (id: number, data: Partial<ContractReview>) =>
    api.put(`/contract-reviews/${id}`, data),

  // Delete contract review
  delete: (id: number) => api.delete(`/contract-reviews/${id}`),

  // Risk Finding operations
  addFinding: (reviewId: number, finding: ContractRiskFinding) =>
    api.post(`/contract-reviews/${reviewId}/findings`, finding),

  updateFinding: (reviewId: number, findingId: number, data: Partial<ContractRiskFinding>) =>
    api.put(`/contract-reviews/${reviewId}/findings/${findingId}`, data),

  deleteFinding: (reviewId: number, findingId: number) =>
    api.delete(`/contract-reviews/${reviewId}/findings/${findingId}`),

  // Annotation operations
  getAnnotations: (reviewId: number) =>
    api.get(`/contract-reviews/${reviewId}/annotations`),

  addAnnotation: (reviewId: number, annotation: ContractAnnotation) =>
    api.post(`/contract-reviews/${reviewId}/annotations`, annotation),

  updateAnnotation: (reviewId: number, annotationId: number, data: Partial<ContractAnnotation>) =>
    api.put(`/contract-reviews/${reviewId}/annotations/${annotationId}`, data),

  deleteAnnotation: (reviewId: number, annotationId: number) =>
    api.delete(`/contract-reviews/${reviewId}/annotations/${annotationId}`),

  // Get contract file URL (relative to api baseURL, no /api prefix)
  getFileUrl: (reviewId: number) => `/contract-reviews/${reviewId}/file`,
};
