import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vistaDataService, VPWorkOrder } from '../../services/vistaData';
import '../../styles/SalesPipeline.css';

const PAGE_SIZE_OPTIONS = [50, 100, 250, 500];

const WorkOrderList: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('work_order_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('Open');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  const { data: workOrders, isLoading } = useQuery({
    queryKey: ['vista-work-orders-all'],
    queryFn: () => vistaDataService.getAllWorkOrders(),
  });

  // Get unique values for filters
  const uniqueStatuses = useMemo(() =>
    [...new Set((workOrders || []).map(w => w.status).filter((s): s is string => Boolean(s)))].sort(),
    [workOrders]
  );
  const uniqueDepartments = useMemo(() =>
    [...new Set((workOrders || []).map(w => w.department_code).filter((d): d is string => Boolean(d)))].sort(),
    [workOrders]
  );
  const uniqueMarkets = useMemo(() =>
    [...new Set((workOrders || []).map(w => w.primary_market).filter((m): m is string => Boolean(m)))].sort(),
    [workOrders]
  );

  // Helper function to get market icon (VP Markets)
  const getMarketIcon = (market?: string | null): string => {
    const marketIcons: { [key: string]: string } = {
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
      'Healthcare': '🏥',
      'Education': '🏫',
      'Industrial': '🏭',
      'Retail': '🏬',
      'Government': '🏛️',
      'Hospitality': '🏨',
      'Data Center': '💾'
    };
    return marketIcons[market || ''] || '🔧';
  };

  // Helper function to get market gradient (VP Markets)
  const getMarketGradient = (market?: string | null): string => {
    const marketGradients: { [key: string]: string } = {
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
      'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
      'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
      'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
      'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
      'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
    };
    return marketGradients[market || ''] || 'linear-gradient(135deg, #8b5cf6, #6366f1)';
  };

  // Helper function to get status color
  const getStatusColor = (status: string | null): string => {
    const colors: { [key: string]: string } = {
      'Open': '#10b981',
      'Soft-Closed': '#f59e0b',
      'Hard-Closed': '#6b7280',
      active: '#10b981',
      on_hold: '#f59e0b',
      completed: '#3b82f6',
      cancelled: '#ef4444'
    };
    return colors[status || ''] || '#6b7280';
  };

  // Helper function to get manager initials
  const getManagerInitials = (name?: string | null): string => {
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

  // Filter work orders based on search term and dropdown filters
  const filteredWorkOrders = useMemo(() => {
    return (workOrders || []).filter(workOrder => {
      if (statusFilter !== 'all' && workOrder.status !== statusFilter) return false;
      if (departmentFilter !== 'all' && workOrder.department_code !== departmentFilter) return false;
      if (marketFilter !== 'all' && workOrder.primary_market !== marketFilter) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (workOrder.work_order_number && workOrder.work_order_number.toLowerCase().includes(term)) ||
        (workOrder.description && workOrder.description.toLowerCase().includes(term)) ||
        (workOrder.customer_name && workOrder.customer_name.toLowerCase().includes(term)) ||
        (workOrder.status && workOrder.status.toLowerCase().includes(term)) ||
        (workOrder.department_code && workOrder.department_code.toLowerCase().includes(term)) ||
        (workOrder.primary_market && workOrder.primary_market.toLowerCase().includes(term)) ||
        (workOrder.project_manager_name && workOrder.project_manager_name.toLowerCase().includes(term)) ||
        (workOrder.entered_date && new Date(workOrder.entered_date).toLocaleDateString('en-US').toLowerCase().includes(term))
      );
    });
  }, [workOrders, statusFilter, departmentFilter, marketFilter, searchTerm]);

  // Sort work orders
  const sortedWorkOrders = useMemo(() => {
    return [...filteredWorkOrders].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'work_order_number':
          // Extract numeric portion for proper numeric sorting
          const aNum = parseInt((a.work_order_number || '').replace(/\D/g, ''), 10) || 0;
          const bNum = parseInt((b.work_order_number || '').replace(/\D/g, ''), 10) || 0;
          aValue = aNum;
          bValue = bNum;
          break;
        case 'description':
          aValue = (a.description || '').toLowerCase();
          bValue = (b.description || '').toLowerCase();
          break;
        case 'contract_amount':
          aValue = a.contract_amount || 0;
          bValue = b.contract_amount || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'department':
          aValue = (a.department_code || '').toLowerCase();
          bValue = (b.department_code || '').toLowerCase();
          break;
        case 'backlog':
          aValue = a.backlog || 0;
          bValue = b.backlog || 0;
          break;
        case 'gross_margin':
          aValue = a.gross_profit_percent || 0;
          bValue = b.gross_profit_percent || 0;
          break;
        case 'manager':
          aValue = (a.project_manager_name || '').toLowerCase();
          bValue = (b.project_manager_name || '').toLowerCase();
          break;
        case 'entered_date':
          aValue = a.entered_date ? new Date(a.entered_date).getTime() : 0;
          bValue = b.entered_date ? new Date(b.entered_date).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredWorkOrders, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedWorkOrders.length / pageSize);
  const paginatedWorkOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedWorkOrders.slice(startIndex, startIndex + pageSize);
  }, [sortedWorkOrders, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Calculate KPIs from filtered work orders (all, not just paginated)
  const kpis = useMemo(() => ({
    workOrderCount: filteredWorkOrders.length,
    totalContractValue: filteredWorkOrders.reduce((sum, w) => sum + (Number(w.contract_amount) || 0), 0),
    totalBacklog: filteredWorkOrders.reduce((sum, w) => sum + (Number(w.backlog) || 0), 0),
    avgGrossMargin: filteredWorkOrders.filter(w => w.gross_profit_percent !== undefined && w.gross_profit_percent !== null).length > 0
      ? filteredWorkOrders.reduce((sum, w) => sum + (Number(w.gross_profit_percent) || 0), 0) / filteredWorkOrders.filter(w => w.gross_profit_percent !== undefined && w.gross_profit_percent !== null).length
      : 0,
    avgWorkOrderValue: filteredWorkOrders.length > 0
      ? filteredWorkOrders.reduce((sum, w) => sum + (Number(w.contract_amount) || 0), 0) / filteredWorkOrders.length
      : 0
  }), [filteredWorkOrders]);

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading work orders...</div>
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
            <h1>🔧 Work Orders</h1>
            <div className="sales-subtitle">Vista work orders imported from ERP</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
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
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Work Order Count</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b' }}>{kpis.workOrderCount.toLocaleString()}</div>
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
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Avg. WO Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f59e0b' }}>${Math.round(kpis.avgWorkOrderValue).toLocaleString()}</div>
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
              placeholder="Search work orders..."
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Status</label>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
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
            onChange={(e) => handleFilterChange(setDepartmentFilter, e.target.value)}
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
            onChange={(e) => handleFilterChange(setMarketFilter, e.target.value)}
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
              setCurrentPage(1);
            }}
            style={{ padding: '0.5rem 1rem', height: 'fit-content' }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">
            All Work Orders
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({filteredWorkOrders.length.toLocaleString()} of {(workOrders || []).length.toLocaleString()})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Show:</span>
            <select
              className="form-input"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('work_order_number')}>
                Number <span className="sales-sort-icon">{sortColumn === 'work_order_number' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('entered_date')}>
                Entered Date <span className="sales-sort-icon">{sortColumn === 'entered_date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('description')}>
                Work Order <span className="sales-sort-icon">{sortColumn === 'description' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('contract_amount')}>
                Contract Value <span className="sales-sort-icon">{sortColumn === 'contract_amount' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
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
            {paginatedWorkOrders.length > 0 ? (
              paginatedWorkOrders.map((workOrder: VPWorkOrder) => (
                <tr
                  key={workOrder.id}
                  onClick={() => navigate(`/account-management/work-orders/${workOrder.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{workOrder.work_order_number}</td>
                  <td>{workOrder.entered_date ? new Date(workOrder.entered_date).toLocaleDateString('en-US') : '-'}</td>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: getMarketGradient(workOrder.primary_market) }}>
                        {getMarketIcon(workOrder.primary_market)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{workOrder.description || 'No description'}</h4>
                        <span>{workOrder.customer_name || 'No customer specified'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{workOrder.contract_amount ? `$${Number(workOrder.contract_amount).toLocaleString()}` : '-'}</td>
                  <td style={{ color: workOrder.gross_profit_percent && workOrder.gross_profit_percent > 0 ? '#10b981' : workOrder.gross_profit_percent && workOrder.gross_profit_percent < 0 ? '#ef4444' : 'inherit' }}>
                    {workOrder.gross_profit_percent !== undefined && workOrder.gross_profit_percent !== null ? `${(Number(workOrder.gross_profit_percent) * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td>{workOrder.backlog ? `$${Number(workOrder.backlog).toLocaleString()}` : '-'}</td>
                  <td>
                    <span className={`sales-stage-badge ${(workOrder.status || '').toLowerCase().replace('-', '_')}`}>
                      <span className="sales-stage-dot" style={{ background: getStatusColor(workOrder.status) }}></span>
                      {workOrder.status || 'Unknown'}
                    </span>
                  </td>
                  <td>{workOrder.department_code || '-'}</td>
                  <td>
                    <div className="sales-salesperson-cell">
                      <div
                        className="sales-salesperson-avatar"
                        style={{ background: getManagerColor(workOrder.project_manager_name || 'Unassigned') }}
                      >
                        {getManagerInitials(workOrder.project_manager_name)}
                      </div>
                      {workOrder.project_manager_name || 'Unassigned'}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
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
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No work orders found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Import work orders from Vista to see them here'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedWorkOrders.length)} of {sortedWorkOrders.length.toLocaleString()} work orders
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="sales-btn sales-btn-secondary"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{ padding: '0.5rem 0.75rem', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                First
              </button>
              <button
                className="sales-btn sales-btn-secondary"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '0.5rem 0.75rem', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ padding: '0 1rem', fontSize: '0.875rem', color: '#1e293b' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="sales-btn sales-btn-secondary"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 0.75rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
              <button
                className="sales-btn sales-btn-secondary"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{ padding: '0.5rem 0.75rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkOrderList;
