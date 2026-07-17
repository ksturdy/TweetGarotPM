import api from './api';

export interface MapMarketGroup {
  id: number;
  tenant_id: number;
  name: string;
  pin_color: string;
  sort_order: number;
  created_by: number;
  created_by_name: string;
  markets: string[];
  created_at: string;
  updated_at: string;
}

const BASE = '/map-market-groups';

export async function getAll(): Promise<MapMarketGroup[]> {
  const { data } = await api.get<MapMarketGroup[]>(BASE);
  return data;
}

export async function getById(id: number): Promise<MapMarketGroup> {
  const { data } = await api.get<MapMarketGroup>(`${BASE}/${id}`);
  return data;
}

export async function create(payload: {
  name: string;
  pin_color: string;
  markets: string[];
  sort_order?: number;
}): Promise<MapMarketGroup> {
  const { data } = await api.post<MapMarketGroup>(BASE, payload);
  return data;
}

export async function update(
  id: number,
  payload: { name: string; pin_color: string; markets: string[]; sort_order?: number }
): Promise<MapMarketGroup> {
  const { data } = await api.put<MapMarketGroup>(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}
