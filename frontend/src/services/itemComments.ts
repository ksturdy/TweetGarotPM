import api from './api';

export interface ItemComment {
  id: number;
  tenant_id: number;
  project_id: number;
  user_id: number;
  entity_type: string;
  entity_key: string;
  comment: string;
  link: string | null;
  commenter_name: string;
  commenter_email: string;
  created_at: string;
  updated_at: string;
}

export interface ItemCommentCount {
  entity_key: string;
  count: string;
}

export const itemCommentsApi = {
  getCounts: (projectId: number, entityType: string) =>
    api.get<ItemCommentCount[]>(`/projects/${projectId}/item-comments`, {
      params: { entity_type: entityType },
    }),

  getByEntityKey: (projectId: number, entityType: string, entityKey: string) =>
    api.get<ItemComment[]>(`/projects/${projectId}/item-comments`, {
      params: { entity_type: entityType, entity_key: entityKey },
    }),

  create: (
    projectId: number,
    payload: {
      entity_type: string;
      entity_key: string;
      comment: string;
      link?: string;
      mentioned_user_ids?: number[];
      row_label?: string;
    }
  ) => api.post<ItemComment>(`/projects/${projectId}/item-comments`, payload),

  delete: (projectId: number, commentId: number) =>
    api.delete<{ id: number }>(`/projects/${projectId}/item-comments/${commentId}`),
};
