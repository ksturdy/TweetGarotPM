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
  departments?: string[];
  statuses?: string[];
  bill_methods?: string[];
  teams?: string[];
  teamNames?: string[];
  phases?: string[];
}

function buildParams(p: PhaseReportParams): URLSearchParams {
  const params = new URLSearchParams();
  if (p.departments && p.departments.length > 0) params.set('departments', p.departments.join(','));
  if (p.statuses && p.statuses.length > 0) params.set('statuses', p.statuses.join(','));
  if (p.bill_methods && p.bill_methods.length > 0) params.set('bill_methods', p.bill_methods.join(','));
  if (p.teams && p.teams.length > 0) params.set('teams', p.teams.join(','));
  if (p.teamNames && p.teamNames.length > 0) params.set('teamNames', p.teamNames.join(','));
  if (p.phases && p.phases.length > 0) params.set('phases', p.phases.join(','));
  return params;
}

export const phaseReportApi = {
  getData: (params: PhaseReportParams = {}) =>
    api.get<PhaseReportRow[]>('/reports/phase-report', { params: buildParams(params) }).then(r => r.data),

  getFilters: (params: PhaseReportParams = {}) =>
    api.get<PhaseReportFilters>('/reports/phase-report/filters', { params: buildParams(params) }).then(r => r.data),

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
