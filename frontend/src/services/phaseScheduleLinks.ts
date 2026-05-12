import api from './api';

export interface PhaseGCLinkRow {
  id: number;
  project_id: number;
  schedule_item_id: number;
  gc_activity_id: string;
  link_type: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

export const phaseScheduleLinksApi = {
  getActiveVersionId: (projectId: number) =>
    api.get<{ activeVersionId: number | null }>(`/phase-schedule-links/project/${projectId}/active-version`),

  listForItem: (itemId: number) =>
    api.get<PhaseGCLinkRow[]>(`/phase-schedule-links/item/${itemId}`),

  replaceForItem: (itemId: number, gcActivityIds: string[]) =>
    api.put<{ links: { id: number; gc_activity_id: string }[] }>(
      `/phase-schedule-links/item/${itemId}`,
      { gc_activity_ids: gcActivityIds }
    ),

  removeOne: (itemId: number, gcActivityId: string) =>
    api.delete(`/phase-schedule-links/item/${itemId}/activity/${encodeURIComponent(gcActivityId)}`),
};
