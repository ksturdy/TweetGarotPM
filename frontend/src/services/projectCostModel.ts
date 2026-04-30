import api from './api';

export interface ProjectCostModelMeta {
  id: number;
  project_id: number;
  tenant_id: number;
  total_sqft: number | null;
  building_type: string | null;
  project_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectEquipment {
  id: number;
  project_id: number;
  tenant_id: number;
  equipment_type: string;
  equipment_label: string;
  count: number;
  is_custom: boolean;
  notes: string | null;
  source: 'manual' | 'ai_scan';
  ai_confidence: number | null;
  spec_1_label: string | null;
  spec_1_value: number | null;
  spec_1_unit: string | null;
  spec_2_label: string | null;
  spec_2_value: number | null;
  spec_2_unit: string | null;
  spec_3_label: string | null;
  spec_3_value: number | null;
  spec_3_unit: string | null;
  spec_4_label: string | null;
  spec_4_value: number | null;
  spec_4_unit: string | null;
  spec_5_label: string | null;
  spec_5_value: number | null;
  spec_5_unit: string | null;
  weight_lbs: number | null;
  created_at: string;
  updated_at: string;
}

// A single column definition within a section (maps to a spec_N slot)
export interface SectionColumn {
  slot: number; // 1-5, maps to spec_N_value/label/unit
  label: string;
  unit: string;
}

// Per-section column definitions
export type SectionColumnsMap = Record<string, SectionColumn[]>;

// Equipment type info — which section columns (slots) it uses
export interface EquipmentTypeInfo {
  type: string;
  label: string;
  slots: (number | null)[]; // parallel to section columns; slot number if used, null if not
}

// Per-section equipment lists
export type EquipmentSections = Record<string, EquipmentTypeInfo[]>;

export interface StandardTypes {
  equipment: EquipmentSections;
  columns: SectionColumnsMap;
}

export interface CostModelData {
  meta: ProjectCostModelMeta | null;
  equipment: ProjectEquipment[];
  standardTypes: StandardTypes;
}

export interface EquipmentInput {
  equipment_type: string;
  equipment_label: string;
  count: number;
  is_custom?: boolean;
  notes?: string | null;
  source?: 'manual' | 'ai_scan';
  ai_confidence?: number | null;
  spec_1_label?: string | null;
  spec_1_value?: number | null;
  spec_1_unit?: string | null;
  spec_2_label?: string | null;
  spec_2_value?: number | null;
  spec_2_unit?: string | null;
  spec_3_label?: string | null;
  spec_3_value?: number | null;
  spec_3_unit?: string | null;
  spec_4_label?: string | null;
  spec_4_value?: number | null;
  spec_4_unit?: string | null;
  spec_5_label?: string | null;
  spec_5_value?: number | null;
  spec_5_unit?: string | null;
  weight_lbs?: number | null;
}

// AI scan results — specs keyed by slot
export interface AiEquipmentResult {
  type: string;
  label: string;
  count: number;
  confidence: number;
  evidence: string;
  is_custom: boolean;
  specs: Record<string, number | null>; // e.g. { spec_1: 10000, spec_2: 120, spec_3: 450 }
  weight_lbs: number | null;
}

export interface AiScanResult {
  equipment: AiEquipmentResult[];
  notes: string;
  scannedDrawings: {
    drawingId: number;
    drawingNumber: string;
    success: boolean;
    error?: string;
  }[];
}

export const projectCostModelApi = {
  get: async (projectId: number): Promise<CostModelData> => {
    const response = await api.get(`/projects/${projectId}/cost-model`);
    return response.data.data;
  },

  updateMeta: async (projectId: number, data: {
    total_sqft?: number | null;
    building_type?: string | null;
    project_type?: string | null;
    notes?: string | null;
  }): Promise<ProjectCostModelMeta> => {
    const response = await api.put(`/projects/${projectId}/cost-model`, data);
    return response.data.data;
  },

  updateEquipment: async (projectId: number, items: EquipmentInput[]): Promise<ProjectEquipment[]> => {
    const response = await api.put(`/projects/${projectId}/cost-model/equipment`, { items });
    return response.data.data;
  },

  deleteEquipment: async (projectId: number, equipmentId: number): Promise<void> => {
    await api.delete(`/projects/${projectId}/cost-model/equipment/${equipmentId}`);
  },

  scanDrawings: async (projectId: number, drawingIds: number[]): Promise<AiScanResult> => {
    const response = await api.post(`/projects/${projectId}/cost-model/scan-drawings`, {
      drawing_ids: drawingIds,
    });
    return response.data.data;
  },
};
