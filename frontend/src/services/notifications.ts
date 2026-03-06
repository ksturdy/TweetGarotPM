import api from './api';

export interface Notification {
  id: number;
  tenant_id: number;
  user_id: number;
  entity_type: string;
  entity_id: number;
  event_type: string;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  email_sent: boolean;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationsApi = {
  getAll: (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) =>
    api.get<NotificationsResponse>('/notifications', { params }),

  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count'),

  markAsRead: (id: number) =>
    api.put<Notification>(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put<{ success: boolean }>('/notifications/read-all'),

  delete: (id: number) =>
    api.delete<{ success: boolean }>(`/notifications/${id}`),

  deleteAll: () =>
    api.delete<{ success: boolean }>('/notifications'),
};
