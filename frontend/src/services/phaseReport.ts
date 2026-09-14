import api from './api';

export interface PhaseReportRow {
  job_number: string;
  job_name: string | null;
  phase_code: string | null;
  phase_name: string | null;
  department_code: string | null;
  status: string | null;
  bill_method: string | null;
  manager_name: string | null;
  est_hours: number | null;
  jtd_hours: number | null;
}

export interface PhaseReportFilters {
  departments: string[];
  statuses: string[];
  billMethods: string[];
  phases: string[];
}

export interface PhaseReportParams {
  department?: string;
  status?: string;
  bill_method?: string;
  team?: string;
  teamName?: string;
  phases?: string[];
}

function buildParams(p: PhaseReportParams): URLSearchParams {
  const params = new URLSearchParams();
  if (p.department) params.set('department', p.department);
  if (p.status) params.set('status', p.status);
  if (p.bill_method) params.set('bill_method', p.bill_method);
  if (p.team) params.set('team', p.team);
  if (p.teamName) params.set('teamName', p.teamName);
  if (p.phases && p.phases.length > 0) params.set('phases', p.phases.join(','));
  return params;
}

export const phaseReportApi = {
  getData: (params: PhaseReportParams = {}) =>
    api.get<PhaseReportRow[]>('/reports/phase-report', { params: buildParams(params) }).then(r => r.data),

  getFilters: () =>
    api.get<PhaseReportFilters>('/reports/phase-report/filters').then(r => r.data),

  downloadPdf: async (params: PhaseReportParams = {}) => {
    const res = await api.get('/reports/phase-report/pdf-download', {
      params: buildParams(params),
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Phase-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadExcel: async (params: PhaseReportParams = {}) => {
    const res = await api.get('/reports/phase-report/excel-download', {
      params: buildParams(params),
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Phase-Report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
