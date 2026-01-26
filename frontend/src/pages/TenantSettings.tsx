import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getTenant, updateTenant, updateTenantSettings, uploadLogo, deleteLogo, TenantInfo } from '../services/tenant';

const TenantSettings: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    website: '',
  });

  const [brandingForm, setBrandingForm] = useState({
    company_name: '',
    primary_color: '#1976d2',
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: tenant, isLoading } = useQuery<TenantInfo>({
    queryKey: ['tenant'],
    queryFn: getTenant,
  });

  // Update form when tenant data loads
  useEffect(() => {
    if (tenant) {
      setInfoForm({
        name: tenant.name || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        address: tenant.address || '',
        city: tenant.city || '',
        state: tenant.state || '',
        zipCode: tenant.zip_code || '',
        website: tenant.website || '',
      });
      setBrandingForm({
        company_name: tenant.settings?.branding?.company_name || '',
        primary_color: tenant.settings?.branding?.primary_color || '#1976d2',
      });
    }
  }, [tenant]);

  const updateInfoMutation = useMutation({
    mutationFn: updateTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      setEditingInfo(false);
      showSuccess('Company information updated successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Failed to update company information');
    },
  });

  const updateBrandingMutation = useMutation({
    mutationFn: (settings: any) => updateTenantSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      showSuccess('Branding settings updated successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Failed to update branding');
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      showSuccess('Logo uploaded successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Failed to upload logo');
    },
  });

  const deleteLogoMutation = useMutation({
    mutationFn: deleteLogo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      showSuccess('Logo removed successfully');
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Failed to remove logo');
    },
  });

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateInfoMutation.mutate(infoForm);
  };

  const handleBrandingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBrandingMutation.mutate({
      branding: {
        company_name: brandingForm.company_name,
        primary_color: brandingForm.primary_color,
      },
    });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showError('Logo file must be less than 5MB');
        return;
      }
      uploadLogoMutation.mutate(file);
    }
  };

  const handleDeleteLogo = () => {
    if (window.confirm('Are you sure you want to remove the company logo?')) {
      deleteLogoMutation.mutate();
    }
  };

  const isAdmin = user?.role === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Company Settings</h1>

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {errorMessage}
          </div>
        )}

        {/* Logo & Branding Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Logo & Branding</h2>

          <div className="flex items-start gap-8 mb-6">
            {/* Logo Preview */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                {tenant?.settings?.branding?.logo_url ? (
                  <img
                    src={tenant.settings.branding.logo_url}
                    alt="Company logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-gray-400 text-sm text-center px-2">No logo uploaded</span>
                )}
              </div>
            </div>

            {/* Logo Upload Controls */}
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-3">
                Upload your company logo. It will appear in the header when you're logged in.
                Recommended size: 200x200 pixels. Max file size: 5MB.
              </p>

              {isAdmin && (
                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadLogoMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  {tenant?.settings?.branding?.logo_url && (
                    <button
                      onClick={handleDeleteLogo}
                      disabled={deleteLogoMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleteLogoMutation.isPending ? 'Removing...' : 'Remove Logo'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Branding Settings Form */}
          {isAdmin && (
            <form onSubmit={handleBrandingSubmit} className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={brandingForm.company_name}
                    onChange={(e) => setBrandingForm({ ...brandingForm, company_name: e.target.value })}
                    placeholder={tenant?.name || 'Company Name'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional. Override how your company name appears in the app.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={brandingForm.primary_color}
                      onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                      className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
                    />
                    <input
                      type="text"
                      value={brandingForm.primary_color}
                      onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={updateBrandingMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {updateBrandingMutation.isPending ? 'Saving...' : 'Save Branding'}
              </button>
            </form>
          )}
        </div>

        {/* Company Information Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Company Information</h2>
            {isAdmin && !editingInfo && (
              <button
                onClick={() => setEditingInfo(true)}
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-md"
              >
                Edit
              </button>
            )}
          </div>

          {editingInfo ? (
            <form onSubmit={handleInfoSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={infoForm.name}
                    onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={infoForm.email}
                    onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={infoForm.phone}
                    onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={infoForm.website}
                    onChange={(e) => setInfoForm({ ...infoForm, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={infoForm.address}
                    onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={infoForm.city}
                    onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={infoForm.state}
                      onChange={(e) => setInfoForm({ ...infoForm, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={infoForm.zipCode}
                      onChange={(e) => setInfoForm({ ...infoForm, zipCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={updateInfoMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateInfoMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingInfo(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Company Name</span>
                <p className="font-medium">{tenant?.name || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Email</span>
                <p className="font-medium">{tenant?.email || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Phone</span>
                <p className="font-medium">{tenant?.phone || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Website</span>
                <p className="font-medium">{tenant?.website || '-'}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-sm text-gray-500">Address</span>
                <p className="font-medium">
                  {tenant?.address
                    ? `${tenant.address}${tenant.city ? `, ${tenant.city}` : ''}${tenant.state ? `, ${tenant.state}` : ''} ${tenant.zip_code || ''}`
                    : '-'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Plan Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Plan Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Current Plan</span>
              <p className="font-medium text-lg">{tenant?.plan_display_name || tenant?.plan_name || 'Free'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Account Slug</span>
              <p className="font-medium font-mono bg-gray-100 px-2 py-1 rounded inline-block">{tenant?.slug}</p>
            </div>
          </div>

          {tenant?.usage && tenant?.plan_limits && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Usage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Users</span>
                  <p className="font-medium">
                    {tenant.usage.users} / {tenant.plan_limits.max_users === -1 ? 'Unlimited' : tenant.plan_limits.max_users}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Projects</span>
                  <p className="font-medium">
                    {tenant.usage.projects} / {tenant.plan_limits.max_projects === -1 ? 'Unlimited' : tenant.plan_limits.max_projects}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Customers</span>
                  <p className="font-medium">
                    {tenant.usage.customers} / {tenant.plan_limits.max_customers === -1 ? 'Unlimited' : tenant.plan_limits.max_customers}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Opportunities</span>
                  <p className="font-medium">
                    {tenant.usage.opportunities} / {tenant.plan_limits.max_opportunities === -1 ? 'Unlimited' : tenant.plan_limits.max_opportunities}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantSettings;
