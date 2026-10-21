import api from './api';

export interface WeeklyProductionItem {
  id: number;
  name: string;
  row_number: number;
  sort_order: number;
  start_date: string | null;
  end_date: string | null;
  quantity: number | null;
  quantity_installed: number;
  quantity_uom: string | null;
  total_est_hours: number;
  total_est_cost: number;
  total_jtd_hours: number;
  total_jtd_cost: number;
  percent_complete: number;
  contour_type: string;
  cost_types: number[];
  phase_code_ids: number[];
  use_manual_qty_values: boolean;
  manual_monthly_qty: Record<string, number> | null;
}

export interface WeeklyEntry {
  phase_schedule_item_id: number;
  week_ending: string;
  qty_installed: number;
  notes: string | null;
}

export interface HourSnapshot {
  phase_schedule_item_id: number;
  week_ending: string;
  jtd_hours: number;
  jtd_cost: number;
}

export interface WeeklyProductionData {
  items: WeeklyProductionItem[];
  entries: WeeklyEntry[];
  snapshots: HourSnapshot[];
}

export async function getWeeklyProduction(
  projectId: number | string,
  from: string,
  to: string
): Promise<WeeklyProductionData> {
  const res = await api.get(`/weekly-production/project/${projectId}`, { params: { from, to } });
  return res.data;
}

export async function upsertWeeklyEntry(
  projectId: number | string,
  itemId: number,
  weekEnding: string,
  qtyInstalled: number
): Promise<void> {
  await api.put(`/weekly-production/project/${projectId}/entry/${itemId}/${weekEnding}`, {
    qty_installed: qtyInstalled,
  });
}

export async function bulkUpsertWeeklyEntries(
  projectId: number | string,
  rows: { itemId: number; weekEnding: string; qtyInstalled: number }[]
): Promise<void> {
  await api.post(`/weekly-production/project/${projectId}/bulk`, { rows });
}

export async function triggerSnapshot(
  projectId: number | string,
  weekEnding?: string
): Promise<{ rows: number }> {
  const res = await api.post(`/weekly-production/project/${projectId}/snapshot`, {
    week_ending: weekEnding,
  });
  return res.data;
}
