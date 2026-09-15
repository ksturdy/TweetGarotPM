import api from './api';

export type ObservationAnswer = 'yes' | 'no' | 'na' | null;

export interface ObservationItem {
  key: string;
  label: string;
  answer: ObservationAnswer;
}

export interface ObservationSection {
  area: string;
  items: ObservationItem[];
  comments: string;
}

export interface SafetyObservation {
  id: number;
  project_id: number;
  tenant_id: number;
  number: number;
  observer_id: number;
  observer_name: string;
  date_of_observation: string;
  stretch_and_flex: boolean | null;
  feedback_notes: string | null;
  sections: ObservationSection[];
  status: 'draft' | 'submitted' | 'reviewed';
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_by: number;
  project_name?: string;
  project_number?: string;
  created_at: string;
  updated_at: string;
}

export const safetyObservationsApi = {
  getByProject: (projectId: number, filters?: { status?: string }) =>
    api.get<SafetyObservation[]>(`/safety-observations/project/${projectId}`, { params: filters }),

  getAll: (filters?: { status?: string; project_id?: number }) =>
    api.get<SafetyObservation[]>('/safety-observations', { params: filters }),

  getStats: () =>
    api.get<{ open: number }>('/safety-observations/stats'),

  getById: (id: number) =>
    api.get<SafetyObservation>(`/safety-observations/${id}`),

  create: (data: {
    project_id: number;
    date_of_observation: string;
    sections: ObservationSection[];
    stretch_and_flex: boolean | null;
    feedback_notes: string;
    status?: string;
  }) => api.post<SafetyObservation>('/safety-observations', data),

  update: (id: number, data: Partial<{
    date_of_observation: string;
    sections: ObservationSection[];
    stretch_and_flex: boolean | null;
    feedback_notes: string;
    status: string;
  }>) => api.put<SafetyObservation>(`/safety-observations/${id}`, data),

  review: (id: number) =>
    api.post<SafetyObservation>(`/safety-observations/${id}/review`),

  delete: (id: number) =>
    api.delete(`/safety-observations/${id}`),

  downloadPdf: async (id: number): Promise<Blob> => {
    const res = await api.get(`/safety-observations/${id}/pdf`, { responseType: 'blob' });
    return res.data;
  },
};

// ──────────────────────────────────────────────────
// Audit area definitions (single source of truth)
// ──────────────────────────────────────────────────

export interface AuditAreaDef {
  key: string;
  label: string;
  items: { key: string; label: string }[];
  commentsLabel: string;
}

export const AUDIT_AREAS: AuditAreaDef[] = [
  {
    key: 'preplanning',
    label: 'Preplanning & Safety Documentation',
    commentsLabel: 'Other safety documentation audited? Comments:',
    items: [
      { key: 'sta_completed',   label: 'A STA/PHA/JSA for today is completed and available' },
      { key: 'sta_signed',      label: "Today's STA/PHA/JSA is signed by all workers" },
      { key: 'sta_thorough',    label: 'The STA/PHA/JSA is thorough and includes all hazards' },
      { key: 'tbt_completed',   label: 'Tool Box Talk was completed and returned to office email' },
      { key: 'tbt_recalled',    label: 'Tool Box Talk topic can be recalled and summarized' },
    ],
  },
  {
    key: 'housekeeping',
    label: 'Housekeeping',
    commentsLabel: 'Other Housekeeping items you audited? Comments:',
    items: [
      { key: 'cords_routed',        label: 'All cords off the floor, routed without a trip hazard' },
      { key: 'benches_clear',       label: 'All benches/work tables are free of shavings/excess materials' },
      { key: 'materials_stored',    label: 'Materials/ladders/pallets are not leaning' },
      { key: 'floors_clean',        label: 'Floors are clean/swept' },
      { key: 'trash_cans_ok',       label: 'Debris is in trash cans which are not overflowing' },
      { key: 'fall_protect_stored', label: 'Fall protection not in use is hung up/stored to protect it' },
    ],
  },
  {
    key: 'ppe',
    label: 'Proper Use of PPE',
    commentsLabel: 'Other PPE audited? Comments:',
    items: [
      { key: 'safety_glasses', label: 'Safety glasses are being worn' },
      { key: 'hard_hats',      label: 'Hard hats/helmets are being worn' },
      { key: 'gloves',         label: 'Gloves are worn and appropriate kind' },
      { key: 'hi_vis',         label: 'High Visibility clothing/vest is worn' },
      { key: 'hearing_prot',   label: 'Hearing protection is available and worn' },
      { key: 'grinding_shield', label: 'Grinding shield is in good condition' },
    ],
  },
  {
    key: 'heights',
    label: 'Working at Heights',
    commentsLabel: 'Other Working at Heights observations:',
    items: [
      { key: 'ladder_level',    label: 'Ladders are on level ground and fully open' },
      { key: 'ext_ladder_tied', label: "Extension ladder is extended 3' above landing and tied off" },
      { key: 'lift_inspected',  label: 'Lift was inspected today before use' },
      { key: 'tied_off',        label: "Employee is tied off above 6' (4' if site required)" },
      { key: 'harness_fitted',  label: 'Harness is fitted properly snug, D ring between shoulders' },
      { key: 'rescue_plan_doc', label: 'Rescue Plan is documented on daily pre-planning docs' },
      { key: 'rescue_plan_known', label: 'Rescue Plan is achievable and well known by crew' },
    ],
  },
  {
    key: 'welding',
    label: 'Welding/Hot Work',
    commentsLabel: 'Other Hot Work observations:',
    items: [
      { key: 'hot_work_permit',  label: 'Hot Work Permit is issued and posted' },
      { key: 'face_shield',      label: 'Face Shield/Welding Hood is used' },
      { key: 'fire_ext',         label: 'Fire Extinguisher is inspected and available' },
      { key: 'fire_watch',       label: 'Fire Watch is attentive' },
      { key: 'others_shielded',  label: 'Other employees are shielded from sparks/flash' },
    ],
  },
  {
    key: 'material_handling',
    label: 'Material Handling',
    commentsLabel: 'Other Material Handling observations:',
    items: [
      { key: 'forklift_inspected', label: 'Fork Truck/Crane was inspected before use' },
      { key: 'tag_line',           label: 'Equipment/Materials being lifted has a tag line' },
      { key: 'rigging_inspected',  label: 'Rigging has been inspected today before use' },
      { key: 'spotter',            label: 'Spotter is being used' },
      { key: 'stretch_flex',       label: 'Stretch & Flex completed before manual lifting' },
    ],
  },
  {
    key: 'power_tools',
    label: 'Hand and Power Tool Usage',
    commentsLabel: 'Other Hand and Power Tool observations:',
    items: [
      { key: 'right_tool',    label: 'Tool used is the best tool for the job' },
      { key: 'good_condition', label: 'Tools are in good condition' },
      { key: 'cords_inspected', label: 'Tool cords and plugs are inspected' },
      { key: 'guards',          label: 'All mechanical guards and handles are in place' },
      { key: 'hand_position',   label: 'Hands are in proper positions when using tool (not in Line of Fire)' },
    ],
  },
];

export const AUDIT_AREA_MAP: Record<string, AuditAreaDef> = Object.fromEntries(
  AUDIT_AREAS.map(a => [a.key, a])
);

export function buildBlankSection(areaKey: string): ObservationSection {
  const def = AUDIT_AREA_MAP[areaKey];
  if (!def) throw new Error(`Unknown area: ${areaKey}`);
  return {
    area: areaKey,
    items: def.items.map(i => ({ key: i.key, label: i.label, answer: null })),
    comments: '',
  };
}

export function scoreSection(section: ObservationSection): { yes: number; no: number; na: number; total: number } {
  let yes = 0, no = 0, na = 0;
  for (const item of section.items) {
    if (item.answer === 'yes') yes++;
    else if (item.answer === 'no') no++;
    else if (item.answer === 'na') na++;
  }
  return { yes, no, na, total: section.items.length };
}
