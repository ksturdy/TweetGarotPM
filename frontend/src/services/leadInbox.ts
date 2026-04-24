import api from './api';

export interface ExtractedLeadData {
  title: string;
  description: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
  estimated_value: number | null;
  location: string | null;
  project_type: string | null;
  construction_type: string | null;
  market: string | null;
  source: string | null;
  general_contractor: string | null;
  architect: string | null;
  engineer: string | null;
  estimated_start_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: 'high' | 'medium' | 'low';
  extraction_notes: string | null;
}

export interface LeadInboxAttachment {
  id: number;
  lead_inbox_id: number;
  filename: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  file_path: string;
  created_at: string;
}

export interface LeadInboxActivity {
  id: number;
  lead_inbox_id: number;
  activity_type: 'received' | 'ai_extracted' | 'approved' | 'rejected' | 'error' | 'manual_edit';
  description: string | null;
  user_id: number | null;
  user_name: string | null;
  metadata: any;
  created_at: string;
}

export interface LeadInbox {
  id: number;
  tenant_id: number;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  received_at: string;
  body_text: string | null;
  body_html: string | null;
  stripped_text: string | null;
  extracted_data: ExtractedLeadData | null;
  ai_confidence: 'high' | 'medium' | 'low' | 'manual' | null;
  ai_extraction_error: string | null;
  status: 'pending' | 'ai_processed' | 'approved' | 'rejected' | 'error';
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  opportunity_id: number | null;
  attachment_count: number;
  created_at: string;
  updated_at: string;
  attachments?: LeadInboxAttachment[];
  activities?: LeadInboxActivity[];
}

export interface LeadInboxStats {
  pending: number;
  ai_processed: number;
  approved: number;
  rejected: number;
  error: number;
  total: number;
}

const leadInboxApi = {
  /**
   * Get all leads with optional filters
   */
  async getAll(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<LeadInbox[]> {
    const response = await api.get<LeadInbox[]>('/lead-inbox', { params });
    return response.data;
  },

  /**
   * Get stats (count by status)
   */
  async getStats(): Promise<LeadInboxStats> {
    const response = await api.get<LeadInboxStats>('/lead-inbox/stats');
    return response.data;
  },

  /**
   * Get single lead by ID
   */
  async getById(id: number): Promise<LeadInbox> {
    const response = await api.get<LeadInbox>(`/lead-inbox/${id}`);
    return response.data;
  },

  /**
   * Approve lead and create opportunity
   */
  async approve(id: number, data?: Partial<ExtractedLeadData>): Promise<{
    lead: LeadInbox;
    opportunity: any;
  }> {
    const response = await api.post(`/lead-inbox/${id}/approve`, data || {});
    return response.data;
  },

  /**
   * Reject lead with reason
   */
  async reject(id: number, reason: string): Promise<LeadInbox> {
    const response = await api.post<LeadInbox>(`/lead-inbox/${id}/reject`, { reason });
    return response.data;
  },

  /**
   * Re-process lead with AI
   */
  async reprocess(id: number): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`/lead-inbox/${id}/reprocess`);
    return response.data;
  },

  /**
   * Update extracted data manually
   */
  async updateExtractedData(id: number, data: ExtractedLeadData): Promise<LeadInbox> {
    const response = await api.patch<LeadInbox>(`/lead-inbox/${id}/extracted-data`, {
      extractedData: data,
    });
    return response.data;
  },
};

export default leadInboxApi;
