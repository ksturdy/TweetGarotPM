import api from './api';

// Types
export interface Campaign {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  owner_id: number;
  owner_name?: string;
  owner_email?: string;
  total_targets: number;
  contacted_count: number;
  opportunities_count: number;
  total_opportunity_value: number;
  target_touchpoints: number;
  target_opportunities: number;
  target_estimates: number;
  target_awards: number;
  target_pipeline_value: number;
  goal_description?: string;
  company_count?: number;
  contacted?: number;
  opportunities?: number;
  pipeline_value?: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignWeek {
  id: number;
  campaign_id: number;
  week_number: number;
  start_date: string;
  end_date: string;
  label?: string;
  created_at: string;
}

export interface CampaignCompany {
  id: number;
  campaign_id: number;
  name: string;
  sector?: string;
  address?: string;
  phone?: string;
  website?: string;
  tier: 'A' | 'B' | 'C';
  score: number;
  assigned_to_id?: number;
  assigned_to_name?: string;
  target_week?: number;
  status: 'prospect' | 'no_interest' | 'follow_up' | 'new_opp' | 'dead';
  next_action: 'none' | 'follow_30' | 'opp_incoming' | 'no_follow';
  linked_company_id?: number;
  linked_company_name?: string;
  is_added_to_database: boolean;
  contact_count?: number;
  opportunity_count?: number;
  total_opportunity_value?: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignContact {
  id: number;
  campaign_company_id: number;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  is_primary: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignOpportunity {
  id: number;
  campaign_company_id: number;
  company_name?: string;
  tier?: string;
  score?: number;
  name: string;
  description?: string;
  value: number;
  stage: 'qualification' | 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  probability: number;
  close_date?: string;
  linked_opportunity_id?: number;
  linked_opportunity_name?: string;
  is_converted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignEstimate {
  id: number;
  campaign_company_id: number;
  campaign_opportunity_id?: number;
  company_name?: string;
  opportunity_name?: string;
  estimate_number: string;
  name: string;
  amount: number;
  status: 'draft' | 'pending' | 'sent' | 'accepted' | 'declined';
  sent_date?: string;
  valid_until?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignActivityLog {
  id: number;
  campaign_id: number;
  campaign_company_id?: number;
  company_name?: string;
  user_id: number;
  user_name?: string;
  activity_type: 'status_change' | 'action_change' | 'note' | 'contact_attempt' | 'meeting' | 'email' | 'phone_call' | 'opportunity_created' | 'estimate_sent' | 'company_added_to_db';
  description: string;
  metadata?: any;
  created_at: string;
}

export interface CampaignTeamMember {
  id: number;
  campaign_id: number;
  employee_id: number;
  user_id: number | null;
  name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  role: 'owner' | 'member' | 'viewer';
  target_count: number;
  contacted_count: number;
  assigned_companies?: number;
  contacted_companies?: number;
  created_at: string;
}

export interface TeamEligibleEmployee {
  id: number;
  user_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department_name: string | null;
}

// Campaign APIs
export const getTeamEligibleEmployees = async (): Promise<TeamEligibleEmployee[]> => {
  const response = await api.get('/campaigns/team-eligible');
  return response.data;
};

export const getCampaigns = async (): Promise<Campaign[]> => {
  const response = await api.get('/campaigns');
  return response.data;
};

export const getCampaign = async (id: number): Promise<Campaign> => {
  const response = await api.get(`/campaigns/${id}`);
  return response.data;
};

export const createCampaign = async (data: Partial<Campaign>): Promise<Campaign> => {
  const response = await api.post(`/campaigns`, data);
  return response.data;
};

export const updateCampaign = async (id: number, data: Partial<Campaign>): Promise<Campaign> => {
  const response = await api.put(`/campaigns/${id}`, data);
  return response.data;
};

export const deleteCampaign = async (id: number): Promise<void> => {
  await api.delete(`/campaigns/${id}`);
};

export const getCampaignWeeks = async (campaignId: number): Promise<CampaignWeek[]> => {
  const response = await api.get(`/campaigns/${campaignId}/weeks`);
  return response.data;
};

export const createCampaignWeek = async (campaignId: number, data: Partial<CampaignWeek>): Promise<CampaignWeek> => {
  const response = await api.post(`/campaigns/${campaignId}/weeks`, data);
  return response.data;
};

export const getCampaignTeam = async (campaignId: number): Promise<CampaignTeamMember[]> => {
  const response = await api.get(`/campaigns/${campaignId}/team`);
  return response.data;
};

export const addTeamMember = async (campaignId: number, employeeId: number, role: string = 'member'): Promise<CampaignTeamMember> => {
  const response = await api.post(`/campaigns/${campaignId}/team`, { employee_id: employeeId, role });
  return response.data;
};

export const removeTeamMember = async (campaignId: number, employeeId: number): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/team/${employeeId}`);
};

export const reassignCompanies = async (campaignId: number, fromEmployeeId: number, toEmployeeId: number): Promise<{ count: number }> => {
  const response = await api.put(`/campaigns/${campaignId}/team/reassign`, {
    from_employee_id: fromEmployeeId,
    to_employee_id: toEmployeeId
  });
  return response.data;
};

export const getCampaignStatusStats = async (campaignId: number): Promise<any[]> => {
  const response = await api.get(`/campaigns/${campaignId}/stats/status`);
  return response.data;
};

export const getCampaignWeeklyStats = async (campaignId: number): Promise<any[]> => {
  const response = await api.get(`/campaigns/${campaignId}/stats/weekly`);
  return response.data;
};

// Campaign Company APIs
export const getCampaignCompanies = async (campaignId: number, filters?: any): Promise<CampaignCompany[]> => {
  const params = new URLSearchParams(filters).toString();
  const response = await api.get(`/campaigns/${campaignId}/companies${params ? '?' + params : ''}`);
  return response.data;
};

export const getCampaignCompany = async (campaignId: number, companyId: number): Promise<CampaignCompany> => {
  const response = await api.get(`/campaigns/${campaignId}/companies/${companyId}`);
  return response.data;
};

export const createCampaignCompany = async (campaignId: number, data: Partial<CampaignCompany>): Promise<CampaignCompany> => {
  const response = await api.post(`/campaigns/${campaignId}/companies`, data);
  return response.data;
};

export const updateCampaignCompany = async (campaignId: number, companyId: number, data: Partial<CampaignCompany>): Promise<CampaignCompany> => {
  const response = await api.put(`/campaigns/${campaignId}/companies/${companyId}`, data);
  return response.data;
};

export const updateCampaignCompanyStatus = async (campaignId: number, companyId: number, status: string): Promise<CampaignCompany> => {
  const response = await api.patch(`/campaigns/${campaignId}/companies/${companyId}/status`, { status });
  return response.data;
};

export const updateCampaignCompanyAction = async (campaignId: number, companyId: number, next_action: string): Promise<CampaignCompany> => {
  const response = await api.patch(`/campaigns/${campaignId}/companies/${companyId}/action`, { next_action });
  return response.data;
};

export const addCampaignCompanyToDatabase = async (campaignId: number, companyId: number): Promise<any> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/${companyId}/add-to-database`);
  return response.data;
};

export const deleteCampaignCompany = async (campaignId: number, companyId: number): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/companies/${companyId}`);
};

// Campaign Contact APIs
export const getCampaignContacts = async (campaignId: number, companyId: number): Promise<CampaignContact[]> => {
  const response = await api.get(`/campaigns/${campaignId}/companies/${companyId}/contacts`);
  return response.data;
};

export const createCampaignContact = async (campaignId: number, companyId: number, data: Partial<CampaignContact>): Promise<CampaignContact> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/${companyId}/contacts`, data);
  return response.data;
};

export const updateCampaignContact = async (campaignId: number, companyId: number, contactId: number, data: Partial<CampaignContact>): Promise<CampaignContact> => {
  const response = await api.put(`/campaigns/${campaignId}/companies/${companyId}/contacts/${contactId}`, data);
  return response.data;
};

export const deleteCampaignContact = async (campaignId: number, companyId: number, contactId: number): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/companies/${companyId}/contacts/${contactId}`);
};

// Campaign Opportunity APIs
export const getCampaignOpportunities = async (campaignId: number): Promise<CampaignOpportunity[]> => {
  const response = await api.get(`/campaigns/${campaignId}/opportunities`);
  return response.data;
};

export const getCampaignCompanyOpportunities = async (campaignId: number, companyId: number): Promise<CampaignOpportunity[]> => {
  const response = await api.get(`/campaigns/${campaignId}/companies/${companyId}/opportunities`);
  return response.data;
};

export const createCampaignOpportunity = async (campaignId: number, companyId: number, data: Partial<CampaignOpportunity>): Promise<CampaignOpportunity> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/${companyId}/opportunities`, data);
  return response.data;
};

export const updateCampaignOpportunity = async (campaignId: number, companyId: number, oppId: number, data: Partial<CampaignOpportunity>): Promise<CampaignOpportunity> => {
  const response = await api.put(`/campaigns/${campaignId}/companies/${companyId}/opportunities/${oppId}`, data);
  return response.data;
};

export const deleteCampaignOpportunity = async (campaignId: number, companyId: number, oppId: number): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/companies/${companyId}/opportunities/${oppId}`);
};

// Campaign Estimate APIs
export const getCampaignEstimates = async (campaignId: number): Promise<CampaignEstimate[]> => {
  const response = await api.get(`/campaigns/${campaignId}/estimates`);
  return response.data;
};

export const getCampaignCompanyEstimates = async (campaignId: number, companyId: number): Promise<CampaignEstimate[]> => {
  const response = await api.get(`/campaigns/${campaignId}/companies/${companyId}/estimates`);
  return response.data;
};

export const createCampaignEstimate = async (campaignId: number, companyId: number, data: Partial<CampaignEstimate>): Promise<CampaignEstimate> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/${companyId}/estimates`, data);
  return response.data;
};

export const updateCampaignEstimate = async (campaignId: number, companyId: number, estimateId: number, data: Partial<CampaignEstimate>): Promise<CampaignEstimate> => {
  const response = await api.put(`/campaigns/${campaignId}/companies/${companyId}/estimates/${estimateId}`, data);
  return response.data;
};

export const deleteCampaignEstimate = async (campaignId: number, companyId: number, estimateId: number): Promise<void> => {
  await api.delete(`/campaigns/${campaignId}/companies/${companyId}/estimates/${estimateId}`);
};

// Campaign Activity Log APIs
export const getCampaignActivity = async (campaignId: number, limit?: number): Promise<CampaignActivityLog[]> => {
  const params = limit ? `?limit=${limit}` : '';
  const response = await api.get(`/campaigns/${campaignId}/activity${params}`);
  return response.data;
};

export const getCampaignCompanyActivity = async (campaignId: number, companyId: number, limit?: number): Promise<CampaignActivityLog[]> => {
  const params = limit ? `?limit=${limit}` : '';
  const response = await api.get(`/campaigns/${campaignId}/companies/${companyId}/activity${params}`);
  return response.data;
};

export const addCampaignNote = async (campaignId: number, companyId: number, note: string): Promise<CampaignActivityLog> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/${companyId}/notes`, { note });
  return response.data;
};

export const logContactAttempt = async (campaignId: number, companyId: number, method: string, notes?: string): Promise<CampaignActivityLog> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/${companyId}/contact-attempt`, { method, notes });
  return response.data;
};

// Campaign Generation APIs
export const generateCampaign = async (campaignId: number): Promise<{ weeks: number; companies: number; team: number }> => {
  const response = await api.post(`/campaigns/${campaignId}/generate`);
  return response.data;
};

export const bulkCreateCampaignCompanies = async (campaignId: number, companies: Partial<CampaignCompany>[]): Promise<CampaignCompany[]> => {
  const response = await api.post(`/campaigns/${campaignId}/companies/bulk`, { companies });
  return response.data;
};
