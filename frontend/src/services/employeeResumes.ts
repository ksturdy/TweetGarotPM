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
  employee_photo_url?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  languages?: Language[];
  hobbies?: string[];
  references?: Reference[];
  is_active: boolean;
  template_id?: number | null;
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

// --- Import types ---

export interface ResumeImportProjectMatch {
  project_id: number;
  project_name: string;
  project_number?: string;
  customer_name?: string | null;
  confidence: number;
  match_reasons: string[];
}

export interface ResumeImportProject {
  project_name: string;
  location?: string | null;
  customer_name?: string | null;
  project_role?: string | null;
  description?: string | null;
  category?: string | null;
  matches?: ResumeImportProjectMatch[];
}

export interface ResumeImportEmployeeMatch {
  employee_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  job_title?: string | null;
  department_name?: string | null;
  confidence: number;
  match_reasons: string[];
}

export interface ResumeImportParsedData {
  employee_name: string;
  job_title: string;
  years_experience?: number | null;
  summary: string;
  education?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  certifications: Certification[];
  skills: string[];
  languages: Language[];
  hobbies: string[];
  references: Reference[];
  projects: ResumeImportProject[];
  employee_matches?: ResumeImportEmployeeMatch[];
  extracted_photo?: {
    photo_path: string;
    file_size: number;
    file_type: string;
  } | null;
  source_file?: {
    file_name: string;
    file_path: string;
    file_size: number;
    file_type: string;
  } | null;
}

export interface ResumeImportResult {
  filename: string;
  status: 'success' | 'error';
  error?: string;
  parsed?: ResumeImportParsedData;
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

  // Import from Word documents
  importDocx: (files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return api.post<{ results: ResumeImportResult[] }>('/employee-resumes/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
  },

  confirmImport: (resumes: Record<string, any>[]) =>
    api.post<{ created: any[]; errors: any[] }>('/employee-resumes/import/confirm', { resumes }),
};
