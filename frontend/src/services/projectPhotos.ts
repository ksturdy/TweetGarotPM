import api from './api';

export interface ProjectPhoto {
  id: number;
  tenant_id: number;
  project_id: number;
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
  display_order: number;
  uploaded_by: number;
  uploaded_by_name: string;
  project_name: string;
  job_number: string;
  url: string;
  thumb_url: string | null;
  feed_url: string | null;
  created_at: string;
  source?: 'project';
}

export const projectPhotosApi = {
  getByProject: (projectId: number | string) =>
    api.get<ProjectPhoto[]>(`/project-photos/project/${projectId}`),

  getAll: () =>
    api.get<ProjectPhoto[]>('/project-photos/all'),

  getById: (id: number) =>
    api.get<ProjectPhoto>(`/project-photos/${id}`),

  upload: (
    projectId: number | string,
    file: File,
    meta?: { caption?: string; tags?: string }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (meta?.caption) formData.append('caption', meta.caption);
    if (meta?.tags) formData.append('tags', meta.tags);
    return api.post<ProjectPhoto>(
      `/project-photos/project/${projectId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  update: (
    id: number,
    data: { caption?: string; tags?: string; display_order?: number }
  ) => api.put<ProjectPhoto>(`/project-photos/${id}`, data),

  bulkUpdate: (
    ids: number[],
    data: { caption?: string; tags?: string; tagMode?: 'append' | 'replace' }
  ) => api.put<{ updated: number }>('/project-photos/bulk', { ids, ...data }),

  delete: (id: number) => api.delete(`/project-photos/${id}`),
};
