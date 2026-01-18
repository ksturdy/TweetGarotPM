import api from './api';

export interface Specification {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  category?: string;
  version_number: string;
  is_original_bid: boolean;
  is_latest: boolean;
  parent_spec_id?: number;
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

export interface SpecificationQuestion {
  id: number;
  specification_id: number;
  question: string;
  answer?: string;
  asked_by?: number;
  answered_by?: number;
  asked_by_name?: string;
  answered_by_name?: string;
  asked_at?: string;
  answered_at?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSpecificationData {
  project_id: number;
  title: string;
  description?: string;
  category?: string;
  version_number: string;
  is_original_bid?: boolean;
  parent_spec_id?: number;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  file_type?: string;
  notes?: string;
}

export const specificationsApi = {
  // Specifications
  getByProject: (projectId: number, params?: { category?: string; is_latest?: boolean }) =>
    api.get<{ data: Specification[] }>(`/specifications/project/${projectId}`, { params }),

  getById: (id: number) =>
    api.get<{ data: Specification }>(`/specifications/${id}`),

  getVersionHistory: (id: number) =>
    api.get<{ data: Specification[] }>(`/specifications/${id}/versions`),

  create: (data: CreateSpecificationData) =>
    api.post<{ data: Specification }>('/specifications', data),

  upload: (formData: FormData) =>
    api.post<{ data: Specification }>('/specifications', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  update: (id: number, data: Partial<Specification>) =>
    api.put<{ data: Specification }>(`/specifications/${id}`, data),

  delete: (id: number) =>
    api.delete(`/specifications/${id}`),

  download: (id: number) => {
    return api.get(`/specifications/${id}/download`, {
      responseType: 'blob'
    }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1] || 'specification.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  },

  // Questions
  getQuestions: (specId: number, params?: { status?: string }) =>
    api.get<{ data: SpecificationQuestion[] }>(`/specifications/${specId}/questions`, { params }),

  getQuestion: (id: number) =>
    api.get<{ data: SpecificationQuestion }>(`/specifications/questions/${id}`),

  createQuestion: (specId: number, question: string) =>
    api.post<{ data: SpecificationQuestion }>(`/specifications/${specId}/questions`, { question }),

  answerQuestion: (id: number, answer: string) =>
    api.post<{ data: SpecificationQuestion }>(`/specifications/questions/${id}/answer`, { answer }),

  updateQuestion: (id: number, data: Partial<SpecificationQuestion>) =>
    api.put<{ data: SpecificationQuestion }>(`/specifications/questions/${id}`, data),

  deleteQuestion: (id: number) =>
    api.delete(`/specifications/questions/${id}`),
};
