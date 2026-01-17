import api from './api';

export interface Department {
  id: number;
  name: string;
  description: string | null;
  department_number: string | null;
  manager_id: number | null;
  manager_name: string | null;
  employee_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentInput {
  name: string;
  description?: string;
  departmentNumber?: string;
  managerId?: number;
}

export const departmentsApi = {
  getAll: () => api.get<{ data: Department[] }>('/departments'),

  getById: (id: number) => api.get<{ data: Department }>(`/departments/${id}`),

  create: (data: DepartmentInput) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      department_number: data.departmentNumber || null,
      manager_id: data.managerId || null,
    };
    return api.post<{ data: Department }>('/departments', payload);
  },

  update: (id: number, data: DepartmentInput) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      department_number: data.departmentNumber || null,
      manager_id: data.managerId || null,
    };
    return api.put<{ data: Department }>(`/departments/${id}`, payload);
  },

  delete: (id: number) => api.delete<{ message: string }>(`/departments/${id}`),
};
