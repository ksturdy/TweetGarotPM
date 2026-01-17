import api from './api';

export interface Employee {
  id: number;
  user_id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  mobile_phone: string | null;
  department_id: number | null;
  department_name: string | null;
  office_location_id: number | null;
  office_location_name: string | null;
  job_title: string | null;
  hire_date: string | null;
  employment_status: string;
  role: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInput {
  userId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  departmentId?: number;
  officeLocationId?: number;
  jobTitle?: string;
  hireDate?: string;
  employmentStatus?: string;
  role?: string;
  notes?: string;
}

export interface EmployeeFilters {
  departmentId?: number;
  officeLocationId?: number;
  employmentStatus?: string;
  search?: string;
}

export const employeesApi = {
  getAll: (filters?: EmployeeFilters) => {
    const params = new URLSearchParams();
    if (filters?.departmentId) params.append('department_id', filters.departmentId.toString());
    if (filters?.officeLocationId) params.append('office_location_id', filters.officeLocationId.toString());
    if (filters?.employmentStatus) params.append('employment_status', filters.employmentStatus);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    return api.get<{ data: Employee[] }>(`/employees${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id: number) => api.get<{ data: Employee }>(`/employees/${id}`),

  getByUserId: (userId: number) => api.get<{ data: Employee }>(`/employees/user/${userId}`),

  create: (data: EmployeeInput) => {
    const payload = {
      user_id: data.userId || null,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      mobile_phone: data.mobilePhone || null,
      department_id: data.departmentId || null,
      office_location_id: data.officeLocationId || null,
      job_title: data.jobTitle || null,
      hire_date: data.hireDate || null,
      employment_status: data.employmentStatus || 'active',
      role: data.role || 'user',
      notes: data.notes || null,
    };
    return api.post<{ data: Employee }>('/employees', payload);
  },

  update: (id: number, data: EmployeeInput) => {
    const payload = {
      user_id: data.userId || null,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      mobile_phone: data.mobilePhone || null,
      department_id: data.departmentId || null,
      office_location_id: data.officeLocationId || null,
      job_title: data.jobTitle || null,
      hire_date: data.hireDate || null,
      employment_status: data.employmentStatus || 'active',
      role: data.role || 'user',
      notes: data.notes || null,
    };
    return api.put<{ data: Employee }>(`/employees/${id}`, payload);
  },

  delete: (id: number) => api.delete<{ message: string }>(`/employees/${id}`),
};
