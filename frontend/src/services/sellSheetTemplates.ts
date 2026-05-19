import api from './api';

export interface SellSheetLayoutSection {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  column?: 'left' | 'right';
}

export interface SellSheetLayoutConfig {
  sections: SellSheetLayoutSection[];
  page_size?: string;
  orientation?: string;
  layout_style?: 'full_width' | 'two_column';
}

export interface SellSheetTemplate {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  category?: string;
  layout_config: SellSheetLayoutConfig;
  color_scheme: string;
  show_logo: boolean;
  show_hero_image: boolean;
  show_images: boolean;
  show_footer: boolean;
  is_default: boolean;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export const sellSheetTemplatesApi = {
  getAll: (filters?: { category?: string; is_active?: boolean }) =>
    api.get<SellSheetTemplate[]>('/sell-sheet-templates', { params: filters }),

  getById: (id: number) =>
    api.get<SellSheetTemplate>(`/sell-sheet-templates/${id}`),

  getDefault: () =>
    api.get<SellSheetTemplate>('/sell-sheet-templates/default'),

  getCategories: () =>
    api.get<string[]>('/sell-sheet-templates/categories'),

  create: (data: Partial<SellSheetTemplate>) =>
    api.post<SellSheetTemplate>('/sell-sheet-templates', data),

  update: (id: number, data: Partial<SellSheetTemplate>) =>
    api.put<SellSheetTemplate>(`/sell-sheet-templates/${id}`, data),

  delete: (id: number) =>
    api.delete(`/sell-sheet-templates/${id}`),
};
