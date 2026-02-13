import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { vendorsService, Vendor } from '../../services/vendors';
import { PlacesSearch } from '../../components/PlacesSearch';
import { Place } from '../../services/places';
import '../../styles/SalesPipeline.css';

interface DuplicateMatch {
  id: number;
  company_name: string;
  vendor_name: string;
  city: string;
  state: string;
}

const VendorList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateMatch[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const duplicateCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Check for duplicate company name
  const checkDuplicateCompany = async (companyName: string) => {
    if (!companyName || companyName.length < 2) {
      setDuplicateWarning([]);
      return;
    }

    try {
      const result = await vendorsService.checkDuplicate(
        companyName,
        editingVendor?.id
      );
      if (result.isDuplicate) {
        setDuplicateWarning(result.matches);
        setDuplicateAcknowledged(false);
      } else {
        setDuplicateWarning([]);
      }
    } catch (error) {
      console.error('Error checking duplicate:', error);
    }
  };

  // Handle company name change with debounce
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (duplicateCheckRef.current) {
      clearTimeout(duplicateCheckRef.current);
    }

    duplicateCheckRef.current = setTimeout(() => {
      checkDuplicateCompany(value);
    }, 500);
  };

  // Handle place selection from Foursquare search
  const handlePlaceSelect = (place: Place) => {
    if (!formRef.current) return;

    const form = formRef.current;
    const setInputValue = (name: string, value: string) => {
      const input = form.elements.namedItem(name) as HTMLInputElement;
      if (input) input.value = value;
    };

    setInputValue('vendor_name', place.name);
    setInputValue('company_name', place.name);
    setInputValue('phone', place.phone);
    setInputValue('address_line1', place.address);
    setInputValue('city', place.city);
    setInputValue('state', place.state);
    setInputValue('zip_code', place.zip_code);

    // Check for duplicates after setting values
    checkDuplicateCompany(place.name);
  };

  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors', statusFilter, vendorTypeFilter, searchTerm],
    queryFn: () => vendorsService.getAll({
      status: statusFilter || undefined,
      vendor_type: vendorTypeFilter || undefined,
      search: searchTerm || undefined,
    }),
  });

  // Create/Update vendor mutation
  const saveMutation = useMutation({
    mutationFn: (vendor: Partial<Vendor>) => {
      if (editingVendor?.id) {
        return vendorsService.update(editingVendor.id, vendor);
      }
      return vendorsService.create(vendor);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setShowModal(false);
      setEditingVendor(null);
      setDuplicateWarning([]);
      setDuplicateAcknowledged(false);
    },
  });

  // Delete vendor mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => vendorsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (file: File) => vendorsService.importFromExcel(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setShowImportModal(false);
      setSelectedFile(null);
      alert(`Successfully imported ${data.count} vendors`);
    },
    onError: (error: any) => {
      alert(`Import failed: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check if there's a duplicate warning that hasn't been acknowledged
    if (duplicateWarning.length > 0 && !duplicateAcknowledged) {
      const confirmCreate = window.confirm(
        `A vendor with the company name "${duplicateWarning[0].company_name}" already exists. Are you sure you want to create another one?`
      );
      if (!confirmCreate) return;
      setDuplicateAcknowledged(true);
    }

    const formData = new FormData(e.currentTarget);
    const vendor: Partial<Vendor> = {
      vendor_name: formData.get('vendor_name') as string,
      company_name: formData.get('company_name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address_line1: formData.get('address_line1') as string,
      city: formData.get('city') as string,
      state: formData.get('state') as string,
      zip_code: formData.get('zip_code') as string,
      vendor_type: formData.get('vendor_type') as string,
      trade_specialty: formData.get('trade_specialty') as string,
      payment_terms: formData.get('payment_terms') as string,
      status: formData.get('status') as string,
      notes: formData.get('notes') as string,
    };
    saveMutation.mutate(vendor);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingVendor(null);
    setDuplicateWarning([]);
    setDuplicateAcknowledged(false);
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await vendorsService.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vendors_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download template');
    }
  };

  const getStatusBadgeClass = (status: string | undefined) => {
    switch (status) {
      case 'active': return 'awarded';
      case 'inactive': return 'closed';
      case 'suspended': return 'lost';
      default: return 'lead';
    }
  };

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/account-management" className="breadcrumb-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to Account Management
            </Link>
            <h1>🏗️ Vendors & Subcontractors</h1>
            <div className="sales-subtitle">Accounts Payable</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <span style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Vendors sync automatically from Vista
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Vendors</div>
          <div className="sales-kpi-value">{vendors.length}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Active</div>
          <div className="sales-kpi-value">{vendors.filter((v: Vendor) => v.status === 'active').length}</div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Subcontractors</div>
          <div className="sales-kpi-value">{vendors.filter((v: Vendor) => v.vendor_type === 'subcontractor').length}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Suppliers</div>
          <div className="sales-kpi-value">{vendors.filter((v: Vendor) => v.vendor_type === 'supplier').length}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Vendors</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="sales-filter-btn"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <select
              className="sales-filter-btn"
              value={vendorTypeFilter}
              onChange={(e) => setVendorTypeFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">All Types</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="supplier">Supplier</option>
              <option value="service_provider">Service Provider</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Loading vendors...
          </div>
        ) : vendors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🏢</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No vendors found</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Vendor records sync automatically from Vista.</p>
          </div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Facility/Location Name</th>
                <th>Company</th>
                <th>Type</th>
                <th>Trade Specialty</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor: Vendor) => (
                <tr key={vendor.id}>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: 'var(--gradient-2)', fontSize: '14px', color: 'white' }}>
                        {vendor.vendor_name?.[0] || vendor.company_name?.[0] || 'V'}
                      </div>
                      <div className="sales-project-info">
                        <h4>{vendor.vendor_name || '-'}</h4>
                      </div>
                    </div>
                  </td>
                  <td>{vendor.company_name || '-'}</td>
                  <td>
                    {vendor.vendor_type && (
                      <span className="sales-stage-badge opportunity-received">
                        <span className="sales-stage-dot"></span>
                        {vendor.vendor_type.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td>{vendor.trade_specialty || '-'}</td>
                  <td>{vendor.phone || '-'}</td>
                  <td>{vendor.email || '-'}</td>
                  <td>
                    <span className={`sales-stage-badge ${getStatusBadgeClass(vendor.status)}`}>
                      <span className="sales-stage-dot"></span>
                      {vendor.status}
                    </span>
                  </td>
                  <td>
                    <div className="sales-actions-cell">
                      <button
                        className="sales-action-btn"
                        onClick={() => {
                          setEditingVendor(vendor);
                          setShowModal(true);
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} ref={formRef}>
              <div style={{ padding: '20px 24px' }}>
                {!editingVendor && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Search Business</label>
                    <PlacesSearch
                      onSelect={handlePlaceSelect}
                      placeholder="Search: name + city (e.g., Ferguson Plumbing Phoenix)"
                      near="USA"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      Include business type and city for best results
                    </small>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Company Name *</label>
                    <input
                      name="company_name"
                      defaultValue={editingVendor?.company_name}
                      onChange={handleCompanyNameChange}
                      required
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                    {duplicateWarning.length > 0 && !duplicateAcknowledged && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid var(--accent-amber)',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}>
                        <strong style={{ color: 'var(--accent-amber)' }}>Possible duplicate found:</strong>
                        {duplicateWarning.map((match) => (
                          <div key={match.id} style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                            {match.company_name}
                            {match.vendor_name && ` - ${match.vendor_name}`}
                            {(match.city || match.state) && ` (${[match.city, match.state].filter(Boolean).join(', ')})`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Facility/Location Name</label>
                    <input
                      name="vendor_name"
                      defaultValue={editingVendor?.vendor_name}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      name="email"
                      defaultValue={editingVendor?.email}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone</label>
                    <input
                      name="phone"
                      defaultValue={editingVendor?.phone}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Address</label>
                    <input
                      name="address_line1"
                      defaultValue={editingVendor?.address_line1}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>City</label>
                    <input
                      name="city"
                      defaultValue={editingVendor?.city}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>State</label>
                    <input
                      name="state"
                      defaultValue={editingVendor?.state}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Zip Code</label>
                    <input
                      name="zip_code"
                      defaultValue={editingVendor?.zip_code}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Vendor Type</label>
                    <select
                      name="vendor_type"
                      defaultValue={editingVendor?.vendor_type}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}
                    >
                      <option value="">Select Type</option>
                      <option value="subcontractor">Subcontractor</option>
                      <option value="supplier">Supplier</option>
                      <option value="service_provider">Service Provider</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Trade Specialty</label>
                    <input
                      name="trade_specialty"
                      defaultValue={editingVendor?.trade_specialty}
                      placeholder="e.g., HVAC, Electrical, Plumbing"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Terms</label>
                    <input
                      name="payment_terms"
                      defaultValue={editingVendor?.payment_terms}
                      placeholder="e.g., Net 30"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Status</label>
                    <select
                      name="status"
                      defaultValue={editingVendor?.status || 'active'}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      defaultValue={editingVendor?.notes}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="sales-btn sales-btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="sales-btn sales-btn-primary">
                  {editingVendor ? 'Update' : 'Create'} Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Import Vendors from Excel</h2>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Upload an Excel file (.xlsx or .xls) containing vendor data.</p>
              <button className="sales-btn sales-btn-secondary" onClick={handleDownloadTemplate} style={{ marginBottom: '20px' }}>
                Download Template
              </button>
              <div style={{ marginTop: '16px' }}>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: '12px' }}
                />
                {selectedFile && <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Selected: {selectedFile.name}</p>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
              <button className="sales-btn sales-btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="sales-btn sales-btn-primary"
                onClick={handleImport}
                disabled={!selectedFile || importMutation.isPending}
              >
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorList;
