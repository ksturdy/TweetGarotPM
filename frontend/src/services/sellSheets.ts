import api from './api';

export interface SellSheet {
  id: number;
  tenant_id: number;
  service_name: string;
  title?: string;
  subtitle?: string;
  layout_style: 'full_width' | 'two_column';
  overview?: string;
  content?: string;
  sidebar_content?: string;
  page2_content?: string;
  footer_content?: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  display_order?: number;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  image_count?: number;
  images?: { id: number; file_path: string; image_url?: string; is_hero_image: boolean; caption?: string }[];
}

export interface SellSheetImage {
  id: number;
  sell_sheet_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  caption?: string;
  display_order: number;
  is_hero_image: boolean;
  uploaded_at: string;
}

export const sellSheetsApi = {
  getAll: (filters?: { status?: string; service_name?: string; featured?: boolean }) =>
    api.get<SellSheet[]>('/sell-sheets', { params: filters }),

  getById: (id: number) =>
    api.get<SellSheet & { images: SellSheetImage[] }>(`/sell-sheets/${id}`),

  create: (data: Partial<SellSheet>) => api.post<SellSheet>('/sell-sheets', data),

  update: (id: number, data: Partial<SellSheet>) =>
    api.put<SellSheet>(`/sell-sheets/${id}`, data),

  delete: (id: number) => api.delete(`/sell-sheets/${id}`),

  // Workflow
  publish: (id: number) => api.patch<SellSheet>(`/sell-sheets/${id}/publish`),
  archive: (id: number) => api.patch<SellSheet>(`/sell-sheets/${id}/archive`),
  unarchive: (id: number) => api.patch<SellSheet>(`/sell-sheets/${id}/unarchive`),

  // Images
  uploadImage: (sellSheetId: number, formData: FormData) =>
    api.post<SellSheetImage>(`/sell-sheets/${sellSheetId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateImage: (imageId: number, data: Partial<SellSheetImage>) =>
    api.put<SellSheetImage>(`/sell-sheets/images/${imageId}`, data),

  deleteImage: (imageId: number) => api.delete(`/sell-sheets/images/${imageId}`),

  // PDF
  downloadPdf: (id: number) =>
    api.get(`/sell-sheets/${id}/pdf-download`, { responseType: 'blob' }),
};
