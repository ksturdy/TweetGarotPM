import api from './api';

export interface Budget2027Column {
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

export interface Budget2027Data {
  generated_at: string;
  columns: Budget2027Column[];
  secured: Record<string, number>;
  awarded: Record<string, number>;
  pursuits: Record<string, number>;
  secured_projects: SecuredProject[];
  awarded_projects: AwardedProject[];
  pursuit_projects: PursuitProject[];
}

export interface Budget2027Team {
  id: number;
  name: string;
  color: string;
}

export interface Budget2027Filters {
  departments: string[];
  teams: Budget2027Team[];
}

const buildParams = (departments: string[], teams: number[]) => {
  const parts: string[] = [];
  if (departments.length) parts.push(`departments=${departments.join(',')}`);
  if (teams.length) parts.push(`teams=${teams.join(',')}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export const budget2027ReportApi = {
  getFilters: () =>
    api.get<Budget2027Filters>('/reports/budget-2027/filters'),

  get: (departments: string[] = [], teams: number[] = []) =>
    api.get<Budget2027Data>(`/reports/budget-2027${buildParams(departments, teams)}`),

  downloadExcel: async (departments: string[] = [], teams: number[] = []) => {
    const response = await api.get(
      `/reports/budget-2027/excel-download${buildParams(departments, teams)}`,
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(
      new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = '2027-Budget-Forecast.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadPdf: async (departments: string[] = [], teams: number[] = []) => {
    const response = await api.get(
      `/reports/budget-2027/pdf-download${buildParams(departments, teams)}`,
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '2027-Budget-Forecast.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
