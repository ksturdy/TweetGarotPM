import api from './api';

export type TradeShowStatus = 'upcoming' | 'registered' | 'in_progress' | 'completed' | 'cancelled';
export type AttendeeRegistrationStatus = 'pending' | 'registered' | 'confirmed' | 'cancelled';

export interface TradeShow {
  id: number;
  tenant_id: number;
  name: string;
  description?: string | null;
  status: TradeShowStatus;

  venue?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;

  event_start_date?: string | null;
  event_end_date?: string | null;
  event_start_time?: string | null;
  event_end_time?: string | null;
  registration_deadline?: string | null;

  registration_cost?: number | string | null;
  booth_cost?: number | string | null;
  travel_budget?: number | string | null;
  total_budget?: number | string | null;

  booth_number?: string | null;
  booth_size?: string | null;
  website_url?: string | null;
  notes?: string | null;

  sales_lead_id?: number | null;
  sales_lead_name?: string | null;
  sales_lead_email?: string | null;
  coordinator_id?: number | null;
  coordinator_name?: string | null;
  coordinator_email?: string | null;

  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;

  attendee_count?: number | string;
  attendees?: TradeShowAttendee[];
}

export interface TradeShowAttendee {
  id: number;
  trade_show_id: number;
  tenant_id: number;

  user_id?: number | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  user_email?: string | null;
  user_job_title?: string | null;

  external_name?: string | null;
  external_email?: string | null;
  external_company?: string | null;

  role?: string | null;
  registration_status: AttendeeRegistrationStatus;
  arrival_date?: string | null;
  departure_date?: string | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
}

export interface TradeShowFilters {
  status?: string;
  year?: number;
  sales_lead_id?: number;
  coordinator_id?: number;
  search?: string;
}

export const tradeShowsApi = {
  getAll: (filters?: TradeShowFilters) =>
    api.get<TradeShow[]>('/trade-shows', { params: filters }),

  getById: (id: number) => api.get<TradeShow>(`/trade-shows/${id}`),

  create: (data: Partial<TradeShow>) => api.post<TradeShow>('/trade-shows', data),

  update: (id: number, data: Partial<TradeShow>) =>
    api.put<TradeShow>(`/trade-shows/${id}`, data),

  delete: (id: number) => api.delete(`/trade-shows/${id}`),

  // Attendees
  getAttendees: (id: number) =>
    api.get<TradeShowAttendee[]>(`/trade-shows/${id}/attendees`),

  addAttendee: (id: number, data: Partial<TradeShowAttendee>) =>
    api.post<TradeShowAttendee>(`/trade-shows/${id}/attendees`, data),

  updateAttendee: (id: number, attendeeId: number, data: Partial<TradeShowAttendee>) =>
    api.put<TradeShowAttendee>(`/trade-shows/${id}/attendees/${attendeeId}`, data),

  removeAttendee: (id: number, attendeeId: number) =>
    api.delete(`/trade-shows/${id}/attendees/${attendeeId}`),
};

export const TRADE_SHOW_STATUS_OPTIONS: { value: TradeShowStatus; label: string; color: string }[] = [
  { value: 'upcoming', label: 'Upcoming', color: '#3b82f6' },
  { value: 'registered', label: 'Registered', color: '#8b5cf6' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'cancelled', label: 'Cancelled', color: '#6b7280' },
];

export const ATTENDEE_REGISTRATION_STATUS_OPTIONS: { value: AttendeeRegistrationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'registered', label: 'Registered' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ATTENDEE_ROLE_OPTIONS = [
  'Booth Lead',
  'Demo Presenter',
  'Sales',
  'Marketing',
  'Engineering',
  'Executive',
  'Support',
  'Other',
];
