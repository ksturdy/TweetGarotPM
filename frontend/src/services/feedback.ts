import api from './api';

export interface Feedback {
  id: number;
  user_id: number;
  module: string;
  submodule?: string;
  title: string;
  description: string;
  type: 'bug' | 'enhancement' | 'feature_request' | 'improvement' | 'other';
  status: 'submitted' | 'read' | 'under_review' | 'in_progress' | 'completed' | 'on_hold' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
  votes_count: number;
  upvotes: number;
  downvotes: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  submitter_name?: string;
  submitter_email?: string;
}

export interface FeedbackVote {
  id: number;
  feedback_id: number;
  user_id: number;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface FeedbackComment {
  id: number;
  feedback_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  updated_at: string;
  commenter_name?: string;
  commenter_email?: string;
}

export interface FeedbackStats {
  total: number;
  submitted: number;
  read: number;
  under_review: number;
  in_progress: number;
  completed: number;
  on_hold: number;
  rejected: number;
  bugs: number;
  enhancements: number;
  feature_requests: number;
}

export interface FeedbackFilters {
  status?: string;
  module?: string;
  type?: string;
  sortBy?: 'votes' | 'created' | 'updated' | 'status' | 'priority';
  order?: 'asc' | 'desc';
}

export interface CreateFeedbackData {
  module: string;
  submodule?: string;
  title: string;
  description: string;
  type: 'bug' | 'enhancement' | 'feature_request' | 'improvement' | 'other';
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface UpdateFeedbackData {
  status?: 'submitted' | 'read' | 'under_review' | 'in_progress' | 'completed' | 'on_hold' | 'rejected';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  title?: string;
  description?: string;
  module?: string;
  submodule?: string;
  type?: 'bug' | 'enhancement' | 'feature_request' | 'improvement' | 'other';
}

export const feedbackService = {
  // Get all feedback with optional filters
  async getAll(filters?: FeedbackFilters): Promise<Feedback[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const response = await api.get(`/feedback?${params.toString()}`);
    return response.data;
  },

  // Get feedback by ID
  async getById(id: number): Promise<Feedback> {
    const response = await api.get(`/feedback/${id}`);
    return response.data;
  },

  // Create new feedback
  async create(data: CreateFeedbackData): Promise<Feedback> {
    const response = await api.post('/feedback', data);
    return response.data;
  },

  // Update feedback
  async update(id: number, data: UpdateFeedbackData): Promise<Feedback> {
    const response = await api.put(`/feedback/${id}`, data);
    return response.data;
  },

  // Delete feedback
  async delete(id: number): Promise<void> {
    await api.delete(`/feedback/${id}`);
  },

  // Get user's vote on feedback
  async getUserVote(id: number): Promise<FeedbackVote | null> {
    const response = await api.get(`/feedback/${id}/vote`);
    return response.data;
  },

  // Vote on feedback
  async vote(id: number, voteType: 'up' | 'down'): Promise<FeedbackVote> {
    const response = await api.post(`/feedback/${id}/vote`, { voteType });
    return response.data;
  },

  // Remove vote
  async removeVote(id: number): Promise<void> {
    await api.delete(`/feedback/${id}/vote`);
  },

  // Get comments for feedback
  async getComments(id: number): Promise<FeedbackComment[]> {
    const response = await api.get(`/feedback/${id}/comments`);
    return response.data;
  },

  // Add comment
  async addComment(id: number, comment: string): Promise<FeedbackComment> {
    const response = await api.post(`/feedback/${id}/comments`, { comment });
    return response.data;
  },

  // Update comment
  async updateComment(feedbackId: number, commentId: number, comment: string): Promise<FeedbackComment> {
    const response = await api.put(`/feedback/${feedbackId}/comments/${commentId}`, { comment });
    return response.data;
  },

  // Delete comment
  async deleteComment(feedbackId: number, commentId: number): Promise<void> {
    await api.delete(`/feedback/${feedbackId}/comments/${commentId}`);
  },

  // Get feedback statistics
  async getStats(): Promise<FeedbackStats> {
    const response = await api.get('/feedback/stats');
    return response.data;
  }
};

// Module options for the feedback form
export const MODULE_OPTIONS = [
  'Projects',
  'RFIs',
  'Submittals',
  'Change Orders',
  'Daily Reports',
  'Schedule',
  'Estimates',
  'HR',
  'Account Management',
  'Customers',
  'Companies',
  'Contacts',
  'Users',
  'Settings',
  'Dashboard',
  'Other'
];

// Submodule options by module
export const SUBMODULE_OPTIONS: Record<string, string[]> = {
  'Projects': ['Project List', 'Project Details', 'Project Timeline', 'Project Budget', 'Specifications', 'Drawings'],
  'RFIs': ['RFI List', 'RFI Detail', 'RFI Creation', 'RFI Actions', 'RFI PDF'],
  'Submittals': ['Submittal List', 'Submittal Detail', 'Submittal Review', 'Submittal PDF'],
  'Change Orders': ['Change Order List', 'Change Order Detail', 'Change Order Approval'],
  'Daily Reports': ['Daily Report List', 'Daily Report Detail', 'Daily Report Creation'],
  'Schedule': ['Schedule View', 'Gantt Chart', 'Task Management'],
  'Estimates': ['Estimate List', 'Estimate Detail', 'Estimate Creation', 'Estimate Calculations'],
  'HR': ['Employee List', 'Employee Detail', 'Department Management', 'Office Locations'],
  'Account Management': ['Customer List', 'Customer Detail', 'Customer Metrics'],
  'Users': ['User Management', 'Role Management', 'Permissions']
};

export default feedbackService;
