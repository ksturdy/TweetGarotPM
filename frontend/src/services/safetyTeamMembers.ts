import api from './api';

export interface SafetyTeamMember {
  id: number;
  user_id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  color: string;
  created_at: string;
}

export const safetyTeamApi = {
  getAll: () => api.get<SafetyTeamMember[]>('/safety-team-members'),
  add: (userId: number) => api.post<SafetyTeamMember>('/safety-team-members', { user_id: userId }),
  updateColor: (userId: number, color: string) =>
    api.patch<SafetyTeamMember>(`/safety-team-members/${userId}/color`, { color }),
  remove: (userId: number) => api.delete(`/safety-team-members/${userId}`),
};
