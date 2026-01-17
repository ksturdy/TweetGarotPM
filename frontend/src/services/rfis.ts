import api from './api';

export interface RFI {
  id: number;
  project_id: number;
  number: number;
  subject: string;
  question: string;
  response: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  ball_in_court: number | null;
  ball_in_court_name: string | null;
  recipient_company_id: number | null;
  recipient_company_name: string | null;
  recipient_contact_id: number | null;
  recipient_contact_name: string | null;
  recipient_contact_email: string | null;
  recipient_contact_phone: string | null;
  created_by: number;
  created_by_name: string | null;

  // Reference Information
  spec_section: string | null;
  drawing_sheet: string | null;
  detail_grid_ref: string | null;
  discipline: 'plumbing' | 'hvac' | 'piping' | 'equipment' | 'controls' | 'other' | null;
  discipline_other: string | null;

  // Suggested Solution
  suggested_solution: string | null;

  // Impact Information
  schedule_impact: boolean;
  schedule_impact_days: number | null;
  cost_impact: boolean;
  cost_impact_amount: number | null;
  affects_other_trades: boolean;
  affected_trades: string | null;

  // Attachments
  has_sketches: boolean;
  has_photos: boolean;
  has_spec_pages: boolean;
  has_shop_drawings: boolean;
  attachment_notes: string | null;

  // Response Classification
  response_classification: 'clarification_only' | 'submit_cor' | 'proceed_suggested' | 'see_attached' | 'refer_to' | null;
  response_reference: string | null;
  responded_by: number | null;
  responded_by_name: string | null;
  responded_by_company_id: number | null;
  responded_by_contact_id: number | null;
  responded_by_company_name: string | null;
  responded_by_contact_name: string | null;

  // Project info
  project_name: string | null;
  project_number: string | null;
  project_client: string | null;

  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export const rfisApi = {
  getByProject: (projectId: number, filters?: { status?: string }) =>
    api.get<RFI[]>(`/rfis/project/${projectId}`, { params: filters }),

  getById: (id: number) => api.get<RFI>(`/rfis/${id}`),

  create: (data: Partial<RFI>) => api.post<RFI>('/rfis', data),

  update: (id: number, data: Partial<RFI>) => api.put<RFI>(`/rfis/${id}`, data),

  respond: (id: number, response: string) => api.post<RFI>(`/rfis/${id}/respond`, { response }),

  close: (id: number) => api.post<RFI>(`/rfis/${id}/close`),
};
