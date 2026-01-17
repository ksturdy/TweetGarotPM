import api from './api';

export interface Contact {
  id: number;
  company_id: number;
  company_name: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
  notes: string | null;
  company_role?: string;
  created_at: string;
  updated_at: string;
}

export const contactsApi = {
  getByCompany: (companyId: number) =>
    api.get<Contact[]>(`/contacts/company/${companyId}`),

  getByProject: (projectId: number) =>
    api.get<Contact[]>(`/contacts/project/${projectId}`),

  getById: (id: number) => api.get<Contact>(`/contacts/${id}`),

  create: (data: Partial<Contact>) => api.post<Contact>('/contacts', data),

  update: (id: number, data: Partial<Contact>) =>
    api.put<Contact>(`/contacts/${id}`, data),

  delete: (id: number) => api.delete(`/contacts/${id}`),
};
