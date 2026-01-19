import api from './api';

export interface Vendor {
  id: number;
  vendor_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  payment_terms?: string;
  tax_id?: string;
  w9_on_file?: boolean;
  vendor_type?: string;
  trade_specialty?: string;
  insurance_expiry?: string;
  license_number?: string;
  license_expiry?: string;
  primary_contact?: string;
  accounts_payable_contact?: string;
  accounts_payable_email?: string;
  rating?: number;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: number;
  updated_by?: number;
}

export interface VendorFilters {
  status?: string;
  vendor_type?: string;
  trade_specialty?: string;
  search?: string;
}

export const vendorsService = {
  // Get all vendors with optional filters
  getAll: async (filters?: VendorFilters): Promise<Vendor[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.vendor_type) params.append('vendor_type', filters.vendor_type);
    if (filters?.trade_specialty) params.append('trade_specialty', filters.trade_specialty);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `/vendors?${queryString}` : '/vendors';
    const response = await api.get(url);
    return response.data;
  },

  // Get vendor by ID
  getById: async (id: number): Promise<Vendor> => {
    const response = await api.get(`/vendors/${id}`);
    return response.data;
  },

  // Create new vendor
  create: async (vendorData: Partial<Vendor>): Promise<Vendor> => {
    const response = await api.post('/vendors', vendorData);
    return response.data;
  },

  // Update vendor
  update: async (id: number, vendorData: Partial<Vendor>): Promise<Vendor> => {
    const response = await api.put(`/vendors/${id}`, vendorData);
    return response.data;
  },

  // Delete vendor
  delete: async (id: number): Promise<void> => {
    await api.delete(`/vendors/${id}`);
  },

  // Import vendors from Excel file
  importFromExcel: async (file: File): Promise<{ message: string; count: number; vendors: Vendor[] }> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/vendors/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Download Excel template
  downloadTemplate: async (): Promise<Blob> => {
    const response = await api.get('/vendors/export/template', {
      responseType: 'blob',
    });
    return response.data;
  },
};
