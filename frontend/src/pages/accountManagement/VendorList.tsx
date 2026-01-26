import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { vendorsService, Vendor } from '../../services/vendors';
import { PlacesSearch } from '../../components/PlacesSearch';
import { Place } from '../../services/places';
import './CustomerList.css';

const VendorList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  return (
    <div className="customer-list-page">
      <div className="page-header">
        <div>
          <Link to="/account-management" className="breadcrumb-link">
            &larr; Back to Account Management
          </Link>
          <h1 className="page-title">Vendors & Subcontractors</h1>
          <p className="page-subtitle">Accounts Payable</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            📤 Import from Excel
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Vendor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section card">
        <div className="filters-grid">
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <select value={vendorTypeFilter} onChange={(e) => setVendorTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="subcontractor">Subcontractor</option>
            <option value="supplier">Supplier</option>
            <option value="service_provider">Service Provider</option>
          </select>
        </div>
      </div>

      {/* Vendor List */}
      {isLoading ? (
        <div className="loading">Loading vendors...</div>
      ) : (
        <div className="table-container card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Company</th>
                <th>Type</th>
                <th>Trade Specialty</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                    No vendors found. Click "Add Vendor" to create one.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td><strong>{vendor.vendor_name}</strong></td>
                    <td>{vendor.company_name || '-'}</td>
                    <td>{vendor.vendor_type || '-'}</td>
                    <td>{vendor.trade_specialty || '-'}</td>
                    <td>{vendor.primary_contact || '-'}</td>
                    <td>{vendor.phone || '-'}</td>
                    <td>{vendor.email || '-'}</td>
                    <td>
                      <span className={`status-badge status-${vendor.status}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setEditingVendor(vendor);
                          setShowModal(true);
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this vendor?')) {
                            deleteMutation.mutate(vendor.id);
                          }
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} ref={formRef}>
              {!editingVendor && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Search Business</label>
                  <PlacesSearch
                    onSelect={handlePlaceSelect}
                    placeholder="Search for a business (e.g., Ferguson Enterprises)..."
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    Search and select to auto-fill vendor details
                  </small>
                </div>
              )}
              <div className="form-grid">
                <div className="form-group">
                  <label>Vendor Name *</label>
                  <input
                    name="vendor_name"
                    defaultValue={editingVendor?.vendor_name}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    name="company_name"
                    defaultValue={editingVendor?.company_name}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingVendor?.email}
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    name="phone"
                    defaultValue={editingVendor?.phone}
                  />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input
                    name="address_line1"
                    defaultValue={editingVendor?.address_line1}
                  />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input
                    name="city"
                    defaultValue={editingVendor?.city}
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input
                    name="state"
                    defaultValue={editingVendor?.state}
                  />
                </div>
                <div className="form-group">
                  <label>Zip Code</label>
                  <input
                    name="zip_code"
                    defaultValue={editingVendor?.zip_code}
                  />
                </div>
                <div className="form-group">
                  <label>Vendor Type</label>
                  <select name="vendor_type" defaultValue={editingVendor?.vendor_type}>
                    <option value="">Select Type</option>
                    <option value="subcontractor">Subcontractor</option>
                    <option value="supplier">Supplier</option>
                    <option value="service_provider">Service Provider</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Trade Specialty</label>
                  <input
                    name="trade_specialty"
                    defaultValue={editingVendor?.trade_specialty}
                    placeholder="e.g., HVAC, Electrical, Plumbing"
                  />
                </div>
                <div className="form-group">
                  <label>Payment Terms</label>
                  <input
                    name="payment_terms"
                    defaultValue={editingVendor?.payment_terms}
                    placeholder="e.g., Net 30"
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" defaultValue={editingVendor?.status || 'active'}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={editingVendor?.notes}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Vendors from Excel</h2>
              <button className="close-btn" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="import-content">
              <p>Upload an Excel file (.xlsx or .xls) containing vendor data.</p>
              <button className="btn btn-secondary" onClick={handleDownloadTemplate}>
                📥 Download Template
              </button>
              <div className="file-upload">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                {selectedFile && <p>Selected: {selectedFile.name}</p>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
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
