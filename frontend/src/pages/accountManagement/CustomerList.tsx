import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { customersApi, Customer } from '../../services/customers';
import './CustomerList.css';

const CustomerList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: customersApi.getAll,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['customers', 'stats'],
    queryFn: customersApi.getStats,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (file: File) => customersApi.importExcel(file, setUploadProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'stats'] });
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      alert('Customer data imported successfully!');
    },
    onError: (error: any) => {
      setIsUploading(false);
      setUploadProgress(0);
      alert(`Import failed: ${error.response?.data?.error || error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: customersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'stats'] });
      setSelectedCustomer(null);
    },
  });

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      importMutation.mutate(file);
    }
  };

  // Get unique states and managers
  const states = ['all', ...new Set(customers.map(c => c.state).filter(Boolean))];
  const managers = ['all', ...new Set(customers.map(c => c.account_manager).filter(Boolean))];

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = !searchTerm ||
      customer.customer_facility?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesState = filterState === 'all' || customer.state === filterState;
    const matchesManager = filterManager === 'all' || customer.account_manager === filterManager;

    return matchesSearch && matchesState && matchesManager;
  });

  if (isLoading) {
    return <div className="loading">Loading customers...</div>;
  }

  return (
    <div className="customer-list-page">
      <div className="page-header">
        <div>
          <Link to="/account-management" className="breadcrumb-link">&larr; Back to Account Management</Link>
          <h1 className="page-title">Customer List</h1>
          <p className="page-subtitle">Manage your customer database</p>
        </div>
        <div className="header-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary"
            disabled={isUploading}
          >
            {isUploading ? `Importing... ${uploadProgress}%` : '📤 Import Excel'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card card">
            <div className="stat-icon">👥</div>
            <div>
              <div className="stat-value">{stats.total_customers}</div>
              <div className="stat-label">Total Customers</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">✅</div>
            <div>
              <div className="stat-value">{stats.active_customers}</div>
              <div className="stat-label">Active Customers</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">🏢</div>
            <div>
              <div className="stat-value">{stats.unique_owners}</div>
              <div className="stat-label">Unique Owners</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">📍</div>
            <div>
              <div className="stat-value">{stats.states_covered}</div>
              <div className="stat-label">States Covered</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>State</label>
            <select
              className="form-input"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
            >
              {states.map(state => (
                <option key={state} value={state}>
                  {state === 'all' ? 'All States' : state}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Account Manager</label>
            <select
              className="form-input"
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
            >
              {managers.map(manager => (
                <option key={manager} value={manager}>
                  {manager === 'all' ? 'All Managers' : manager}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="card">
        <div className="card-header">
          <h3>Customers ({filteredCustomers.length})</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>Owner</th>
                <th>Account Manager</th>
                <th>City</th>
                <th>State</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="empty-state">
                      <div className="empty-icon">📋</div>
                      <h3>No customers found</h3>
                      <p>Import your customer list from Excel to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.customer_facility}</strong>
                      {customer.address && (
                        <div className="text-muted small">{customer.address}</div>
                      )}
                    </td>
                    <td>{customer.customer_owner}</td>
                    <td>{customer.account_manager || '-'}</td>
                    <td>{customer.city || '-'}</td>
                    <td>{customer.state || '-'}</td>
                    <td>
                      <span className={`badge ${customer.active_customer ? 'badge-success' : 'badge-secondary'}`}>
                        {customer.active_customer ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/customers/${customer.id}`}
                        className="btn-icon"
                        title="View customer details"
                      >
                        👁️
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedCustomer.customer_facility}</h2>
              <button className="btn-close" onClick={() => setSelectedCustomer(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Owner</label>
                  <div>{selectedCustomer.customer_owner}</div>
                </div>
                <div className="detail-item">
                  <label>Account Manager</label>
                  <div>{selectedCustomer.account_manager || '-'}</div>
                </div>
                <div className="detail-item">
                  <label>Field Leads</label>
                  <div>{selectedCustomer.field_leads || '-'}</div>
                </div>
                <div className="detail-item">
                  <label>Customer Number</label>
                  <div>{selectedCustomer.customer_number || '-'}</div>
                </div>
                <div className="detail-item">
                  <label>Address</label>
                  <div>
                    {selectedCustomer.address && <div>{selectedCustomer.address}</div>}
                    {selectedCustomer.city && selectedCustomer.state && (
                      <div>{selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.zip_code}</div>
                    )}
                  </div>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <div>
                    <span className={`badge ${selectedCustomer.active_customer ? 'badge-success' : 'badge-secondary'}`}>
                      {selectedCustomer.active_customer ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {selectedCustomer.customer_score && (
                  <div className="detail-item">
                    <label>Customer Score</label>
                    <div>{selectedCustomer.customer_score}</div>
                  </div>
                )}
                {selectedCustomer.department && (
                  <div className="detail-item">
                    <label>Department</label>
                    <div>{selectedCustomer.department}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;
