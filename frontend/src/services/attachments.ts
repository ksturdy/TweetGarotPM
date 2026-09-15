import api from './api';

export interface Attachment {
  id: number;
  entity_type: string;
  entity_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_by: number;
  created_at: string;
  url: string;
  section_area: string | null;
}

export const attachmentsApi = {
  getByEntity: (entityType: string, entityId: number) =>
    api.get<Attachment[]>(`/attachments/${entityType}/${entityId}`),

  upload: (entityType: string, entityId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Attachment>(`/attachments/${entityType}/${entityId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadWithSection: (entityType: string, entityId: number, file: File, sectionArea: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('section_area', sectionArea);
    return api.post<Attachment>(`/attachments/${entityType}/${entityId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (id: number) => api.delete(`/attachments/${id}`),
};
