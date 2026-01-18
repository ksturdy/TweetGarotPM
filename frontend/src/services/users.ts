import api from './api';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  hr_access?: string;
  is_active: boolean;
  created_at: string;
}

export interface UpdateUserData {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  hr_access?: string;
  is_active: boolean;
}

export const usersApi = {
  getAll: () => api.get<User[]>('/users'),
  getById: (id: number) => api.get<User>(`/users/${id}`),
  update: (id: number, data: UpdateUserData) => api.put<User>(`/users/${id}`, data),
  updateStatus: (id: number, is_active: boolean) => api.patch<User>(`/users/${id}/status`, { is_active }),
  delete: (id: number) => api.delete(`/users/${id}`),
};
