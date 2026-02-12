import api from './api';

export interface Proposal {
  id: number;
  tenant_id: number;
  proposal_number: string;
  customer_id?: number;
  customer_name?: string;
  opportunity_id?: number;
  template_id?: number;
  template_name?: string;
  title: string;
  project_name?: string;
  project_location?: string;
  executive_summary?: string;
  company_overview?: string;
  scope_of_work?: string;
  approach_and_methodology?: string;
  total_amount?: number;
  payment_terms?: string;
  terms_and_conditions?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'sent' | 'accepted' | 'rejected' | 'expired';
  sent_date?: string;
  valid_until?: string;
  accepted_date?: string;
  rejection_reason?: string;
  parent_proposal_id?: number;
  version_number: number;
  is_latest: boolean;
  logo_file_name?: string;
  logo_file_path?: string;
  logo_file_size?: number;
  logo_file_type?: string;
  created_by: number;
  created_by_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  sent_by?: number;
  sent_by_name?: string;
  created_at: string;
  updated_at: string;
  section_count?: number;
  sections?: ProposalSection[];
  case_studies?: ProposalCaseStudy[];
  service_offerings?: ProposalServiceOffering[];
  resumes?: ProposalResume[];
}

export interface ProposalCaseStudy {
  junction_id: number;
  id: number;
  title: string;
  subtitle?: string;
  customer_name?: string;
  market?: string;
  project_value?: number;
  case_study_status: string;
  display_order: number;
  notes?: string;
}

export interface ProposalServiceOffering {
  junction_id: number;
  id: number;
  name: string;
  description?: string;
  category?: string;
  icon_name?: string;
  display_order: number;
  custom_description?: string;
}

export interface ProposalResume {
  junction_id: number;
  id: number;
  employee_name: string;
  job_title: string;
  summary?: string;
  display_order: number;
  role_on_project?: string;
}

export interface ProposalSection {
  id?: number;
  proposal_id?: number;
  section_type: string;
  title: string;
  content?: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export const proposalsApi = {
  getAll: (filters?: {
    status?: string;
    customer_id?: number;
    opportunity_id?: number;
    created_by?: number;
    is_latest?: boolean;
  }) => api.get('/proposals', { params: filters }),

  getById: (id: number) => api.get(`/proposals/${id}`),

  create: (data: Partial<Proposal>) => api.post('/proposals', data),

  createFromTemplate: (templateId: number, data: Partial<Proposal>) =>
    api.post('/proposals/from-template', { templateId, ...data }),

  update: (id: number, data: Partial<Proposal>) => api.put(`/proposals/${id}`, data),

  updateStatus: (id: number, status: string) =>
    api.patch(`/proposals/${id}/status`, { status }),

  createRevision: (id: number) => api.post(`/proposals/${id}/revise`),

  delete: (id: number) => api.delete(`/proposals/${id}`),

  // Sections
  getSections: (id: number) => api.get(`/proposals/${id}/sections`),

  updateSection: (id: number, sectionId: number, data: Partial<ProposalSection>) =>
    api.put(`/proposals/${id}/sections/${sectionId}`, data),

  // Case Studies
  getCaseStudies: (id: number) => api.get(`/proposals/${id}/case-studies`),
  addCaseStudy: (id: number, caseStudyId: number, data?: { notes?: string }) =>
    api.post(`/proposals/${id}/case-studies`, { case_study_id: caseStudyId, ...data }),
  removeCaseStudy: (id: number, caseStudyId: number) =>
    api.delete(`/proposals/${id}/case-studies/${caseStudyId}`),

  // Service Offerings
  getServiceOfferings: (id: number) => api.get(`/proposals/${id}/service-offerings`),
  addServiceOffering: (id: number, serviceOfferingId: number, data?: { custom_description?: string }) =>
    api.post(`/proposals/${id}/service-offerings`, { service_offering_id: serviceOfferingId, ...data }),
  removeServiceOffering: (id: number, serviceOfferingId: number) =>
    api.delete(`/proposals/${id}/service-offerings/${serviceOfferingId}`),

  // Resumes
  getResumes: (id: number) => api.get(`/proposals/${id}/resumes`),
  addResume: (id: number, resumeId: number, data?: { role_on_project?: string }) =>
    api.post(`/proposals/${id}/resumes`, { resume_id: resumeId, ...data }),
  removeResume: (id: number, resumeId: number) =>
    api.delete(`/proposals/${id}/resumes/${resumeId}`),

  // PDF
  downloadPdf: (id: number) =>
    api.get(`/proposals/${id}/pdf-download`, { responseType: 'blob' }),
};
