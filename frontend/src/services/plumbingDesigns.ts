import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const getHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

export interface PlumbingDesign {
  id: number;
  tenant_id: number;
  name: string;
  hub_number: string | null;
  project_id: number | null;
  project_name: string | null;
  project_number: string | null;
  created_by: number;
  created_by_name: string;
  design_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export const plumbingDesignService = {
  list(): Promise<PlumbingDesign[]> {
    return axios.get(`${API_BASE}/plumbing-designs`, getHeaders()).then(r => r.data);
  },

  get(id: number): Promise<PlumbingDesign> {
    return axios.get(`${API_BASE}/plumbing-designs/${id}`, getHeaders()).then(r => r.data);
  },

  create(data: { name: string; hubNumber?: string; projectId?: number; designData?: Record<string, any> }): Promise<PlumbingDesign> {
    return axios.post(`${API_BASE}/plumbing-designs`, data, getHeaders()).then(r => r.data);
  },

  update(id: number, data: { name?: string; hubNumber?: string; projectId?: number; designData?: Record<string, any> }): Promise<PlumbingDesign> {
    return axios.put(`${API_BASE}/plumbing-designs/${id}`, data, getHeaders()).then(r => r.data);
  },

  delete(id: number): Promise<void> {
    return axios.delete(`${API_BASE}/plumbing-designs/${id}`, getHeaders()).then(() => undefined);
  },
};
