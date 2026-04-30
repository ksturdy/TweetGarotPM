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
  created_at: string;
  updated_at: string;
}

export interface EquipmentTypeInfo {
  type: string;
  label: string;
}

export interface StandardTypes {
  hvac: EquipmentTypeInfo[];
  plumbing: EquipmentTypeInfo[];
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
}

export interface AiEquipmentResult {
  type: string;
  label: string;
  count: number;
  confidence: number;
  evidence: string;
  is_custom: boolean;
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
