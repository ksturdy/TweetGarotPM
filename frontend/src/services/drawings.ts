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
  page_count?: number;
  is_drawing_set?: boolean;
}

export interface DrawingPage {
  id: number;
  drawing_id: number;
  page_number: number;
  discipline: string | null;
  confidence: number | null;
  drawing_number: string | null;
  title: string | null;
  ai_classified: boolean;
  classified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassificationResult {
  pages: DrawingPage[];
  summary: Record<string, number>;
  notes?: string;
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

  uploadWithProgress: (formData: FormData, onProgress: (percent: number) => void) =>
    api.post<{ data: Drawing }>('/drawings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        onProgress(percent);
      },
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

  // Drawing pages API
  getPages: (drawingId: number, params?: { discipline?: string }) =>
    api.get<{ data: { pages: DrawingPage[]; summary: Record<string, number> } }>(
      `/drawings/${drawingId}/pages`, { params }
    ),

  classifyPagesQuick: (drawingId: number) =>
    api.post<{ data: ClassificationResult }>(`/drawings/${drawingId}/classify-pages-quick`),

  classifyPagesAI: (drawingId: number) =>
    api.post<{ data: ClassificationResult }>(`/drawings/${drawingId}/classify-pages`),

  updatePage: (drawingId: number, pageNumber: number, data: { discipline: string }) =>
    api.put<{ data: DrawingPage }>(`/drawings/${drawingId}/pages/${pageNumber}`, data),

  bulkUpdatePages: (drawingId: number, pages: Array<{ page_number: number; discipline: string }>) =>
    api.put<{ data: { pages: DrawingPage[]; summary: Record<string, number> } }>(
      `/drawings/${drawingId}/pages/bulk`, { pages }
    ),
};
