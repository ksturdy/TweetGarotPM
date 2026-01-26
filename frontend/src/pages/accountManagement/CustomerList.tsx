import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { customersApi, Customer } from '../../services/customers';
import CustomerFormModal from '../../components/modals/CustomerFormModal';
import '../../styles/SalesPipeline.css';

const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [sortColumn, setSortColumn] = useState<string>('customer_facility');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Helper function to get market icon
  const getMarketIcon = (market?: string): string => {
    const marketIcons: { [key: string]: string } = {
      'Healthcare': '🏥',
      'Education': '🏫',
      'Commercial': '🏢',
      'Industrial': '🏭',
      'Retail': '🏬',
      'Government': '🏛️',
      'Hospitality': '🏨',
      'Data Center': '💾'
    };
    return marketIcons[market || ''] || '🏢';
  };

  // Helper function to get market gradient
  const getMarketGradient = (market?: string): string => {
    const marketGradients: { [key: string]: string } = {
      'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
      'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
      'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
      'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
      'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
    };
    return marketGradients[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
  };

  // Helper function to get manager initials
  const getManagerInitials = (name?: string): string => {
    if (!name) return 'UN';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Helper function to get manager color
  const getManagerColor = (name?: string): string => {
    if (!name) return '#6b7280';
    const colors = [
      '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

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

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      importMutation.mutate(file);
    }
  };

  // Download Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Customer_Owner-Facility': 'Example Facility Name',
        'Customer_Owner': 'Example Owner LLC',
        'Account manager': 'John Smith',
        'Field Lead(s)': 'Jane Doe',
        'CustomerNumber': 'CUST-001',
        'Address': '123 Main Street',
        'City_Province': 'Dallas',
        'State_Country': 'TX',
        'ZipCode_PostalCode': '75001',
        'Controls': 'BAS',
        'Department': 'HVAC',
        'Market': 'Healthcare',
        'Customer Score': '85',
        'Active Customer': 'Yes',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
    XLSX.writeFile(workbook, 'Customer_Import_Template.xlsx');
  };

  // Get unique states and managers for filters
  const states = ['all', ...new Set(customers.map(c => c.state).filter(Boolean))];
  const managers = ['all', ...new Set(customers.map(c => c.account_manager).filter(Boolean))];

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = !searchTerm ||
      customer.customer_facility?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_owner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.account_manager?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesState = filterState === 'all' || customer.state === filterState;
    const matchesManager = filterManager === 'all' || customer.account_manager === filterManager;

    return matchesSearch && matchesState && matchesManager;
  });

  // Sort customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'customer_facility':
        aValue = (a.customer_facility || '').toLowerCase();
        bValue = (b.customer_facility || '').toLowerCase();
        break;
      case 'customer_owner':
        aValue = (a.customer_owner || '').toLowerCase();
        bValue = (b.customer_owner || '').toLowerCase();
        break;
      case 'account_manager':
        aValue = (a.account_manager || '').toLowerCase();
        bValue = (b.account_manager || '').toLowerCase();
        break;
      case 'market':
        aValue = (a.market || '').toLowerCase();
        bValue = (b.market || '').toLowerCase();
        break;
      case 'city':
        aValue = (a.city || '').toLowerCase();
        bValue = (b.city || '').toLowerCase();
        break;
      case 'state':
        aValue = (a.state || '').toLowerCase();
        bValue = (b.state || '').toLowerCase();
        break;
      case 'status':
        aValue = a.active_customer ? 1 : 0;
        bValue = b.active_customer ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading customers...</div>
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
            <Link to="/account-management" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Account Management
            </Link>
            <h1>👥 Customers</h1>
            <div className="sales-subtitle">Accounts Receivable</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
          />
          <button
            className="sales-btn sales-btn-secondary"
            onClick={handleDownloadTemplate}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Template
          </button>
          <button
            className="sales-btn sales-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {isUploading ? `Importing... ${uploadProgress}%` : 'Import Excel'}
          </button>
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => setShowNewCustomerModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Customer
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="sales-kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="sales-kpi-card">
            <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)' }}>🏢</div>
            <div className="sales-kpi-content">
              <div className="sales-kpi-value">{stats.unique_owners}</div>
              <div className="sales-kpi-label">Unique Owners</div>
            </div>
          </div>
          <div className="sales-kpi-card">
            <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>👥</div>
            <div className="sales-kpi-content">
              <div className="sales-kpi-value">{stats.total_customers}</div>
              <div className="sales-kpi-label">Facilities</div>
            </div>
          </div>
          <div className="sales-kpi-card">
            <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>✅</div>
            <div className="sales-kpi-content">
              <div className="sales-kpi-value">{stats.active_customers}</div>
              <div className="sales-kpi-label">Active Customers</div>
            </div>
          </div>
          <div className="sales-kpi-card">
            <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>📍</div>
            <div className="sales-kpi-content">
              <div className="sales-kpi-value">{stats.states_covered}</div>
              <div className="sales-kpi-label">States Covered</div>
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Customers</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="sales-filter-select"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
            >
              {states.map(state => (
                <option key={state} value={state}>
                  {state === 'all' ? 'All States' : state}
                </option>
              ))}
            </select>
            <select
              className="sales-filter-select"
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
            >
              {managers.map(manager => (
                <option key={manager} value={manager}>
                  {manager === 'all' ? 'All Managers' : manager}
                </option>
              ))}
            </select>
          </div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('customer_facility')}>
                Customer <span className="sales-sort-icon">{sortColumn === 'customer_facility' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('customer_owner')}>
                Owner <span className="sales-sort-icon">{sortColumn === 'customer_owner' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('market')}>
                Market <span className="sales-sort-icon">{sortColumn === 'market' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('city')}>
                City <span className="sales-sort-icon">{sortColumn === 'city' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('state')}>
                State <span className="sales-sort-icon">{sortColumn === 'state' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>
                Status <span className="sales-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('account_manager')}>
                Account Manager <span className="sales-sort-icon">{sortColumn === 'account_manager' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.length > 0 ? (
              sortedCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: getMarketGradient(customer.market) }}>
                        {getMarketIcon(customer.market)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{customer.customer_facility}</h4>
                        <span>{customer.address || 'No address specified'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{customer.customer_owner || '-'}</td>
                  <td>{customer.market || '-'}</td>
                  <td>{customer.city || '-'}</td>
                  <td>{customer.state || '-'}</td>
                  <td>
                    <span className={`sales-stage-badge ${customer.active_customer ? 'active' : 'inactive'}`}>
                      <span className="sales-stage-dot" style={{ background: customer.active_customer ? '#10b981' : '#6b7280' }}></span>
                      {customer.active_customer ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="sales-salesperson-cell">
                      <div
                        className="sales-salesperson-avatar"
                        style={{ background: getManagerColor(customer.account_manager) }}
                      >
                        {getManagerInitials(customer.account_manager)}
                      </div>
                      {customer.account_manager || 'Unassigned'}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  <div>
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.4 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No customers found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Import your customer list from Excel to get started'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Customer Modal */}
      {showNewCustomerModal && (
        <CustomerFormModal
          onClose={() => setShowNewCustomerModal(false)}
        />
      )}
    </div>
  );
};

export default CustomerList;
