import api from './api';

export interface BudgetSection {
  name: string;
  items: BudgetItem[];
  subtotal: number;
}

export interface BudgetItem {
  description: string;
  quantity?: number;
  unit?: string;
  hours?: number;
  laborCost?: number;
  materialCost?: number;
  equipmentCost?: number;
  subcontractCost?: number;
  totalCost: number;
  notes?: string;
}

export interface ComparableProject {
  name: string;
  building_type: string;
  square_footage: number;
  total_cost: number;
  cost_per_sqft: number;
  year: number;
  similarity_score?: number;
}

export interface Budget {
  id: number;
  tenant_id: number;
  project_name: string;
  building_type: string;
  project_type: string;
  bid_type: string;
  square_footage: number;
  scope_notes: string;
  estimated_total: number;
  cost_per_sqft: number;
  confidence_level: 'high' | 'medium' | 'low';
  methodology: string;
  labor_subtotal: number;
  material_subtotal: number;
  equipment_subtotal: number;
  subcontract_subtotal: number;
  direct_cost_subtotal: number;
  overhead: number;
  profit: number;
  contingency: number;
  grand_total: number;
  overhead_percent: number;
  profit_percent: number;
  contingency_percent: number;
  sections: BudgetSection[];
  assumptions: string[];
  risks: string[];
  comparable_projects: ComparableProject[];
  status: 'draft' | 'final' | 'archived';
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetStats {
  total_budgets: number;
  draft_count: number;
  final_count: number;
  total_value: number;
  avg_value: number;
  avg_cost_per_sqft: number;
}

export interface BudgetFilters {
  status?: string;
  building_type?: string;
  project_type?: string;
  search?: string;
}

export const budgetsApi = {
  getAll: (filters?: BudgetFilters) =>
    api.get<Budget[]>('/budgets', { params: filters }),

  getById: (id: number) =>
    api.get<Budget>(`/budgets/${id}`),

  getStats: () =>
    api.get<BudgetStats>('/budgets/stats'),

  create: (data: Partial<Budget>) =>
    api.post<Budget>('/budgets', data),

  update: (id: number, data: Partial<Budget>) =>
    api.put<Budget>(`/budgets/${id}`, data),

  delete: (id: number) =>
    api.delete(`/budgets/${id}`),
};
