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
  expenses?: TradeShowExpense[];
  todos?: TradeShowTodo[];
}

export type TradeShowExpenseCategory =
  | 'registration'
  | 'booth'
  | 'travel'
  | 'lodging'
  | 'meals'
  | 'shipping'
  | 'marketing_materials'
  | 'entertainment'
  | 'staffing'
  | 'other';

export interface TradeShowExpense {
  id: number;
  trade_show_id: number;
  tenant_id: number;
  category: TradeShowExpenseCategory;
  description?: string | null;
  vendor?: string | null;
  amount: number | string;
  expense_date?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type TradeShowTodoStatus = 'open' | 'in_progress' | 'done';
export type TradeShowTodoPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TradeShowTodo {
  id: number;
  trade_show_id: number;
  tenant_id: number;
  title: string;
  description?: string | null;
  status: TradeShowTodoStatus;
  priority: TradeShowTodoPriority;
  due_date?: string | null;
  due_time?: string | null;
  reminder_offset_minutes?: number | null;
  reminder_sent_at?: string | null;
  assigned_to_user_id?: number | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  completed_at?: string | null;
  completed_by?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
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

  // Expenses
  getExpenses: (id: number) =>
    api.get<TradeShowExpense[]>(`/trade-shows/${id}/expenses`),

  addExpense: (id: number, data: Partial<TradeShowExpense>) =>
    api.post<TradeShowExpense>(`/trade-shows/${id}/expenses`, data),

  updateExpense: (id: number, expenseId: number, data: Partial<TradeShowExpense>) =>
    api.put<TradeShowExpense>(`/trade-shows/${id}/expenses/${expenseId}`, data),

  removeExpense: (id: number, expenseId: number) =>
    api.delete(`/trade-shows/${id}/expenses/${expenseId}`),

  // To-Dos
  getTodos: (id: number) =>
    api.get<TradeShowTodo[]>(`/trade-shows/${id}/todos`),

  addTodo: (id: number, data: Partial<TradeShowTodo>) =>
    api.post<TradeShowTodo>(`/trade-shows/${id}/todos`, data),

  updateTodo: (id: number, todoId: number, data: Partial<TradeShowTodo>) =>
    api.put<TradeShowTodo>(`/trade-shows/${id}/todos/${todoId}`, data),

  removeTodo: (id: number, todoId: number) =>
    api.delete(`/trade-shows/${id}/todos/${todoId}`),
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

export const EXPENSE_CATEGORY_OPTIONS: { value: TradeShowExpenseCategory; label: string }[] = [
  { value: 'registration', label: 'Registration' },
  { value: 'booth', label: 'Booth' },
  { value: 'travel', label: 'Travel' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'meals', label: 'Meals' },
  { value: 'shipping', label: 'Shipping & Freight' },
  { value: 'marketing_materials', label: 'Marketing Materials' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'staffing', label: 'Staffing' },
  { value: 'other', label: 'Other' },
];

export const TODO_STATUS_OPTIONS: { value: TradeShowTodoStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

export const TODO_PRIORITY_OPTIONS: { value: TradeShowTodoPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#6b7280' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' },
];

export const REMINDER_OFFSET_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At due time' },
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 60 * 4, label: '4 hours before' },
  { value: 60 * 24, label: '1 day before' },
  { value: 60 * 24 * 2, label: '2 days before' },
  { value: 60 * 24 * 7, label: '1 week before' },
];
