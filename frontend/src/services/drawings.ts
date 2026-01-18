import api from './api';

export interface Drawing {
  id: number;
  project_id: number;
  drawing_number: string;
  title: string;
  description?: string;
  discipline?: string;
  sheet_number?: string;
  version_number: string;
  is_original_bid: boolean;
  is_latest: boolean;
  parent_drawing_id?: number;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  file_type?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  uploaded_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  parent_version?: string;
}

export interface CreateDrawingData {
  project_id: number;
  drawing_number: string;
  title: string;
  description?: string;
  discipline?: string;
  sheet_number?: string;
  version_number: string;
  is_original_bid?: boolean;
  parent_drawing_id?: number;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  file_type?: string;
  notes?: string;
}

export const drawingsApi = {
  getByProject: (projectId: number, params?: { discipline?: string; is_latest?: boolean; drawing_number?: string }) =>
    api.get<{ data: Drawing[] }>(`/drawings/project/${projectId}`, { params }),

  getById: (id: number) =>
    api.get<{ data: Drawing }>(`/drawings/${id}`),

  getVersionHistory: (id: number) =>
    api.get<{ data: Drawing[] }>(`/drawings/${id}/versions`),

  create: (data: CreateDrawingData) =>
    api.post<{ data: Drawing }>('/drawings', data),

  upload: (formData: FormData) =>
    api.post<{ data: Drawing }>('/drawings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  update: (id: number, data: Partial<Drawing>) =>
    api.put<{ data: Drawing }>(`/drawings/${id}`, data),

  delete: (id: number) =>
    api.delete(`/drawings/${id}`),

  download: (id: number) => {
    return api.get(`/drawings/${id}/download`, {
      responseType: 'blob'
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1] || 'drawing.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  },
};
