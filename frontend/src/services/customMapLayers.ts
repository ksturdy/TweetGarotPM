import api from './api';

const API = '/custom-map-layers';

export interface CustomMapLayer {
  id: number;
  tenant_id: number;
  name: string;
  pin_color: string;
  created_by: number;
  created_by_name: string;
  pin_count: number;
  created_at: string;
  updated_at: string;
}

export interface CustomMapPin {
  id: number;
  layer_id: number;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  notes: string | null;
  geocode_source: string | null;
  created_at: string;
}

export interface UploadResult {
  total_rows: number;
  imported: number;
  skipped: number;
  errors?: string[];
}

export async function getAll(): Promise<CustomMapLayer[]> {
  const { data } = await api.get(API);
  return data;
}

export async function getById(id: number): Promise<CustomMapLayer> {
  const { data } = await api.get(`${API}/${id}`);
  return data;
}

export async function create(layer: { name: string; pin_color: string }): Promise<CustomMapLayer> {
  const { data } = await api.post(API, layer);
  return data;
}

export async function update(id: number, layer: { name: string; pin_color: string }): Promise<CustomMapLayer> {
  const { data } = await api.put(`${API}/${id}`, layer);
  return data;
}

export async function deleteLayer(id: number): Promise<void> {
  await api.delete(`${API}/${id}`);
}

export async function getPins(layerId: number): Promise<CustomMapPin[]> {
  const { data } = await api.get(`${API}/${layerId}/pins`);
  return data;
}

export async function uploadCsv(layerId: number, file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(`${API}/${layerId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function downloadTemplate(): Promise<void> {
  const { data } = await api.get(`${API}/template`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'custom-map-template.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}
