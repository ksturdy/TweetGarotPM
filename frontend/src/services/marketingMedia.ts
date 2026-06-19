import api from './api';
import { ProjectPhoto } from './projectPhotos';

export interface MarketingMediaItem {
  id: number;
  tenant_id: number;
  title: string;
  file_name: string;
  file_path: string;
  thumb_path: string | null;
  feed_path: string | null;
  file_size: number | null;
  file_type: string | null;
  width: number | null;
  height: number | null;
  caption: string;
  tags: string;
  uploaded_by: number;
  uploaded_by_name: string;
  url: string;
  thumb_url: string | null;
  feed_url: string | null;
  created_at: string;
  source: 'marketing';
}

export type CombinedMediaItem =
  | (MarketingMediaItem & { source: 'marketing' })
  | (ProjectPhoto & { source: 'project' });

export const marketingMediaApi = {
  getAll: () =>
    api.get<MarketingMediaItem[]>('/marketing-media'),

  getCombined: () =>
    api.get<CombinedMediaItem[]>('/marketing-media/combined'),

  getById: (id: number) =>
    api.get<MarketingMediaItem>(`/marketing-media/${id}`),

  upload: (
    file: File,
    meta?: { title?: string; caption?: string; tags?: string }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.title) formData.append('title', meta.title);
    if (meta?.caption) formData.append('caption', meta.caption);
    if (meta?.tags) formData.append('tags', meta.tags);
    return api.post<MarketingMediaItem>('/marketing-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (
    id: number,
    data: { title?: string; caption?: string; tags?: string }
  ) => api.put<MarketingMediaItem>(`/marketing-media/${id}`, data),

  delete: (id: number) => api.delete(`/marketing-media/${id}`),
};
