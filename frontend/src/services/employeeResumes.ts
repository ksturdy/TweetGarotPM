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
};
