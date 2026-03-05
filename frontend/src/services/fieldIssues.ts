import api from './api';

export interface FieldIssue {
  id: number;
  project_id: number;
  tenant_id: number;
  number: number;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  trade: string | null;
  location: string | null;
  status: string;
  source: string;
  notes: string | null;
  created_by: number;
  created_by_name: string;
  project_name?: string;
  project_number?: string;
  created_at: string;
  updated_at: string;
}

export const TRADE_OPTIONS = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'piping', label: 'Piping' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const fieldIssuesApi = {
  getByProject: (projectId: number, filters?: { status?: string; trade?: string }) =>
    api.get<FieldIssue[]>(`/field-issues/project/${projectId}`, { params: filters }),

  getById: (id: number) => api.get<FieldIssue>(`/field-issues/${id}`),

  create: (data: Partial<FieldIssue>) => api.post<FieldIssue>('/field-issues', data),

  update: (id: number, data: Partial<FieldIssue>) =>
    api.put<FieldIssue>(`/field-issues/${id}`, data),

  submit: (id: number) => api.post<FieldIssue>(`/field-issues/${id}/submit`),

  delete: (id: number) => api.delete(`/field-issues/${id}`),
};
