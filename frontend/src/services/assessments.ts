import api from './api';

export interface AssessmentCriteria {
  // Facility Profile (25 points)
  facilitySize: number;
  complexSystems: number;
  multiShiftOps: number;

  // Decision Authority (25 points)
  directContractorSelection: number;
  accessToDecisionMaker: number;

  // Values Alignment (20 points)
  qualityOverPrice: number;
  safetyCulture: number;
  uptimeCriticality: number;

  // Strategic Fit (20 points)
  prioritySector: number;
  longTermPotential: number;

  // Opportunity Factors (10 points bonus)
  wisconsinConnection: number;
  frustratedWithCurrent: number;
}

export interface CustomerAssessment {
  id: number;
  customer_id: number;
  total_score: number;
  verdict: 'GO' | 'MAYBE' | 'NO_GO';
  tier?: 'A' | 'B' | 'C';
  knockout: boolean;
  knockout_reason?: string;
  criteria: AssessmentCriteria;
  notes?: string;
  assessed_at: string;
  assessed_by?: number;
  updated_at: string;
}

export interface AssessmentStats {
  total: number;
  go: number;
  maybe: number;
  no_go: number;
  tier_a: number;
  tier_b: number;
  tier_c: number;
}

export const assessmentsApi = {
  getCurrent: (customerId: number) =>
    api.get<CustomerAssessment>(`/customer-assessments/${customerId}/assessment`),

  getHistory: (customerId: number) =>
    api.get<CustomerAssessment[]>(`/customer-assessments/${customerId}/assessments`),

  create: (customerId: number, data: Partial<CustomerAssessment>) =>
    api.post<CustomerAssessment>(`/customer-assessments/${customerId}/assessment`, data),

  update: (customerId: number, assessmentId: number, data: Partial<CustomerAssessment>) =>
    api.put<CustomerAssessment>(`/customer-assessments/${customerId}/assessment/${assessmentId}`, data),

  delete: (customerId: number, assessmentId: number) =>
    api.delete(`/customer-assessments/${customerId}/assessment/${assessmentId}`),

  getStats: () =>
    api.get<AssessmentStats>('/customer-assessments/stats'),
};
