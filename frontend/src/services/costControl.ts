import api from './api';

export type CostType = 'labor_field' | 'labor_shop' | 'material' | 'equipment' | 'subcontract' | 'gen_conditions';

export interface CostControlVersionValue {
  id: number;
  line_item_id: number;
  version_id: number;
  qty: number | null;
  value: number | null;
  notes: string | null;
  actual_cost: number | null;
  pct_complete: number | null;
}

export interface CostControlLineItem {
  id: number;
  matrix_id: number;
  area_id: number | null;
  cost_type: CostType;
  description: string;
  sort_order: number;
  // values keyed by version_id
  values: Record<number, CostControlVersionValue>;
}

export interface CostControlArea {
  id: number;
  matrix_id: number;
  name: string;
  sort_order: number;
  items: CostControlLineItem[];
}

export interface CostControlVersion {
  id: number;
  matrix_id: number;
  version_name: string;
  version_date: string | null;
  sort_order: number;
  is_execution_phase: boolean;
  notes: string | null;
  target_cost: number | null;
  fee_pct: number | null;
  overhead_pct: number | null;
}

export type RiskStatus = 'open' | 'realized' | 'mitigated' | 'closed';

export interface CostControlRiskItem {
  id: number;
  matrix_id: number;
  version_id: number | null;
  type: 'risk' | 'opportunity';
  description: string;
  probability: number | null; // 0-100
  impact: number | null;      // always positive dollar amount
  status: RiskStatus;
  notes: string | null;
  sort_order: number;
}

export interface CostControlMatrix {
  id: number;
  tenant_id: number;
  budget_id: number | null;
  project_id: number | null;
  name: string;
  target_cost: number | null;
  fee_pct: number;
  overhead_pct: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  versions: CostControlVersion[];
  areas: CostControlArea[];
  risks: CostControlRiskItem[];
}

export interface CostControlMatrixSummary {
  id: number;
  name: string;
  budget_id: number | null;
  project_id: number | null;
  budget_name: string | null;
  project_name: string | null;
  target_cost: number | null;
  version_count: number;
  created_at: string;
  updated_at: string;
}

// List all matrices for the current tenant
export async function listMatrices(): Promise<CostControlMatrixSummary[]> {
  const res = await api.get('/cost-control');
  return res.data;
}

// Create a blank matrix (no budget needed)
export async function createBlankMatrix(name: string, targetCost?: number): Promise<{ matrixId: number }> {
  const res = await api.post('/cost-control', { name, target_cost: targetCost || null });
  return res.data;
}

// Check if a matrix exists for a given budget
export async function getMatrixForBudget(budgetId: number): Promise<{ id: number; name: string } | null> {
  const res = await api.get(`/cost-control/budget/${budgetId}`);
  return res.data;
}

// Seed a new matrix from a saved AI budget
export async function createMatrixFromBudget(budgetId: number): Promise<{ matrixId: number; versionId: number }> {
  const res = await api.post(`/cost-control/from-budget/${budgetId}`);
  return res.data;
}

// Check if a matrix exists for a given estimate
export async function getMatrixForEstimate(estimateId: number): Promise<{ id: number; name: string } | null> {
  const res = await api.get(`/cost-control/estimate/${estimateId}`);
  return res.data;
}

// Seed a new matrix from an estimate's sections and line items
export async function createMatrixFromEstimate(estimateId: number): Promise<{ matrixId: number; versionId: number }> {
  const res = await api.post(`/cost-control/from-estimate/${estimateId}`);
  return res.data;
}

// Load full matrix data
export async function getMatrix(matrixId: number): Promise<CostControlMatrix> {
  const res = await api.get(`/cost-control/${matrixId}`);
  return res.data;
}

// Update matrix header fields
export async function updateMatrix(matrixId: number, data: Partial<Pick<CostControlMatrix, 'name' | 'target_cost' | 'fee_pct' | 'overhead_pct'>>): Promise<CostControlMatrix> {
  const res = await api.put(`/cost-control/${matrixId}`, data);
  return res.data;
}

// Link matrix to a project (post-award)
export async function promoteMatrix(matrixId: number, projectId: number): Promise<CostControlMatrix> {
  const res = await api.post(`/cost-control/${matrixId}/promote`, { project_id: projectId });
  return res.data;
}

// Versions
export async function addVersion(matrixId: number, data: Partial<CostControlVersion>): Promise<CostControlVersion> {
  const res = await api.post(`/cost-control/${matrixId}/versions`, data);
  return res.data;
}

export async function updateVersion(matrixId: number, versionId: number, data: Partial<CostControlVersion>): Promise<CostControlVersion> {
  const res = await api.put(`/cost-control/${matrixId}/versions/${versionId}`, data);
  return res.data;
}

export async function deleteVersion(matrixId: number, versionId: number): Promise<void> {
  await api.delete(`/cost-control/${matrixId}/versions/${versionId}`);
}

// Areas
export async function addArea(matrixId: number, name: string): Promise<CostControlArea> {
  const res = await api.post(`/cost-control/${matrixId}/areas`, { name });
  return res.data;
}

export async function updateArea(matrixId: number, areaId: number, name: string): Promise<CostControlArea> {
  const res = await api.put(`/cost-control/${matrixId}/areas/${areaId}`, { name });
  return res.data;
}

export async function deleteArea(matrixId: number, areaId: number): Promise<void> {
  await api.delete(`/cost-control/${matrixId}/areas/${areaId}`);
}

// Line items
export async function addLineItem(matrixId: number, data: Partial<CostControlLineItem>): Promise<CostControlLineItem> {
  const res = await api.post(`/cost-control/${matrixId}/items`, data);
  return res.data;
}

export async function updateLineItem(
  matrixId: number,
  itemId: number,
  data: Partial<Pick<CostControlLineItem, 'description' | 'cost_type' | 'area_id' | 'sort_order'>>
): Promise<CostControlLineItem> {
  const res = await api.put(`/cost-control/${matrixId}/items/${itemId}`, data);
  return res.data;
}

export async function deleteLineItem(matrixId: number, itemId: number): Promise<void> {
  await api.delete(`/cost-control/${matrixId}/items/${itemId}`);
}

// Risk & Opportunity Items
export async function addRiskItem(matrixId: number, data: Partial<CostControlRiskItem>): Promise<CostControlRiskItem> {
  const res = await api.post(`/cost-control/${matrixId}/risks`, data);
  return res.data;
}

export async function updateRiskItem(matrixId: number, riskId: number, data: Partial<CostControlRiskItem>): Promise<CostControlRiskItem> {
  const res = await api.put(`/cost-control/${matrixId}/risks/${riskId}`, data);
  return res.data;
}

export async function deleteRiskItem(matrixId: number, riskId: number): Promise<void> {
  await api.delete(`/cost-control/${matrixId}/risks/${riskId}`);
}

export function calcRiskTotals(risks: CostControlRiskItem[]) {
  const openRisks = risks.filter(r => r.type === 'risk' && r.status === 'open');
  const openOpps  = risks.filter(r => r.type === 'opportunity' && r.status === 'open');
  const riskEV  = openRisks.reduce((s, r) => s + (r.probability != null && r.impact != null ? (r.probability / 100) * Number(r.impact) : 0), 0);
  const oppEV   = openOpps.reduce((s,  r) => s + (r.probability != null && r.impact != null ? (r.probability / 100) * Number(r.impact) : 0), 0);
  return { riskEV, oppEV, netEV: riskEV - oppEV };
}

// Bulk save values for a version
export async function saveVersionValues(
  matrixId: number,
  versionId: number,
  values: Array<Partial<CostControlVersionValue> & { line_item_id: number }>
): Promise<void> {
  await api.put(`/cost-control/${matrixId}/versions/${versionId}/values`, { values });
}

// --- Client-side calculations ---

export const COST_TYPE_LABELS: Record<CostType, string> = {
  labor_field: 'Field Labor',
  labor_shop: 'Shop Labor',
  material: 'Material',
  equipment: 'Equipment',
  subcontract: 'Subcontract',
  gen_conditions: 'General Conditions',
};

export const COST_TYPE_GROUPS: Record<string, CostType[]> = {
  Labor: ['labor_field', 'labor_shop'],
  Material: ['material'],
  Equipment: ['equipment'],
  Subcontracts: ['subcontract'],
  'General Conditions': ['gen_conditions'],
};

// ------------------------------------------------------------------
// Rate / Fee Analysis types and API
// ------------------------------------------------------------------

export interface RateAnalysisConfig {
  matrix_id: number;
  construction_fee_pct: number;  // decimal (0.06 = 6%)
  material_markup_pct: number;
  equipment_markup_pct: number;
  sub_markup_pct: number;
  material_cost: number;
  equipment_cost: number;
  subcontract_cost: number;
  gen_conditions_cost: number;
  fee_applies_labor: boolean;
  fee_applies_material: boolean;
  fee_applies_equipment: boolean;
  fee_applies_subcontract: boolean;
  fee_applies_gc: boolean;
  notes: string | null;
}

export interface RateAnalysisLaborRow {
  id: number | null;
  matrix_id: number;
  trade: string;
  classification: string;
  estimated_hours: number;
  actual_rate: number;
  billable_rate: number;
  sort_order: number;
}

export interface RateAnalysis {
  config: RateAnalysisConfig;
  labor: RateAnalysisLaborRow[];
}

export async function getRateAnalysis(matrixId: number): Promise<RateAnalysis> {
  const res = await api.get(`/cost-control/${matrixId}/rate-analysis`);
  return res.data;
}

export async function saveRateAnalysis(matrixId: number, data: RateAnalysis): Promise<void> {
  await api.put(`/cost-control/${matrixId}/rate-analysis`, data);
}

export function calcVersionTotals(matrix: CostControlMatrix, versionId: number) {
  const totals: Record<string, number> = {
    labor: 0, material: 0, equipment: 0, subcontract: 0, gen_conditions: 0, subtotal: 0,
  };

  for (const area of matrix.areas) {
    for (const item of area.items) {
      const v = item.values[versionId];
      const val = Number(v?.value ?? 0);
      if (item.cost_type === 'labor_field' || item.cost_type === 'labor_shop') totals.labor += val;
      else if (item.cost_type === 'material') totals.material += val;
      else if (item.cost_type === 'equipment') totals.equipment += val;
      else if (item.cost_type === 'subcontract') totals.subcontract += val;
      else if (item.cost_type === 'gen_conditions') totals.gen_conditions += val;
    }
  }

  totals.subtotal = totals.labor + totals.material + totals.equipment + totals.subcontract + totals.gen_conditions;
  const ver = matrix.versions.find(v => v.id === versionId);
  const feePct = ver?.fee_pct != null ? Number(ver.fee_pct) : Number(matrix.fee_pct) || 0;
  const ovhPct = ver?.overhead_pct != null ? Number(ver.overhead_pct) : Number(matrix.overhead_pct) || 0;
  totals.fee = totals.subtotal * feePct;
  totals.overhead = totals.subtotal * ovhPct;
  totals.grand_total = totals.subtotal + totals.fee + totals.overhead;
  totals.fee_pct = feePct;
  totals.overhead_pct = ovhPct;

  return totals;
}
