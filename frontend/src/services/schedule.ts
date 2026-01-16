import api from './api';

export interface ScheduleItem {
  id: number;
  project_id: number;
  parent_id: number | null;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  percent_complete: number;
  assigned_to: number;
  assigned_to_name: string;
  created_at: string;
}

export interface ProjectProgress {
  total_items: number;
  average_progress: number;
  completed_items: number;
  project_start: string;
  project_end: string;
}

export const scheduleApi = {
  getByProject: (projectId: number) =>
    api.get<ScheduleItem[]>(`/schedule/project/${projectId}`),

  getProgress: (projectId: number) =>
    api.get<ProjectProgress>(`/schedule/project/${projectId}/progress`),

  getById: (id: number) => api.get<ScheduleItem>(`/schedule/${id}`),

  getChildren: (id: number) => api.get<ScheduleItem[]>(`/schedule/${id}/children`),

  create: (data: Partial<ScheduleItem>) => api.post<ScheduleItem>('/schedule', data),

  update: (id: number, data: Partial<ScheduleItem>) =>
    api.put<ScheduleItem>(`/schedule/${id}`, data),

  updateProgress: (id: number, percentComplete: number) =>
    api.patch<ScheduleItem>(`/schedule/${id}/progress`, { percentComplete }),

  delete: (id: number) => api.delete(`/schedule/${id}`),
};
