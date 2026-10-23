import api from './api';

export interface MeetingSeries {
  id: number;
  project_id: number;
  title: string;
  meeting_type: string;
  recurrence_type: 'weekly' | 'biweekly' | 'monthly';
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
  created_by: number;
  created_by_name: string | null;
  carry_over_statuses: string[];
  meeting_count: number;
  last_meeting_date: string | null;
  open_action_count: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingAttendee {
  id: number;
  meeting_id: number;
  user_id: number | null;
  contact_id: number | null;
  name: string | null;
  company: string | null;
  attended: boolean;
  user_name: string | null;
  user_email: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_company: string | null;
  created_at: string;
}

export interface MeetingAgendaItem {
  id: number;
  meeting_id: number;
  order_index: number;
  title: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ActionItemStatus = 'open' | 'in_progress' | 'ongoing' | 'on_hold' | 'information' | 'closed';

export interface MeetingActionItem {
  id: number;
  meeting_id: number;
  agenda_item_id: number | null;
  agenda_item_title: string | null;
  originated_meeting_id: number | null;
  originated_meeting_number: number | null;
  description: string;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_user_name: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectActionItem extends MeetingActionItem {
  meeting_number: number;
  meeting_title: string;
  meeting_date: string | null;
  assignee_display: string | null;
  agenda_item_title: string | null;
}

export interface Meeting {
  id: number;
  project_id: number;
  series_id: number | null;
  previous_meeting_id: number | null;
  previous_meeting_number: number | null;
  number: number;
  title: string;
  meeting_type: string;
  status: 'draft' | 'published' | 'closed';
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  created_by: number;
  created_by_name: string | null;
  series_title: string | null;
  series_recurrence: string | null;
  series_day_of_week: number | null;
  published_at: string | null;
  closed_at: string | null;
  open_action_count?: number;
  attendee_count?: number;
  attendees?: MeetingAttendee[];
  agenda_items?: MeetingAgendaItem[];
  action_items?: MeetingActionItem[];
  created_at: string;
  updated_at: string;
}

export const MEETING_TYPES: Record<string, string> = {
  project_meeting: 'Project Meeting',
  owner_meeting: 'Owner Meeting',
  subcontractor_meeting: 'Subcontractor Meeting',
  safety_meeting: 'Safety Meeting',
  preconstruction_meeting: 'Pre-Construction Meeting',
  progress_meeting: 'Progress Meeting',
  other: 'Other',
};

export const RECURRENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-Weekly',
  monthly: 'Monthly',
};

export const meetingsApi = {
  // Series
  getSeriesByProject: (projectId: number) =>
    api.get<MeetingSeries[]>(`/meetings/series/project/${projectId}`),
  createSeries: (data: Partial<MeetingSeries> & { projectId: number }) =>
    api.post<MeetingSeries>('/meetings/series', data),
  updateSeries: (seriesId: number, data: Partial<MeetingSeries>) =>
    api.put<MeetingSeries>(`/meetings/series/${seriesId}`, data),
  deleteSeries: (seriesId: number) =>
    api.delete(`/meetings/series/${seriesId}`),

  // Meetings
  getByProject: (projectId: number, filters?: { status?: string; seriesId?: number }) =>
    api.get<Meeting[]>(`/meetings/project/${projectId}`, { params: filters }),
  getById: (id: number) =>
    api.get<Meeting>(`/meetings/${id}`),
  create: (data: Partial<Meeting> & { projectId: number; title: string }) =>
    api.post<Meeting>('/meetings', data),
  update: (id: number, data: Partial<Meeting>) =>
    api.put<Meeting>(`/meetings/${id}`, data),
  publish: (id: number) =>
    api.post<Meeting>(`/meetings/${id}/publish`),
  close: (id: number) =>
    api.post<Meeting>(`/meetings/${id}/close`),
  scheduleNext: (id: number) =>
    api.post<Meeting>(`/meetings/${id}/schedule-next`),
  scheduleFollowup: (id: number) =>
    api.post<Meeting>(`/meetings/${id}/schedule-followup`),
  delete: (id: number) =>
    api.delete(`/meetings/${id}`),

  // Attendees
  addAttendee: (meetingId: number, data: Partial<MeetingAttendee>) =>
    api.post<MeetingAttendee>(`/meetings/${meetingId}/attendees`, data),
  updateAttendee: (meetingId: number, attendeeId: number, data: Partial<MeetingAttendee>) =>
    api.put<MeetingAttendee>(`/meetings/${meetingId}/attendees/${attendeeId}`, data),
  removeAttendee: (meetingId: number, attendeeId: number) =>
    api.delete(`/meetings/${meetingId}/attendees/${attendeeId}`),

  // Agenda items
  addAgendaItem: (meetingId: number, data: Partial<MeetingAgendaItem>) =>
    api.post<MeetingAgendaItem>(`/meetings/${meetingId}/agenda-items`, data),
  updateAgendaItem: (meetingId: number, itemId: number, data: Partial<MeetingAgendaItem>) =>
    api.put<MeetingAgendaItem>(`/meetings/${meetingId}/agenda-items/${itemId}`, data),
  deleteAgendaItem: (meetingId: number, itemId: number) =>
    api.delete(`/meetings/${meetingId}/agenda-items/${itemId}`),
  reorderAgendaItems: (meetingId: number, orderedIds: number[]) =>
    api.put(`/meetings/${meetingId}/agenda-items/reorder`, { orderedIds }),

  // Project-level action items
  getActionItemsByProject: (projectId: number) =>
    api.get<ProjectActionItem[]>(`/meetings/action-items/project/${projectId}`),

  // Action items
  addActionItem: (meetingId: number, data: Partial<MeetingActionItem>) =>
    api.post<MeetingActionItem>(`/meetings/${meetingId}/action-items`, data),
  updateActionItem: (meetingId: number, itemId: number, data: Partial<MeetingActionItem>) =>
    api.put<MeetingActionItem>(`/meetings/${meetingId}/action-items/${itemId}`, data),
  deleteActionItem: (meetingId: number, itemId: number) =>
    api.delete(`/meetings/${meetingId}/action-items/${itemId}`),
  reorderActionItems: (meetingId: number, orderedIds: number[]) =>
    api.put(`/meetings/${meetingId}/action-items/reorder`, { orderedIds }),
};
