import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, Project } from '../../services/projects';
import { customersApi, Customer } from '../../services/customers';
import SearchableSelect from '../../components/SearchableSelect';
import '../../styles/SalesPipeline.css';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [hasUserSorted, setHasUserSorted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('Open');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkOwnerCustomerId, setBulkOwnerCustomerId] = useState<string>('');
  const [bulkCustomerId, setBulkCustomerId] = useState<string>('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  // Toggle favorite mutation with optimistic updates
  const toggleFavoriteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.toggleFavorite(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previousProjects = queryClient.getQueryData<Project[]>(['projects']);
      queryClient.setQueryData<Project[]>(['projects'], (old) =>
        old?.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p) || []
      );
      return { previousProjects };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(['projects'], context.previousProjects);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // Get unique values for filters
  const uniqueStatuses = [...new Set((projects || []).map(p => p.status).filter(Boolean))].sort();
  const uniqueDepartments = [...new Set((projects || []).map(p => p.department_number).filter(Boolean))].sort();
  const uniqueMarkets = [...new Set((projects || []).map(p => p.market).filter(Boolean))].sort();

  // Helper function to get market icon (VP Markets)
  const getMarketIcon = (market?: string): string => {
    const marketIcons: { [key: string]: string } = {
      // VP Markets
      'MFG-Food': '🍔',
      'Health Care': '🏥',
      'MFG-Other': '🏭',
      'MFG-Paper': '📄',
      'Amusement/Recreation': '🎢',
      'Educational': '🏫',
      'Manufacturing': '🏭',
      'Commercial': '🏢',
      'Office': '🏢',
      'Power': '⚡',
      'Lodging': '🏨',
      'Religious': '⛪',
      'Public Safety': '🚔',
      'Transportation': '🚚',
      'Communication': '📡',
      'Conservation/Development': '🌲',
      'Sewage/Waste Disposal': '♻️',
      'Highway/Street': '🛣️',
      'Water Supply': '💧',
      'Residential': '🏠',
      // Legacy mappings
      'Healthcare': '🏥',
      'Education': '🏫',
      'Industrial': '🏭',
      'Retail': '🏬',
      'Government': '🏛️',
      'Hospitality': '🏨',
      'Data Center': '💾'
    };
    return marketIcons[market || ''] || '🏢';
  };

  // Helper function to get market gradient (VP Markets)
  const getMarketGradient = (market?: string): string => {
    const marketGradients: { [key: string]: string } = {
      // VP Markets
      'MFG-Food': 'linear-gradient(135deg, #f97316, #eab308)',
      'Health Care': 'linear-gradient(135deg, #10b981, #06b6d4)',
      'MFG-Other': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'MFG-Paper': 'linear-gradient(135deg, #64748b, #94a3b8)',
      'Amusement/Recreation': 'linear-gradient(135deg, #ec4899, #f43f5e)',
      'Educational': 'linear-gradient(135deg, #f59e0b, #f97316)',
      'Manufacturing': 'linear-gradient(135deg, #6366f1, #3b82f6)',
      'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      'Office': 'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'Power': 'linear-gradient(135deg, #eab308, #f59e0b)',
      'Lodging': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
      'Religious': 'linear-gradient(135deg, #8b5cf6, #a855f7)',
      'Public Safety': 'linear-gradient(135deg, #ef4444, #f97316)',
      'Transportation': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'Communication': 'linear-gradient(135deg, #14b8a6, #06b6d4)',
      'Conservation/Development': 'linear-gradient(135deg, #22c55e, #10b981)',
      'Sewage/Waste Disposal': 'linear-gradient(135deg, #84cc16, #22c55e)',
      'Highway/Street': 'linear-gradient(135deg, #64748b, #475569)',
      'Water Supply': 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
      'Residential': 'linear-gradient(135deg, #a855f7, #ec4899)',
      // Legacy mappings
      'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
      'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
      'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
      'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
      'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
    };
    return marketGradients[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
  };

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      // Vista statuses
      'Open': '#10b981',
      'Soft-Closed': '#f59e0b',
      'Hard-Closed': '#6b7280',
      // Legacy statuses
      active: '#10b981',
      on_hold: '#f59e0b',
      completed: '#3b82f6',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  // Helper function to get project icon based on status
  const getProjectIcon = (status: string): string => {
    const icons: { [key: string]: string } = {
      // Vista statuses
      'Open': '🏗️',
      'Soft-Closed': '📋',
      'Hard-Closed': '✅',
      // Legacy statuses
      active: '🏗️',
      on_hold: '⏸️',
      completed: '✅',
      cancelled: '❌'
    };
    return icons[status] || '📋';
  };

  // Helper function to get project gradient based on status
  const getProjectGradient = (status: string): string => {
    const gradients: { [key: string]: string } = {
      // Vista statuses
      'Open': 'linear-gradient(135deg, #10b981, #06b6d4)',
      'Soft-Closed': 'linear-gradient(135deg, #f59e0b, #f97316)',
      'Hard-Closed': 'linear-gradient(135deg, #6b7280, #4b5563)',
      // Legacy statuses
      active: 'linear-gradient(135deg, #10b981, #06b6d4)',
      on_hold: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
      completed: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      cancelled: 'linear-gradient(135deg, #ef4444, #dc2626)'
    };
    return gradients[status] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
  };

  // Helper function to get manager initials
  const getManagerInitials = (name?: string): string => {
    if (!name) return 'UN';
    return name.split(' ').map(n => n[0]).join('');
  };

  // Helper function to get manager color
  const getManagerColor = (name: string): string => {
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

  // Filter projects based on search term and dropdown filters
  const filteredProjects = (projects || []).filter(project => {
    // Apply dropdown filters first
    if (statusFilter !== 'all' && project.status !== statusFilter) return false;
    if (departmentFilter !== 'all' && project.department_number !== departmentFilter) return false;
    if (marketFilter !== 'all' && project.market !== marketFilter) return false;

    // Then apply search filter
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();

    // Format numeric values for searching (matches display format)
    const contractValueStr = project.contract_value ? `$${Number(project.contract_value).toLocaleString()}` : '';
    const backlogStr = project.backlog ? `$${Number(project.backlog).toLocaleString()}` : '';
    const gmPercentStr = project.gross_margin_percent !== undefined && project.gross_margin_percent !== null
      ? `${(Number(project.gross_margin_percent) * 100).toFixed(1)}%`
      : '';

    return (
      project.name.toLowerCase().includes(term) ||
      project.number.toLowerCase().includes(term) ||
      (project.client && project.client.toLowerCase().includes(term)) ||
      (project.customer_name && project.customer_name.toLowerCase().includes(term)) ||
      (project.owner_name && project.owner_name.toLowerCase().includes(term)) ||
      (project.status && project.status.toLowerCase().includes(term)) ||
      (project.department_number && project.department_number.toLowerCase().includes(term)) ||
      (project.market && project.market.toLowerCase().includes(term)) ||
      (project.manager_name && project.manager_name.toLowerCase().includes(term)) ||
      (project.start_date && new Date(project.start_date).toLocaleDateString('en-US').toLowerCase().includes(term)) ||
      contractValueStr.toLowerCase().includes(term) ||
      backlogStr.toLowerCase().includes(term) ||
      gmPercentStr.toLowerCase().includes(term)
    );
  });

  // Sort projects - favorites at top on initial load
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    // On initial load (before user sorts), put favorites at top
    if (!hasUserSorted) {
      const aFav = a.favorite ? 1 : 0;
      const bFav = b.favorite ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
    }

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'favorite':
        aValue = a.favorite ? 1 : 0;
        bValue = b.favorite ? 1 : 0;
        break;
      case 'number':
        aValue = a.number.toLowerCase();
        bValue = b.number.toLowerCase();
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'contract_value':
        aValue = Number(a.contract_value) || 0;
        bValue = Number(b.contract_value) || 0;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'department':
        aValue = (a.department_number || '').toLowerCase();
        bValue = (b.department_number || '').toLowerCase();
        break;
      case 'backlog':
        aValue = Number(a.backlog) || 0;
        bValue = Number(b.backlog) || 0;
        break;
      case 'gross_margin':
        aValue = Number(a.gross_margin_percent) || 0;
        bValue = Number(b.gross_margin_percent) || 0;
        break;
      case 'manager':
        aValue = (a.manager_name || '').toLowerCase();
        bValue = (b.manager_name || '').toLowerCase();
        break;
      case 'start_date':
        aValue = a.start_date ? new Date(a.start_date).getTime() : 0;
        bValue = b.start_date ? new Date(b.start_date).getTime() : 0;
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
    setHasUserSorted(true);
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'favorite' ? 'desc' : 'asc');
    }
  };

  // Calculate KPIs from filtered projects
  const kpis = {
    projectCount: filteredProjects.length,
    totalContractValue: filteredProjects.reduce((sum, p) => sum + (Number(p.contract_value) || 0), 0),
    totalBacklog: filteredProjects.reduce((sum, p) => sum + (Number(p.backlog) || 0), 0),
    avgGrossMargin: filteredProjects.filter(p => p.gross_margin_percent !== undefined && p.gross_margin_percent !== null).length > 0
      ? filteredProjects.reduce((sum, p) => sum + (Number(p.gross_margin_percent) || 0), 0) / filteredProjects.filter(p => p.gross_margin_percent !== undefined && p.gross_margin_percent !== null).length
      : 0,
    avgProjectValue: filteredProjects.length > 0
      ? filteredProjects.reduce((sum, p) => sum + (Number(p.contract_value) || 0), 0) / filteredProjects.length
      : 0
  };

  // Multi-select handlers
  const handleSelectAll = () => {
    if (selectedIds.size === sortedProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedProjects.map(p => p.id)));
    }
  };

  const handleSelectOne = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkOwnerCustomerId && !bulkCustomerId) return;

    setIsBulkUpdating(true);
    try {
      const updateData: any = {};
      if (bulkOwnerCustomerId) {
        updateData.ownerCustomerId = Number(bulkOwnerCustomerId);
      }
      if (bulkCustomerId) {
        updateData.customerId = Number(bulkCustomerId);
      }

      // Update each selected project
      await Promise.all(
        Array.from(selectedIds).map(id => projectsApi.update(id, updateData))
      );

      // Refresh data and clear selection
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setSelectedIds(new Set());
      setBulkOwnerCustomerId('');
      setBulkCustomerId('');
    } catch (error) {
      console.error('Bulk update failed:', error);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading projects...</div>
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
            <h1>📊 Projects</h1>
            <div className="sales-subtitle">Manage construction projects and tracking</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="sales-btn sales-btn-secondary"
            onClick={() => navigate('/projects/projected-revenue')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
            </svg>
            Projected Revenue
          </button>
          <button className="sales-btn sales-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => navigate('/projects/new')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Project Count</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>{kpis.projectCount.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Contract Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#3b82f6' }}>${(kpis.totalContractValue / 1000000).toFixed(1)}M</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Backlog</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#8b5cf6' }}>${(kpis.totalBacklog / 1000000).toFixed(1)}M</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Average GM%</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: kpis.avgGrossMargin >= 0 ? '#10b981' : '#ef4444' }}>{(kpis.avgGrossMargin * 100).toFixed(1)}%</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Avg. Project Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f59e0b' }}>${Math.round(kpis.avgProjectValue).toLocaleString()}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '1rem',
        alignItems: 'flex-end'
      }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Search</label>
          <div className="sales-search-box" style={{ width: '100%' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Status</label>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Department</label>
          <select
            className="form-input"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}
          >
            <option value="all">All Departments</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Market</label>
          <select
            className="form-input"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}
          >
            <option value="all">All Markets</option>
            {uniqueMarkets.map(market => (
              <option key={market} value={market}>{market}</option>
            ))}
          </select>
        </div>
        {(statusFilter !== 'all' || departmentFilter !== 'all' || marketFilter !== 'all' || searchTerm) && (
          <button
            className="sales-filter-btn"
            onClick={() => {
              setStatusFilter('all');
              setDepartmentFilter('all');
              setMarketFilter('all');
              setSearchTerm('');
            }}
            style={{ padding: '0.5rem 1rem', height: 'fit-content' }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: 'white',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontWeight: 600 }}>
            {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <SearchableSelect
              options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
              value={bulkOwnerCustomerId}
              onChange={setBulkOwnerCustomerId}
              placeholder="-- Assign Owner --"
              style={{ minWidth: '220px' }}
            />
            <SearchableSelect
              options={customers.map((c: Customer) => ({ value: c.id, label: c.customer_owner }))}
              value={bulkCustomerId}
              onChange={setBulkCustomerId}
              placeholder="-- Assign Customer (GC) --"
              style={{ minWidth: '220px' }}
            />
            <button
              onClick={handleBulkUpdate}
              disabled={isBulkUpdating || (!bulkOwnerCustomerId && !bulkCustomerId)}
              style={{
                padding: '0.4rem 1rem',
                background: (!bulkOwnerCustomerId && !bulkCustomerId) ? '#94a3b8' : 'white',
                color: (!bulkOwnerCustomerId && !bulkCustomerId) ? '#64748b' : '#3b82f6',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: (!bulkOwnerCustomerId && !bulkCustomerId) ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {isBulkUpdating ? 'Updating...' : 'Apply'}
            </button>
          </div>
          <button
            onClick={() => {
              setSelectedIds(new Set());
              setBulkOwnerCustomerId('');
              setBulkCustomerId('');
            }}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">
            All Projects
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({filteredProjects.length.toLocaleString()} of {(projects || []).length.toLocaleString()})
            </span>
          </div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={sortedProjects.length > 0 && selectedIds.size === sortedProjects.length}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
              </th>
              <th className="sales-sortable" onClick={() => handleSort('favorite')} style={{ width: '50px', textAlign: 'center' }}>
                <span className="sales-sort-icon">{sortColumn === 'favorite' ? (sortDirection === 'asc' ? '↑' : '↓') : '☆'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('number')}>
                Number <span className="sales-sort-icon">{sortColumn === 'number' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('start_date')}>
                Start Date <span className="sales-sort-icon">{sortColumn === 'start_date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('name')}>
                Project <span className="sales-sort-icon">{sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('contract_value')}>
                Contract Value <span className="sales-sort-icon">{sortColumn === 'contract_value' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('gross_margin')}>
                GM% <span className="sales-sort-icon">{sortColumn === 'gross_margin' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('backlog')}>
                Backlog <span className="sales-sort-icon">{sortColumn === 'backlog' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>
                Status <span className="sales-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('department')}>
                Department <span className="sales-sort-icon">{sortColumn === 'department' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('manager')}>
                Project Manager <span className="sales-sort-icon">{sortColumn === 'manager' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.length > 0 ? (
              sortedProjects.map((project: Project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{
                    cursor: 'pointer',
                    background: selectedIds.has(project.id) ? 'rgba(59, 130, 246, 0.1)' : undefined
                  }}
                >
                  <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(project.id)}
                      onChange={() => {}}
                      onClick={(e) => handleSelectOne(project.id, e)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
                  <td
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteMutation.mutate(project.id);
                    }}
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                  >
                    <span
                      style={{
                        fontSize: '1.25rem',
                        color: project.favorite ? '#f59e0b' : '#d1d5db',
                        transition: 'color 0.2s, transform 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.2)';
                        if (!project.favorite) e.currentTarget.style.color = '#fbbf24';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        if (!project.favorite) e.currentTarget.style.color = '#d1d5db';
                      }}
                    >
                      {project.favorite ? '\u2605' : '\u2606'}
                    </span>
                  </td>
                  <td>{project.number}</td>
                  <td>{project.start_date ? new Date(project.start_date).toLocaleDateString('en-US') : '-'}</td>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: project.market ? getMarketGradient(project.market) : getProjectGradient(project.status) }}>
                        {project.market ? getMarketIcon(project.market) : getProjectIcon(project.status)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{project.name}</h4>
                        <span>{project.owner_name || project.customer_name || project.client || 'No client specified'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{project.contract_value ? `$${Math.round(Number(project.contract_value)).toLocaleString()}` : '-'}</td>
                  <td style={{ color: project.gross_margin_percent && project.gross_margin_percent > 0 ? '#10b981' : project.gross_margin_percent && project.gross_margin_percent < 0 ? '#ef4444' : 'inherit' }}>
                    {project.gross_margin_percent !== undefined && project.gross_margin_percent !== null ? `${Math.round(Number(project.gross_margin_percent) * 100)}%` : '-'}
                  </td>
                  <td>{project.backlog ? `$${Math.round(Number(project.backlog)).toLocaleString()}` : '-'}</td>
                  <td>
                    <span className={`sales-stage-badge ${project.status.toLowerCase().replace('-', '_')}`}>
                      <span className="sales-stage-dot" style={{ background: getStatusColor(project.status) }}></span>
                      {project.status.includes('-') ? project.status : project.status.replace('_', ' ').charAt(0).toUpperCase() + project.status.replace('_', ' ').slice(1)}
                    </span>
                  </td>
                  <td>{project.department_number || '-'}</td>
                  <td>
                    <div className="sales-salesperson-cell">
                      <div
                        className="sales-salesperson-avatar"
                        style={{ background: getManagerColor(project.manager_name || 'Unassigned') }}
                      >
                        {getManagerInitials(project.manager_name)}
                      </div>
                      {project.manager_name || 'Unassigned'}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>
                  <div>
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ margin: '0 auto 16px', opacity: 0.4 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No projects found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first project'}
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

export default ProjectList;
