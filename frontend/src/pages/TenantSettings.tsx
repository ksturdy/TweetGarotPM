import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getTenant, updateTenant, updateTenantSettings, uploadLogo, deleteLogo, TenantInfo } from '../services/tenant';
import ImageCropper from '../components/common/ImageCropper';
import '../components/common/ImageCropper.css';
import '../styles/SalesPipeline.css';

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
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('');

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
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setOriginalFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const fileName = originalFileName.replace(/\.[^/.]+$/, '') + '_cropped.png';
    const croppedFile = new File([croppedBlob], fileName, { type: 'image/png' });
    uploadLogoMutation.mutate(croppedFile);
    setImageToCrop(null);
    setOriginalFileName('');
  };

  const handleCropCancel = () => {
    setImageToCrop(null);
    setOriginalFileName('');
  };

  const handleDeleteLogo = () => {
    if (window.confirm('Are you sure you want to remove the company logo?')) {
      deleteLogoMutation.mutate();
    }
  };

  const isAdmin = user?.role === 'admin';

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>Company Settings</h1>
            <div className="sales-subtitle">Manage your company information and branding</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-rose)',
          color: 'var(--accent-rose)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          {errorMessage}
        </div>
      )}

      {/* Logo & Branding Section */}
      <div className="sales-chart-card" style={{ marginBottom: '20px' }}>
        <div className="sales-chart-header">
          <div>
            <div className="sales-chart-title">Logo & Branding</div>
            <div className="sales-chart-subtitle">Customize your company appearance</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', marginBottom: '24px' }}>
          {/* Logo Preview */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: '128px',
              height: '128px',
              border: '2px dashed var(--border)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              background: 'var(--bg-dark)'
            }}>
              {tenant?.settings?.branding?.logo_url ? (
                <img
                  src={tenant.settings.branding.logo_url}
                  alt="Company logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '8px' }}>No logo uploaded</span>
              )}
            </div>
          </div>

          {/* Logo Upload Controls */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Upload your company logo. It will appear in the header when you're logged in.
              Recommended size: 200x200 pixels. Max file size: 5MB.
            </p>

            {isAdmin && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLogoMutation.isPending}
                  className="sales-btn sales-btn-primary"
                >
                  {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                </button>
                {tenant?.settings?.branding?.logo_url && (
                  <button
                    onClick={handleDeleteLogo}
                    disabled={deleteLogoMutation.isPending}
                    className="sales-btn"
                    style={{ background: 'var(--accent-rose)', color: 'white' }}
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
          <form onSubmit={handleBrandingSubmit} style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={brandingForm.company_name}
                  onChange={(e) => setBrandingForm({ ...brandingForm, company_name: e.target.value })}
                  placeholder={tenant?.name || 'Company Name'}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Optional. Override how your company name appears in the app.
                </p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Primary Color
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="color"
                    value={brandingForm.primary_color}
                    onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                    style={{ width: '48px', height: '40px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={brandingForm.primary_color}
                    onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={updateBrandingMutation.isPending}
              className="sales-btn sales-btn-primary"
            >
              {updateBrandingMutation.isPending ? 'Saving...' : 'Save Branding'}
            </button>
          </form>
        )}
      </div>

      {/* Company Information Section */}
      <div className="sales-chart-card" style={{ marginBottom: '20px' }}>
        <div className="sales-chart-header">
          <div>
            <div className="sales-chart-title">Company Information</div>
            <div className="sales-chart-subtitle">Your company contact details</div>
          </div>
          {isAdmin && !editingInfo && (
            <button
              onClick={() => setEditingInfo(true)}
              className="sales-btn sales-btn-secondary"
            >
              Edit
            </button>
          )}
        </div>

        {editingInfo ? (
          <form onSubmit={handleInfoSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  value={infoForm.name}
                  onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={infoForm.email}
                  onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={infoForm.phone}
                  onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Website
                </label>
                <input
                  type="url"
                  value={infoForm.website}
                  onChange={(e) => setInfoForm({ ...infoForm, website: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Address
                </label>
                <input
                  type="text"
                  value={infoForm.address}
                  onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  City
                </label>
                <input
                  type="text"
                  value={infoForm.city}
                  onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    State
                  </label>
                  <input
                    type="text"
                    value={infoForm.state}
                    onChange={(e) => setInfoForm({ ...infoForm, state: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={infoForm.zipCode}
                    onChange={(e) => setInfoForm({ ...infoForm, zipCode: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-dark)' }}
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={updateInfoMutation.isPending}
                className="sales-btn sales-btn-primary"
              >
                {updateInfoMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingInfo(false)}
                className="sales-btn sales-btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Company Name</span>
              <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>{tenant?.name || '-'}</p>
            </div>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Email</span>
              <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>{tenant?.email || '-'}</p>
            </div>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Phone</span>
              <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>{tenant?.phone || '-'}</p>
            </div>
            <div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Website</span>
              <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>{tenant?.website || '-'}</p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Address</span>
              <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>
                {tenant?.address
                  ? `${tenant.address}${tenant.city ? `, ${tenant.city}` : ''}${tenant.state ? `, ${tenant.state}` : ''} ${tenant.zip_code || ''}`
                  : '-'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Plan Information */}
      <div className="sales-chart-card">
        <div className="sales-chart-header">
          <div>
            <div className="sales-chart-title">Plan Information</div>
            <div className="sales-chart-subtitle">Your current subscription details</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Current Plan</span>
            <p style={{ fontWeight: 600, fontSize: '18px', margin: '4px 0 0 0', color: 'var(--accent-blue)' }}>
              {tenant?.plan_display_name || tenant?.plan_name || 'Free'}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Account Slug</span>
            <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>
              <code style={{ background: 'var(--bg-dark)', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>
                {tenant?.slug}
              </code>
            </p>
          </div>
        </div>

        {tenant?.usage && tenant?.plan_limits && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>Usage</h3>
            <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="sales-kpi-card blue" style={{ padding: '16px' }}>
                <div className="sales-kpi-label">Users</div>
                <div className="sales-kpi-value" style={{ fontSize: '24px' }}>
                  {tenant.usage.users} / {tenant.plan_limits.max_users === -1 ? '∞' : tenant.plan_limits.max_users}
                </div>
              </div>
              <div className="sales-kpi-card green" style={{ padding: '16px' }}>
                <div className="sales-kpi-label">Projects</div>
                <div className="sales-kpi-value" style={{ fontSize: '24px' }}>
                  {tenant.usage.projects} / {tenant.plan_limits.max_projects === -1 ? '∞' : tenant.plan_limits.max_projects}
                </div>
              </div>
              <div className="sales-kpi-card amber" style={{ padding: '16px' }}>
                <div className="sales-kpi-label">Customers</div>
                <div className="sales-kpi-value" style={{ fontSize: '24px' }}>
                  {tenant.usage.customers} / {tenant.plan_limits.max_customers === -1 ? '∞' : tenant.plan_limits.max_customers}
                </div>
              </div>
              <div className="sales-kpi-card purple" style={{ padding: '16px' }}>
                <div className="sales-kpi-label">Opportunities</div>
                <div className="sales-kpi-value" style={{ fontSize: '24px' }}>
                  {tenant.usage.opportunities} / {tenant.plan_limits.max_opportunities === -1 ? '∞' : tenant.plan_limits.max_opportunities}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Cropper Modal */}
      {imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
};

export default TenantSettings;
