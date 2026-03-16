import api from './api';

// ─── Types ───

export interface AssemblyTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description: string;
  category: string;
  bounding_box: { width: number; height: number };
  runs: AssemblyRun[];
  placed_items: AssemblyPlacedItem[];
  connection_points: AssemblyConnectionPoint[];
  thumbnail_data_url: string | null;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AssemblyRun {
  localId: string;
  config: Record<string, unknown>;
  segments: Record<string, unknown>[];
  branches: Record<string, unknown>[];
  fittingCounts: Record<string, number>;
  totalScaledLength: number;
  totalPixelLength: number;
  verticalPipeLength: number;
  branchParentPipeSize: { nominal: string; nominalInches: number; displayLabel: string } | null;
}

export interface AssemblyPlacedItem {
  localId: string;
  category: string;
  componentType: string;
  label: string;
  description: string;
  size?: string;
  material?: string;
  unit: string;
  relativePosition: { x: number; y: number };
  renderMeta: Record<string, unknown>;
  snapLocalRunId?: string;
  snapSegmentId?: string;
  fittingType?: string;
  jointType?: string;
  pipeMaterial?: string;
}

export interface AssemblyConnectionPoint {
  id: string;
  relativePosition: { x: number; y: number };
  localRunId: string;
  endpoint: 'start' | 'end';
  label: string;
}

export interface AssemblyInstance {
  id: number;
  tenant_id: number;
  takeoff_id: number;
  assembly_template_id: number;
  assembly_name: string;
  origin: { x: number; y: number };
  document_id: number | null;
  page_number: number | null;
  run_ids: number[];
  item_ids: number[];
  template_name?: string;
  template_category?: string;
  created_at: string;
  updated_at: string;
}

// ─── Assembly Templates API ───

export const assemblyTemplatesApi = {
  getAll: (category?: string) =>
    api.get<AssemblyTemplate[]>('/assembly-templates', {
      params: category ? { category } : undefined,
    }),

  getCategories: () =>
    api.get<string[]>('/assembly-templates/categories'),

  getById: (id: number) =>
    api.get<AssemblyTemplate>(`/assembly-templates/${id}`),

  create: (data: Partial<AssemblyTemplate>) =>
    api.post<AssemblyTemplate>('/assembly-templates', data),

  update: (id: number, data: Partial<AssemblyTemplate>) =>
    api.put<AssemblyTemplate>(`/assembly-templates/${id}`, data),

  duplicate: (id: number, name?: string) =>
    api.post<AssemblyTemplate>(`/assembly-templates/${id}/duplicate`, { name }),

  delete: (id: number) =>
    api.delete(`/assembly-templates/${id}`),
};

// ─── Assembly Instances API (per-takeoff) ───

export const assemblyInstancesApi = {
  getByTakeoff: (takeoffId: number) =>
    api.get<AssemblyInstance[]>(`/takeoffs/${takeoffId}/assemblies`),

  getByDocumentPage: (takeoffId: number, documentId: number, pageNumber: number) =>
    api.get<AssemblyInstance[]>(`/takeoffs/${takeoffId}/assemblies`, {
      params: { document_id: documentId, page_number: pageNumber },
    }),

  getById: (takeoffId: number, instanceId: number) =>
    api.get<AssemblyInstance>(`/takeoffs/${takeoffId}/assemblies/${instanceId}`),

  create: (takeoffId: number, data: Partial<AssemblyInstance>) =>
    api.post<AssemblyInstance>(`/takeoffs/${takeoffId}/assemblies`, data),

  update: (takeoffId: number, instanceId: number, data: Partial<AssemblyInstance>) =>
    api.put<AssemblyInstance>(`/takeoffs/${takeoffId}/assemblies/${instanceId}`, data),

  delete: (takeoffId: number, instanceId: number) =>
    api.delete(`/takeoffs/${takeoffId}/assemblies/${instanceId}`),
};
