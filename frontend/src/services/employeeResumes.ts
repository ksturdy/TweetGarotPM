import api from './api';

export interface EmployeeResume {
  id: number;
  tenant_id: number;
  employee_id?: number;
  employee_name: string;
  job_title: string;
  years_experience?: number;
  summary: string;
  certifications: Certification[];
  skills: string[];
  education?: string;
  resume_file_name?: string;
  resume_file_path?: string;
  resume_file_size?: number;
  resume_file_type?: string;
  employee_photo_path?: string;
  phone?: string;
  email?: string;
  address?: string;
  languages?: Language[];
  hobbies?: string[];
  references?: Reference[];
  is_active: boolean;
  version_number: number;
  last_updated_by?: number;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  name: string;
  issuer?: string;
  year?: number;
}

export interface Language {
  language: string;
  proficiency: string; // e.g., "Native", "Fluent", "Conversational"
}

export interface Reference {
  name: string;
  title?: string;
  company?: string;
  phone?: string;
}

export interface ResumeProject {
  id: number;
  resume_id: number;
  tenant_id: number;
  project_id?: number;
  project_name: string;
  project_role: string;
  customer_name?: string;
  project_value?: number;
  start_date?: string;
  end_date?: string;
  description?: string;
  square_footage?: number;
  location?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Fields from JOIN with projects table
  db_project_name?: string;
  project_number?: string;
  db_customer_name?: string;
}

export const employeeResumesApi = {
  getAll: (filters?: { employee_id?: number; is_active?: boolean; search?: string }) =>
    api.get('/employee-resumes', { params: filters }),

  getById: (id: number) => api.get(`/employee-resumes/${id}`),

  create: (formData: FormData) =>
    api.post('/employee-resumes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  update: (id: number, formData: FormData) =>
    api.put(`/employee-resumes/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  delete: (id: number) => api.delete(`/employee-resumes/${id}`),

  download: (id: number) =>
    api.get(`/employee-resumes/${id}/download`, { responseType: 'blob' }),

  // Photo management
  uploadPhoto: (id: number, formData: FormData) =>
    api.post(`/employee-resumes/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  deletePhoto: (id: number) => api.delete(`/employee-resumes/${id}/photo`),

  // Project management
  getProjects: (id: number) => api.get(`/employee-resumes/${id}/projects`),

  addProject: (id: number, data: Partial<ResumeProject>) =>
    api.post(`/employee-resumes/${id}/projects`, data),

  updateProject: (resumeId: number, projectId: number, data: Partial<ResumeProject>) =>
    api.put(`/employee-resumes/${resumeId}/projects/${projectId}`, data),

  deleteProject: (resumeId: number, projectId: number) =>
    api.delete(`/employee-resumes/${resumeId}/projects/${projectId}`),

  reorderProjects: (id: number, projectIds: number[]) =>
    api.post(`/employee-resumes/${id}/projects/reorder`, { project_ids: projectIds }),

  // PDF generation
  getPreviewHtml: (id: number) => api.get(`/employee-resumes/${id}/preview-html`),

  downloadPdf: (id: number) =>
    api.get(`/employee-resumes/${id}/pdf`, { responseType: 'blob' }),
};
