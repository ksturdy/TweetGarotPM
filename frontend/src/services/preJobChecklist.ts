import api from './api';

export interface TeamMember {
  id: string;
  role: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface KeyDate {
  id: string;
  label: string;
  date: string;
}

export interface OtherContact {
  id: string;
  role: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface ProjectInfoData {
  team_members?: TeamMember[];
  other_contacts?: OtherContact[];
  key_dates?: KeyDate[];
  special_conditions?: string;
  bid_scope_notes?: string;
}

export interface LaborTradeRow {
  id: string;
  trade: string;
  goal_hours?: number;
  target_rate?: number;
  notes?: string;
}

export interface LaborData {
  approach_notes?: string;
  trades?: LaborTradeRow[];
}

export interface MaterialItemRow {
  id: string;
  description: string;
  budget?: number;
  vendor?: string;
  lead_time?: string;
  notes?: string;
}

export interface MaterialData {
  approach_notes?: string;
  items?: MaterialItemRow[];
}

export interface SubcontractItemRow {
  id: string;
  description: string;
  subcontractor?: string;
  budget?: number;
  scope?: string;
  notes?: string;
}

export interface SubcontractsData {
  approach_notes?: string;
  items?: SubcontractItemRow[];
}

export interface GenericItemRow {
  id: string;
  description: string;
  budget?: number;
  notes?: string;
}

export interface GenericSectionData {
  approach_notes?: string;
  items?: GenericItemRow[];
}

export interface OrientationData {
  badge_required?: boolean;
  orientation_required?: boolean;
  safety_training_required?: boolean;
  orientation_link?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  directions?: string;
  parking_notes?: string;
  site_map_attachment_id?: number;
  site_map_filename?: string;
}

export interface PreJobChecklist {
  id?: number;
  project_id?: number;
  project_info: ProjectInfoData;
  labor: LaborData;
  material: MaterialData;
  subcontracts: SubcontractsData;
  rental: GenericSectionData;
  mep_equipment: GenericSectionData;
  general_conditions: GenericSectionData;
  orientation: OrientationData;
}

export type ChecklistSection = keyof Omit<PreJobChecklist, 'id' | 'project_id'>;

const EMPTY_CHECKLIST: PreJobChecklist = {
  project_info: {},
  labor: {},
  material: {},
  subcontracts: {},
  rental: {},
  mep_equipment: {},
  general_conditions: {},
  orientation: {},
};

export interface ReadinessResult {
  vistaLinked: boolean;
  vistaContractNumber: string | null;
  hasProjection: boolean;
  ready: boolean;
}

export const preJobChecklistApi = {
  async get(projectId: number): Promise<PreJobChecklist> {
    const { data } = await api.get(`/pre-job-checklist/project/${projectId}`);
    return { ...EMPTY_CHECKLIST, ...data };
  },

  async updateSection(projectId: number, section: ChecklistSection, sectionData: any): Promise<PreJobChecklist> {
    const { data } = await api.put(`/pre-job-checklist/project/${projectId}/section/${section}`, sectionData);
    return { ...EMPTY_CHECKLIST, ...data };
  },

  async readiness(projectId: number): Promise<ReadinessResult> {
    const { data } = await api.get(`/pre-job-checklist/project/${projectId}/readiness`);
    return data;
  },
};
