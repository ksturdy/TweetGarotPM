import api from './api';

export interface ContractDetail {
  contractNumber: string;
  description:    string;
  customerName:   string;
  pmName:         string;
  division:       string;
  totalBacklog:   number;
  currentFYRevenue: number;
  futureFYRevenue:  number;
  gmPct:          number;
  currentFYGM:    number;
  futureFYGM:     number;
  totalGM:        number;
  pctComplete:    number;
}

export interface OpportunityDetail {
  id:           number;
  title:        string;
  customerName: string;
  estValue:     number;
  division:     string;
  assignedTo:   string;
  stageName?:   string;
}

export interface BacklogAnalysisData {
  currentFY: number;
  filters: { divisionFilter: string };
  teamFilter: string;
  teamName: string | null;
  availableDivisions: string[];

  currentFYRevenue: number;
  futureFYRevenue:  number;
  totalBacklogRevenue: number;

  currentFYGM: number;
  futureFYGM:  number;
  totalBacklogGM: number;

  monthlySgAndA:    number;
  sgaMode:          string;
  sgaPct:           number;
  sgaMonthsCovered: number | null;
  scenario:         string;
  scenarioMultiplier: number;
  conservativePct:  number;
  aggressivePct:    number;

  backlogSoldNotContracted: number;
  highPotentialBacklog:     number;

  contractDetails:       ContractDetail[];
  awardedNotInVistaOpps: OpportunityDetail[];
  highPotentialOpps:     OpportunityDetail[];
}

export interface BacklogAnalysisSettings {
  monthlySgAndA:   number | null;
  sgaMode:         'dollar' | 'percent';
  sgaPct:          number | null;
  scenario:        'conservative' | 'actual' | 'aggressive';
  conservativePct: number | null;
  aggressivePct:   number | null;
}

export const backlogAnalysisApi = {
  getData: async (division?: string, team?: string): Promise<BacklogAnalysisData> => {
    const params: Record<string, string> = {};
    if (division && division !== 'all') params.division = division;
    if (team     && team !== 'all')     params.team     = team;
    const res = await api.get('/backlog-analysis/data', { params });
    return res.data;
  },

  getPdfUrl: (division?: string, team?: string): string => {
    const base = api.defaults.baseURL || '/api';
    const params = new URLSearchParams();
    if (division && division !== 'all') params.set('division', division);
    if (team     && team !== 'all')     params.set('team', team);
    const qs = params.toString();
    return `${base}/backlog-analysis/pdf${qs ? '?' + qs : ''}`;
  },

  getExcelUrl: (division?: string, team?: string): string => {
    const base = api.defaults.baseURL || '/api';
    const params = new URLSearchParams();
    if (division && division !== 'all') params.set('division', division);
    if (team     && team !== 'all')     params.set('team', team);
    const qs = params.toString();
    return `${base}/backlog-analysis/excel${qs ? '?' + qs : ''}`;
  },

  downloadPdf: async (division?: string, team?: string): Promise<void> => {
    const params: Record<string, string> = {};
    if (division && division !== 'all') params.division = division;
    if (team     && team !== 'all')     params.team     = team;
    const res = await api.get('/backlog-analysis/pdf', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backlog-Analysis-${new Date().toISOString().split('T')[0]}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  downloadExcel: async (division?: string, team?: string): Promise<void> => {
    const params: Record<string, string> = {};
    if (division && division !== 'all') params.division = division;
    if (team     && team !== 'all')     params.team     = team;
    const res = await api.get('/backlog-analysis/excel', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(
      new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backlog-Analysis-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  getSettings: async (): Promise<BacklogAnalysisSettings | null> => {
    const res = await api.get('/tenant/backlog-analysis-settings');
    return res.data;
  },

  saveSettings: async (settings: BacklogAnalysisSettings): Promise<BacklogAnalysisSettings> => {
    const res = await api.put('/tenant/backlog-analysis-settings', settings);
    return res.data;
  },
};
