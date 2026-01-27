import api from './api';

export interface Opportunity {
  id: number;
  title: string;
  description?: string;
  estimated_value?: number;
  estimated_start_date?: string;
  estimated_duration_days?: number;
  construction_type?: string;
  project_type?: string; // Deprecated - kept for backward compatibility
  location?: string;
  stage_id: number;
  stage_name?: string;
  stage_color?: string;
  stage_probability?: string;
  probability?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: number;
  assigned_to_name?: string;
  assigned_to_email?: string;
  source?: string;
  market?: string;
  owner?: string;
  general_contractor?: string;
  architect?: string;
  engineer?: string;
  campaign_id?: number;
  customer_id?: number;
  customer_name?: string;
  gc_customer_id?: number;
  gc_customer_name?: string;
  facility_name?: string;
  facility_customer_id?: number;
  facility_customer_name?: string;
  converted_to_project_id?: number;
  converted_project_name?: string;
  converted_at?: string;
  lost_reason?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  activity_count?: number;
  open_tasks_count?: number;
}

export interface PipelineStage {
  stage_id: number;
  stage_name: string;
  stage_color: string;
  display_order: number;
  probability: number;
  opportunities: Opportunity[];
}

export interface OpportunityActivity {
  id: number;
  opportunity_id: number;
  activity_type: 'call' | 'meeting' | 'email' | 'note' | 'task' | 'voice_note';
  subject?: string;
  notes?: string;
  voice_note_url?: string;
  voice_transcript?: string;
  scheduled_at?: string;
  completed_at?: string;
  is_completed: boolean;
  reminder_at?: string;
  reminder_sent: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  opportunity_title?: string;
  client_name?: string;
}

export interface OpportunityAnalytics {
  total_opportunities: number;
  total_pipeline_value: number;
  won_value: number;
  lost_value: number;
  won_count: number;
  lost_count: number;
  avg_days_to_close: number;
}

export interface PipelineTrendData {
  month_label: string;
  year: number;
  month_num: number;
  pipeline_value: number;
  opportunity_count: number;
}

export interface OpportunityFilters {
  stage_id?: number;
  assigned_to?: number;
  priority?: string;
  search?: string;
}

const opportunitiesService = {
  // Get all opportunities
  async getAll(filters?: OpportunityFilters): Promise<Opportunity[]> {
    const params = new URLSearchParams();
    if (filters?.stage_id) params.append('stage_id', filters.stage_id.toString());
    if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to.toString());
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const response = await api.get(`/opportunities${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  // Get opportunities grouped by stages (Kanban view)
  async getKanbanView(): Promise<PipelineStage[]> {
    const response = await api.get('/opportunities/kanban');
    return response.data;
  },

  // Get all pipeline stages
  async getStages(): Promise<Array<{ id: number; name: string; color: string; probability: string; display_order: number }>> {
    const response = await api.get('/opportunities/stages');
    return response.data;
  },

  // Get single opportunity
  async getById(id: number): Promise<Opportunity> {
    const response = await api.get(`/opportunities/${id}`);
    return response.data;
  },

  // Create new opportunity
  async create(data: Partial<Opportunity>): Promise<Opportunity> {
    const response = await api.post('/opportunities', data);
    return response.data;
  },

  // Update opportunity
  async update(id: number, data: Partial<Opportunity>): Promise<Opportunity> {
    const response = await api.put(`/opportunities/${id}`, data);
    return response.data;
  },

  // Move opportunity to different stage
  async updateStage(id: number, stageId: number): Promise<Opportunity> {
    const response = await api.patch(`/opportunities/${id}/stage`, { stage_id: stageId });
    return response.data;
  },

  // Convert to project
  async convertToProject(id: number, projectId: number): Promise<Opportunity> {
    const response = await api.post(`/opportunities/${id}/convert`, { project_id: projectId });
    return response.data;
  },

  // Mark as lost
  async markAsLost(id: number, reason?: string): Promise<Opportunity> {
    const response = await api.post(`/opportunities/${id}/lost`, { reason });
    return response.data;
  },

  // Delete opportunity
  async delete(id: number): Promise<void> {
    await api.delete(`/opportunities/${id}`);
  },

  // Get analytics
  async getAnalytics(filters?: { assigned_to?: number; date_from?: string; date_to?: string }): Promise<OpportunityAnalytics> {
    const params = new URLSearchParams();
    if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to.toString());
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const queryString = params.toString();
    const response = await api.get(`/opportunities/analytics${queryString ? `?${queryString}` : ''}`);
    return response.data;
  },

  // Get pipeline trend data
  async getTrend(months: number = 7): Promise<PipelineTrendData[]> {
    const response = await api.get(`/opportunities/trend?months=${months}`);
    return response.data;
  },

  // ===== Activities =====

  // Get activities for an opportunity
  async getActivities(opportunityId: number): Promise<OpportunityActivity[]> {
    const response = await api.get(`/opportunities/${opportunityId}/activities`);
    return response.data;
  },

  // Create activity
  async createActivity(opportunityId: number, data: Partial<OpportunityActivity>): Promise<OpportunityActivity> {
    const response = await api.post(`/opportunities/${opportunityId}/activities`, data);
    return response.data;
  },

  // Update activity
  async updateActivity(opportunityId: number, activityId: number, data: Partial<OpportunityActivity>): Promise<OpportunityActivity> {
    const response = await api.put(`/opportunities/${opportunityId}/activities/${activityId}`, data);
    return response.data;
  },

  // Mark activity as complete
  async completeActivity(opportunityId: number, activityId: number): Promise<OpportunityActivity> {
    const response = await api.patch(`/opportunities/${opportunityId}/activities/${activityId}/complete`);
    return response.data;
  },

  // Delete activity
  async deleteActivity(opportunityId: number, activityId: number): Promise<void> {
    await api.delete(`/opportunities/${opportunityId}/activities/${activityId}`);
  },

  // Get upcoming activities
  async getUpcomingActivities(limit?: number): Promise<OpportunityActivity[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get(`/opportunities/activities/upcoming${params}`);
    return response.data;
  },

  // Get overdue activities
  async getOverdueActivities(): Promise<OpportunityActivity[]> {
    const response = await api.get('/opportunities/activities/overdue');
    return response.data;
  }
};

export default opportunitiesService;
