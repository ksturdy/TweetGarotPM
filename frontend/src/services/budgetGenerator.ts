import api from './api';

export interface BudgetOptions {
  buildingTypes: string[];
  projectTypes: string[];
  bidTypes: string[];
}

export interface SimilarProject {
  id: number;
  name: string;
  buildingType: string;
  projectType: string;
  sqft: number;
  totalCost: number;
  costPerSqft: number;
  similarityScore: number;
}

export interface BudgetSectionItem {
  description: string;
  quantity?: number;
  unit?: string;
  hours?: number;
  laborCost?: number;
  materialCost?: number;
  totalCost: number;
  notes?: string;
}

export interface BudgetSection {
  name: string;
  subtotal: number;
  items: BudgetSectionItem[];
}

export interface GeneratedBudget {
  summary: {
    projectName: string;
    buildingType: string;
    projectType: string;
    squareFootage: number;
    estimatedTotalCost: number;
    costPerSquareFoot: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    methodology: string;
  };
  comparableProjects: {
    name: string;
    sqft: number;
    totalCost: number;
    costPerSqft: number;
    relevanceNote: string;
  }[];
  sections: BudgetSection[];
  totals: {
    laborSubtotal: number;
    materialSubtotal: number;
    equipmentSubtotal: number;
    subcontractSubtotal: number;
    directCostSubtotal: number;
    overhead: number;
    profit: number;
    contingency: number;
    grandTotal: number;
  };
  assumptions: string[];
  risks: string[];
}

export interface BudgetGeneratorResponse {
  budget: GeneratedBudget;
  similarProjects: SimilarProject[];
  averages: {
    projectCount: number;
    avgCost: number;
    avgCostPerSqft: number;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface SimilarProjectsResponse {
  similarProjects: any[];
  averages: {
    project_count: number;
    avg_total_cost: number;
    avg_cost_per_sqft: number;
    [key: string]: any;
  };
}

export interface BudgetStats {
  total_projects: number;
  building_types: number;
  project_types: number;
  oldest_project: string;
  newest_project: string;
  avg_cost: number;
  avg_cost_per_sqft: number;
  min_cost: number;
  max_cost: number;
}

export const budgetGeneratorService = {
  async getOptions(): Promise<BudgetOptions> {
    const response = await api.get<BudgetOptions>('/budget-generator/options');
    return response.data;
  },

  async getStats(): Promise<BudgetStats> {
    const response = await api.get<BudgetStats>('/budget-generator/stats');
    return response.data;
  },

  async findSimilar(criteria: {
    buildingType: string;
    projectType: string;
    bidType?: string;
    sqft?: number;
  }): Promise<SimilarProjectsResponse> {
    const response = await api.post<SimilarProjectsResponse>('/budget-generator/similar', criteria);
    return response.data;
  },

  async generate(params: {
    projectName: string;
    buildingType: string;
    projectType: string;
    bidType?: string;
    sqft: number;
    scope?: string;
  }): Promise<BudgetGeneratorResponse> {
    const response = await api.post<BudgetGeneratorResponse>('/budget-generator/generate', params);
    return response.data;
  }
};
