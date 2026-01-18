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
  create: (data: ContractReview) => api.post('/contract-reviews', data),

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
};
