import api from './api';

export interface LocationSummary {
  new_opp_count: number;
  new_opp_value: number;
  prev_new_opp_count: number;
  prev_new_opp_value: number;
  activity_count: number;
  prev_activity_count: number;
  call: number;
  meeting: number;
  email: number;
  note: number;
  task: number;
  voice_note: number;
  won_count: number;
  won_value: number;
  lost_count: number;
}

export interface NewOpportunityRow {
  id: number;
  title: string;
  estimated_value: number | null;
  location_group: string;
  stage_name: string;
  stage_color: string;
  assigned_to_name: string;
  customer_name: string;
  created_at: string;
  priority: string;
}

export interface ActivityRow {
  id: number;
  opportunity_id: number;
  opportunity_title: string;
  activity_type: string;
  subject: string;
  created_by_name: string;
  created_at: string;
  is_completed: boolean;
  completed_at: string | null;
}

export interface WonLostRow {
  id: number;
  title: string;
  estimated_value: number | null;
  stage_name: string;
  assigned_to_name: string;
  customer_name: string;
  updated_at: string;
  lost_reason: string | null;
}

export interface LocationData {
  summary: LocationSummary;
  new_opportunities: NewOpportunityRow[];
  activities: ActivityRow[];
  won_lost: WonLostRow[];
}

export interface WeeklySalesData {
  week_start: string;
  week_end: string;
  totals: LocationSummary;
  by_location: Record<string, LocationData>;
}

export const weeklySalesReportApi = {
  getData: (weekStart?: string): Promise<WeeklySalesData> => {
    const params = weekStart ? { week_start: weekStart } : {};
    return api.get<WeeklySalesData>('/reports/weekly-sales', { params }).then(r => r.data);
  },

  downloadPdf: async (weekStart?: string): Promise<void> => {
    const params = weekStart ? { week_start: weekStart } : {};
    const response = await api.get('/reports/weekly-sales/pdf-download', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Weekly-Sales-Report-${weekStart || 'current'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
