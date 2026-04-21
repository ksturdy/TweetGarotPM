import api from './api';

export interface DmConversation {
  id: number;
  group_name: string | null;
  is_group: boolean;
  updated_at: string;
  created_by: number | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: number | null;
  last_message_sender_name: string | null;
  unread_count: number;
  participants: DmParticipant[];
}

export interface DmParticipant {
  id: number;
  first_name: string;
  last_name: string;
}

export interface DmMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_first_name: string;
  sender_last_name: string;
  body: string;
  created_at: string;
}

export interface UserPresence {
  user_id: number;
  first_name: string;
  last_name: string;
  status: 'online' | 'away' | 'offline';
  last_seen_at: string | null;
}

export const dmApi = {
  getConversations: () =>
    api.get<DmConversation[]>('/dm/conversations'),

  getMessages: (conversationId: number, params?: { limit?: number; before?: string }) =>
    api.get<DmMessage[]>(`/dm/conversations/${conversationId}/messages`, { params }),

  getUnreadCount: () =>
    api.get<{ count: number }>('/dm/unread-count'),

  getPresence: () =>
    api.get<UserPresence[]>('/dm/presence'),

  findOrCreateDm: (recipientId: number) =>
    api.post<DmConversation>('/dm/conversations/dm', { recipientId }),

  createGroup: (name: string, memberIds: number[]) =>
    api.post<DmConversation>('/dm/conversations/group', { name, memberIds }),

  updateGroupName: (conversationId: number, name: string) =>
    api.put(`/dm/conversations/${conversationId}`, { name }),

  updateMembers: (conversationId: number, addIds?: number[], removeIds?: number[]) =>
    api.put(`/dm/conversations/${conversationId}/members`, { addIds, removeIds }),
};
