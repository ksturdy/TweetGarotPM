import api from './api';

export interface GCScheduleVersion {
  id: number;
  tenant_id: number;
  project_id: number;
  version_label: string | null;
  schedule_date: string | null;
  source_filename: string | null;
  source_format: string;
  notes: string | null;
  activity_count: number;
  parse_status: 'pending' | 'parsing' | 'completed' | 'failed';
  parse_error: string | null;
  uploaded_by: number | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

export interface GCScheduleActivity {
  id: number;
  version_id: number;
  activity_id: string | null;
  activity_name: string;
  wbs_code: string | null;
  wbs_path: string | null;
  start_date: string | null;
  finish_date: string | null;
  baseline_start: string | null;
  baseline_finish: string | null;
  duration_days: string | null;
  percent_complete: string | null;
  status: string | null;
  predecessors: string | null;
  successors: string | null;
  responsible: string | null;
  trade: string | null;
  is_mechanical: boolean;
  mechanical_override: boolean;
  is_milestone: boolean;
  is_summary: boolean;
  display_order: number;
}

export interface ActivityFilters {
  mechanicalOnly?: boolean;
  trade?: string;
  search?: string;
  startAfter?: string;
  endBefore?: string;
  hideSummary?: boolean;
}

export interface DiffResult {
  added: GCScheduleActivity[];
  removed: GCScheduleActivity[];
  changed: Array<{
    activity_id: string;
    name: string;
    is_mechanical: boolean;
    wbs_code: string | null;
    diffs: Record<string, { from: unknown; to: unknown }>;
  }>;
}

export const gcSchedulesApi = {
  upload: (projectId: number, file: File, opts?: { versionLabel?: string; scheduleDate?: string; notes?: string }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.versionLabel) fd.append('versionLabel', opts.versionLabel);
    if (opts?.scheduleDate) fd.append('scheduleDate', opts.scheduleDate);
    if (opts?.notes) fd.append('notes', opts.notes);
    return api.post<{ version: GCScheduleVersion; warnings: string[] }>(
      `/gc-schedules/project/${projectId}/upload`,
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  listVersions: (projectId: number) =>
    api.get<GCScheduleVersion[]>(`/gc-schedules/project/${projectId}/versions`),

  getActivities: (versionId: number, filters: ActivityFilters = {}) => {
    const params: Record<string, string> = {};
    if (filters.mechanicalOnly) params.mechanical_only = 'true';
    if (filters.trade) params.trade = filters.trade;
    if (filters.search) params.search = filters.search;
    if (filters.startAfter) params.start_after = filters.startAfter;
    if (filters.endBefore) params.end_before = filters.endBefore;
    if (filters.hideSummary) params.hide_summary = 'true';
    return api.get<{ version: GCScheduleVersion; activities: GCScheduleActivity[] }>(
      `/gc-schedules/versions/${versionId}/activities`,
      { params }
    );
  },

  toggleMechanical: (activityId: number, isMechanical: boolean) =>
    api.patch<GCScheduleActivity>(`/gc-schedules/activities/${activityId}/mechanical`, { isMechanical }),

  diff: (projectId: number, versionAId: number, versionBId: number) =>
    api.get<{ a: GCScheduleVersion; b: GCScheduleVersion; diff: DiffResult }>(
      `/gc-schedules/project/${projectId}/diff`,
      { params: { a: versionAId, b: versionBId } }
    ),

  deleteVersion: (versionId: number) =>
    api.delete(`/gc-schedules/versions/${versionId}`),
};
