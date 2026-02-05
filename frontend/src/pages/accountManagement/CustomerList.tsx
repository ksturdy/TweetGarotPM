import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { customersApi, Customer } from '../../services/customers';
import CustomerFormModal from '../../components/modals/CustomerFormModal';
import '../../styles/SalesPipeline.css';

const CustomerList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  const [sortColumn, setSortColumn] = useState<string>('customer_owner');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number; field: 'market' | 'status' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Get returnTo from URL params for navigation back to estimate
  const returnTo = searchParams.get('returnTo');
  const addNew = searchParams.get('addNew');

  // Auto-open modal if coming from estimate page
  useEffect(() => {
    if (addNew === 'true') {
      setShowNewCustomerModal(true);
    }
  }, [addNew]);

  // Handle modal close - navigate back if returnTo is set
  const handleModalClose = () => {
    setShowNewCustomerModal(false);
    if (returnTo) {
      navigate(`${returnTo}?fromCustomers=true`);
    }
  };

  // Market options
  const marketOptions = ['Healthcare', 'Education', 'Commercial', 'Industrial', 'Retail', 'Government', 'Hospitality', 'Data Center'];

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

  // Update mutation for inline editing with optimistic updates
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) => customersApi.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['customers'] });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData<Customer[]>(['customers']);

      // Optimistically update the cache
      queryClient.setQueryData<Customer[]>(['customers'], (old) =>
        old?.map(c => c.id === id ? { ...c, ...data } : c) || []
      );

      setEditingCell(null);

      return { previousCustomers };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSettled: () => {
      // Refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  // Toggle favorite mutation with optimistic updates
  const toggleFavoriteMutation = useMutation({
    mutationFn: (id: number) => customersApi.toggleFavorite(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['customers'] });
      const previousCustomers = queryClient.getQueryData<Customer[]>(['customers']);
      queryClient.setQueryData<Customer[]>(['customers'], (old) =>
        old?.map(c => c.id === id ? { ...c, favorite: !c.favorite } : c) || []
      );
      return { previousCustomers };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
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

  // Get unique companies with facility counts (deduplicate by customer_owner)
  const uniqueCompanies = React.useMemo(() => {
    const companyMap = new Map<string, Customer & { facility_count: number }>();
    customers.forEach(customer => {
      const key = customer.customer_owner || customer.customer_facility || `unknown-${customer.id}`;
      if (!companyMap.has(key)) {
        companyMap.set(key, { ...customer, facility_count: 1 });
      } else {
        const existing = companyMap.get(key)!;
        existing.facility_count += 1;
      }
    });
    return Array.from(companyMap.values());
  }, [customers]);

  // Filter customers (now filtering unique companies)
  const filteredCustomers = uniqueCompanies.filter(customer => {
    const matchesSearch = !searchTerm ||
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
      case 'favorite':
        aValue = a.favorite ? 1 : 0;
        bValue = b.favorite ? 1 : 0;
        break;
      case 'customer_owner':
        aValue = (a.customer_owner || '').toLowerCase();
        bValue = (b.customer_owner || '').toLowerCase();
        break;
      case 'facility_count':
        aValue = (a as any).facility_count || 0;
        bValue = (b as any).facility_count || 0;
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
      case 'customer_score':
        aValue = parseFloat(String(a.customer_score || 0));
        bValue = parseFloat(String(b.customer_score || 0));
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
      // Default to 'desc' for favorite so favorites appear first
      setSortDirection(column === 'favorite' ? 'desc' : 'asc');
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
          <span style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Customers sync automatically from Vista
          </span>
          {returnTo && (
            <button
              className="sales-btn"
              onClick={() => navigate(`${returnTo}?fromCustomers=true`)}
              style={{ marginLeft: '0.5rem', background: '#6b7280', color: 'white' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Return to Estimate
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards - Dynamic based on filtered customers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)', width: '36px', height: '36px', fontSize: '1rem' }}>🏢</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{filteredCustomers.length}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Companies</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', width: '36px', height: '36px', fontSize: '1rem' }}>🏗️</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{filteredCustomers.reduce((sum, c) => sum + ((c as any).facility_count || 1), 0)}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Facilities</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', width: '36px', height: '36px', fontSize: '1rem' }}>✅</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{filteredCustomers.filter(c => c.active_customer).length}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Active</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', width: '36px', height: '36px', fontSize: '1rem' }}>📍</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{new Set(filteredCustomers.map(c => c.state).filter(Boolean)).size}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>States</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: (() => {
            const scores = filteredCustomers.filter(c => c.active_customer).map(c => parseFloat(String(c.customer_score || 0))).filter(s => s > 0);
            const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            return avg >= 80 ? 'linear-gradient(135deg, #10b981, #06b6d4)' :
                   avg >= 60 ? 'linear-gradient(135deg, #f59e0b, #f97316)' :
                   'linear-gradient(135deg, #ef4444, #f43f5e)';
          })(), width: '36px', height: '36px', fontSize: '1rem' }}>⭐</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>
              {(() => {
                const scores = filteredCustomers.filter(c => c.active_customer).map(c => parseFloat(String(c.customer_score || 0))).filter(s => s > 0);
                return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '-';
              })()}
            </div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Avg Score</div>
          </div>
        </div>
      </div>

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
              <th className="sales-sortable" onClick={() => handleSort('favorite')} style={{ width: '50px', textAlign: 'center' }}>
                <span className="sales-sort-icon">{sortColumn === 'favorite' ? (sortDirection === 'asc' ? '↑' : '↓') : '☆'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('customer_owner')}>
                Company <span className="sales-sort-icon">{sortColumn === 'customer_owner' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('facility_count')} style={{ textAlign: 'center' }}>
                Facilities <span className="sales-sort-icon">{sortColumn === 'facility_count' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
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
              <th className="sales-sortable" onClick={() => handleSort('customer_score')}>
                Score <span className="sales-sort-icon">{sortColumn === 'customer_score' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
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
                  <td
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteMutation.mutate(customer.id);
                    }}
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                  >
                    <span
                      style={{
                        fontSize: '1.25rem',
                        color: customer.favorite ? '#f59e0b' : '#d1d5db',
                        transition: 'color 0.2s, transform 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.2)';
                        if (!customer.favorite) e.currentTarget.style.color = '#fbbf24';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        if (!customer.favorite) e.currentTarget.style.color = '#d1d5db';
                      }}
                    >
                      {customer.favorite ? '★' : '☆'}
                    </span>
                  </td>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: getMarketGradient(customer.market) }}>
                        {getMarketIcon(customer.market)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{customer.customer_owner || <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Missing Name</span>}</h4>
                        <span>{customer.city && customer.state ? `${customer.city}, ${customer.state}` : (customer.city || customer.state || 'No location')}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '28px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6'
                    }}>
                      {(customer as any).facility_count}
                    </span>
                  </td>
                  <td onClick={(e) => { e.stopPropagation(); setEditingCell({ id: customer.id, field: 'market' }); }}>
                    {editingCell?.id === customer.id && editingCell?.field === 'market' ? (
                      <select
                        autoFocus
                        value={customer.market || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateMutation.mutate({ id: customer.id, data: { market: value } });
                        }}
                        onBlur={() => setTimeout(() => setEditingCell(null), 150)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #3b82f6', fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        <option value="">Select Market</option>
                        {marketOptions.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <span style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.05)' }}>
                        {customer.market || '-'}
                      </span>
                    )}
                  </td>
                  <td>{customer.city || '-'}</td>
                  <td>{customer.state || '-'}</td>
                  <td onClick={(e) => { e.stopPropagation(); setEditingCell({ id: customer.id, field: 'status' }); }}>
                    {editingCell?.id === customer.id && editingCell?.field === 'status' ? (
                      <select
                        autoFocus
                        value={customer.active_customer ? 'active' : 'inactive'}
                        onChange={(e) => {
                          const value = e.target.value === 'active';
                          updateMutation.mutate({ id: customer.id, data: { active_customer: value } });
                        }}
                        onBlur={() => setTimeout(() => setEditingCell(null), 150)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #3b82f6', fontSize: '0.875rem', cursor: 'pointer' }}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`sales-stage-badge ${customer.active_customer ? 'active' : 'inactive'}`} style={{ cursor: 'pointer' }}>
                        <span className="sales-stage-dot" style={{ background: customer.active_customer ? '#10b981' : '#6b7280' }}></span>
                        {customer.active_customer ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td>
                    {customer.customer_score != null && parseFloat(String(customer.customer_score)) > 0 ? (() => {
                      const score = parseFloat(String(customer.customer_score));
                      return (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '36px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          background: score >= 80 ? 'rgba(16, 185, 129, 0.1)' :
                                     score >= 60 ? 'rgba(245, 158, 11, 0.1)' :
                                     'rgba(239, 68, 68, 0.1)',
                          color: score >= 80 ? '#10b981' :
                                 score >= 60 ? '#f59e0b' :
                                 '#ef4444'
                        }}>
                          {Math.round(score)}
                        </span>
                      );
                    })() : '-'}
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
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
                      {searchTerm ? 'Try adjusting your search terms' : 'Customer records sync automatically from Vista'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default CustomerList;
