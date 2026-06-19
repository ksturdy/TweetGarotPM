import api from './api';

export interface Rolling12Column {
  key: string;
  label: string;
}

export interface SecuredProject {
  contract_number: string;
  description: string;
  customer_name: string;
  project_manager_name: string;
  department_code: string;
  backlog: number;
  pct_complete: number;
  monthly: Record<string, number>;
  total: number;
}

export interface AwardedProject {
  title: string;
  client: string;
  stage_name: string;
  estimated_value: number;
  monthly: Record<string, number>;
  total: number;
}

export interface PursuitProject {
  title: string;
  client: string;
  stage_name: string;
  probability_label: string;
  probability_pct: number;
  estimated_value: number;
  weighted_value: number;
  monthly: Record<string, number>;
  total: number;
}

export interface Rolling12Data {
  generated_at: string;
  columns: Rolling12Column[];
  secured: Record<string, number>;
  awarded: Record<string, number>;
  pursuits: Record<string, number>;
  secured_projects: SecuredProject[];
  awarded_projects: AwardedProject[];
  pursuit_projects: PursuitProject[];
}

export interface Rolling12Filters {
  departments: string[];
}

const buildParams = (departments: string[]) =>
  departments.length ? `?departments=${departments.join(',')}` : '';

export const rolling12ReportApi = {
  getFilters: () =>
    api.get<Rolling12Filters>('/reports/rolling-12/filters'),

  get: (departments: string[] = []) =>
    api.get<Rolling12Data>(`/reports/rolling-12${buildParams(departments)}`),

  downloadExcel: async (departments: string[] = []) => {
    const response = await api.get(
      `/reports/rolling-12/excel-download${buildParams(departments)}`,
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rolling-12-Revenue-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadPdf: async (departments: string[] = []) => {
    const response = await api.get(
      `/reports/rolling-12/pdf-download${buildParams(departments)}`,
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rolling-12-Revenue-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
