import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getCustomer,
  getCompanyMetrics,
  getCompanyFacilities,
  getCustomerProjects,
  getCustomerBids,
  getCustomerOpportunities,
  getCustomerWorkOrders,
  getCustomerContacts,
  getCompanyProjects,
  getCompanyBids,
  getCompanyOpportunities,
  Customer
} from '../services/customers';
import CustomerFormModal from '../components/modals/CustomerFormModal';
import './CustomerDetail.css';

interface Facility extends Customer {
  estimate_count: number;
  project_count: number;
  work_order_count: number;
}

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary: boolean;
}

type SortDirection = 'asc' | 'desc';
type WorkOrderSortField = 'work_order_number' | 'description' | 'entered_date' | 'contract_amount' | 'status';
type ProjectSortField = 'number' | 'name' | 'date' | 'contract_value' | 'status';

const SortIcon: React.FC<{ active: boolean; direction: SortDirection }> = ({ active, direction }) => (
  <span className={`cd-sort-icon ${active ? 'active' : ''}`}>
    {direction === 'desc' ? '▼' : '▲'}
  </span>
);

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(null);

  // Sorting state for work orders
  const [woSortField, setWoSortField] = useState<WorkOrderSortField>('work_order_number');
  const [woSortDir, setWoSortDir] = useState<SortDirection>('desc');

  // Sorting state for projects
  const [projSortField, setProjSortField] = useState<ProjectSortField>('number');
  const [projSortDir, setProjSortDir] = useState<SortDirection>('desc');

  // Fetch main customer data
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  // Fetch company metrics (aggregated across all facilities, or filtered by selected facility)
  const { data: metrics } = useQuery({
    queryKey: ['company-metrics', id, selectedFacilityId],
    queryFn: () => getCompanyMetrics(id!, selectedFacilityId || undefined),
    enabled: !!customer,
  });

  // Fetch all facilities for this company
  const { data: facilities = [] } = useQuery<Facility[]>({
    queryKey: ['company-facilities', id],
    queryFn: () => getCompanyFacilities(id!),
    enabled: !!customer,
  });

  // Fetch data for the selected facility, or company-wide if none selected
  const activeFacilityId = selectedFacilityId || parseInt(id!);
  const isCompanyView = !selectedFacilityId;

  // Projects: company-wide or facility-specific
  const { data: projects = [] } = useQuery({
    queryKey: ['customer-projects', id, selectedFacilityId],
    queryFn: () => isCompanyView
      ? getCompanyProjects(id!)
      : getCustomerProjects(String(activeFacilityId)),
  });

  // Estimates: company-wide or facility-specific
  const { data: estimates = [] } = useQuery({
    queryKey: ['customer-bids', id, selectedFacilityId],
    queryFn: () => isCompanyView
      ? getCompanyBids(id!)
      : getCustomerBids(String(activeFacilityId)),
  });

  // Opportunities: company-wide or facility-specific
  const { data: opportunities = [] } = useQuery({
    queryKey: ['customer-opportunities', id, selectedFacilityId],
    queryFn: () => isCompanyView
      ? getCompanyOpportunities(id!)
      : getCustomerOpportunities(String(activeFacilityId)),
  });

  // Work orders: company-wide (with all=true) or facility-specific
  const { data: workOrders = [] } = useQuery({
    queryKey: ['customer-work-orders', id, selectedFacilityId],
    queryFn: () => getCustomerWorkOrders(id!, isCompanyView),
  });

  // Contacts: always for the active facility
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['customer-contacts', activeFacilityId],
    queryFn: () => getCustomerContacts(String(activeFacilityId)),
  });

  // Sort work orders
  const sortedWorkOrders = useMemo(() => {
    if (!workOrders.length) return [];
    return [...workOrders].sort((a: any, b: any) => {
      let aVal = a[woSortField];
      let bVal = b[woSortField];

      // Handle nulls
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Numeric comparison for amounts
      if (woSortField === 'contract_amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      // Date comparison
      if (woSortField === 'entered_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
        return woSortDir === 'asc' ? comparison : -comparison;
      }

      // Numeric comparison
      if (woSortDir === 'asc') return aVal - bVal;
      return bVal - aVal;
    });
  }, [workOrders, woSortField, woSortDir]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    if (!projects.length) return [];
    return [...projects].sort((a: any, b: any) => {
      let aVal = a[projSortField];
      let bVal = b[projSortField];

      // Handle nulls
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      // Date comparison
      if (projSortField === 'date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
        if (projSortDir === 'asc') return aVal - bVal;
        return bVal - aVal;
      }

      // Numeric comparison for contract_value
      if (projSortField === 'contract_value') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
        if (projSortDir === 'asc') return aVal - bVal;
        return bVal - aVal;
      }

      // String comparison (handles alphanumeric project numbers)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
        return projSortDir === 'asc' ? comparison : -comparison;
      }

      // Numeric comparison
      if (projSortDir === 'asc') return aVal - bVal;
      return bVal - aVal;
    });
  }, [projects, projSortField, projSortDir]);

  // Sort handlers
  const handleWoSort = (field: WorkOrderSortField) => {
    if (woSortField === field) {
      setWoSortDir(woSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setWoSortField(field);
      setWoSortDir('desc');
    }
  };

  const handleProjSort = (field: ProjectSortField) => {
    if (projSortField === field) {
      setProjSortDir(projSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setProjSortField(field);
      setProjSortDir('desc');
    }
  };

  if (customerLoading) {
    return <div className="customer-detail-page"><div className="loading-state">Loading...</div></div>;
  }

  if (!customer) {
    return <div className="customer-detail-page"><div className="error-state">Customer not found</div></div>;
  }

  const formatCurrency = (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get selected facility info
  const selectedFacility = selectedFacilityId
    ? facilities.find(f => f.id === selectedFacilityId)
    : null;

  const displayName = customer.customer_owner || customer.customer_facility || 'Unnamed Company';

  return (
    <div className="customer-detail-page">
      {/* Header */}
      <div className="cd-header">
        <div className="cd-header-top">
          <Link to="/account-management/customers" className="cd-back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Customers
          </Link>
          <div className="cd-header-actions">
            <button onClick={() => setShowEditModal(true)} className="cd-btn cd-btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          </div>
        </div>

        <div className="cd-header-main">
          <div className="cd-company-info">
            <div className="cd-avatar" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              {getInitials(displayName)}
            </div>
            <div className="cd-company-details">
              <h1>{displayName}</h1>
              {selectedFacility ? (
                <div className="cd-facility-badge">
                  <span className="cd-facility-icon">📍</span>
                  Viewing: {selectedFacility.customer_facility}
                  <button onClick={() => setSelectedFacilityId(null)} className="cd-clear-filter">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="cd-subtitle">
                  {facilities.length > 1 ? `${facilities.length} locations` : customer.city && customer.state ? `${customer.city}, ${customer.state}` : 'No location'}
                </div>
              )}
            </div>
          </div>

          <div className="cd-quick-tags">
            {customer.market && (
              <span className="cd-tag"><span className="cd-tag-icon">🏢</span>{customer.market}</span>
            )}
            {customer.account_manager && (
              <span className="cd-tag"><span className="cd-tag-icon">👤</span>{customer.account_manager}</span>
            )}
            {customer.active_customer && (
              <span className="cd-tag cd-tag-active"><span className="cd-tag-dot"></span>Active</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="cd-kpi-grid">
        <div className="cd-kpi-card">
          <div className="cd-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>💰</div>
          <div className="cd-kpi-content">
            <div className="cd-kpi-value">{formatCurrency(metrics?.ytd_revenue)}</div>
            <div className="cd-kpi-label">YTD Sales</div>
            <div className="cd-kpi-breakdown">
              <div>WO: {formatCurrency(metrics?.wo_ytd_revenue)}</div>
              <div>Proj: {formatCurrency(metrics?.proj_ytd_revenue)}</div>
            </div>
          </div>
        </div>
        <div className="cd-kpi-card">
          <div className="cd-kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>📈</div>
          <div className="cd-kpi-content">
            <div className="cd-kpi-value">{formatCurrency(metrics?.avg_annual_revenue)}</div>
            <div className="cd-kpi-label">Avg Annual Sales ({metrics?.year_span || 1} yr{(metrics?.year_span || 1) > 1 ? 's' : ''})</div>
            <div className="cd-kpi-breakdown">
              <div>WO: {formatCurrency(metrics?.wo_avg_annual_revenue)}</div>
              <div>Proj: {formatCurrency(metrics?.proj_avg_annual_revenue)}</div>
            </div>
          </div>
        </div>
        <div className="cd-kpi-card">
          <div className="cd-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f43f5e)' }}>📊</div>
          <div className="cd-kpi-content">
            <div className="cd-kpi-value">{metrics?.avg_gm_percent || 0}%</div>
            <div className="cd-kpi-label">Avg GM%</div>
            <div className="cd-kpi-breakdown">
              <div>Proj: {metrics?.proj_gm_percent || 0}%</div>
              <div>Est: {metrics?.estimate_gm_percent || 0}%</div>
            </div>
          </div>
        </div>
        <div className="cd-kpi-card">
          <div className="cd-kpi-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>📋</div>
          <div className="cd-kpi-content">
            <div className="cd-kpi-value">{formatCurrency(metrics?.total_backlog)}</div>
            <div className="cd-kpi-label">Backlog</div>
            <div className="cd-kpi-breakdown">
              <div>WO: {formatCurrency(metrics?.wo_backlog)}</div>
              <div>Proj: {formatCurrency(metrics?.proj_backlog)}</div>
            </div>
          </div>
        </div>
        <div className="cd-kpi-card">
          <div className="cd-kpi-icon" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>🎯</div>
          <div className="cd-kpi-content">
            <div className="cd-kpi-value">{metrics?.hit_rate || 0}%</div>
            <div className="cd-kpi-label">Hit Rate</div>
          </div>
        </div>
        <div className="cd-kpi-card">
          <div className="cd-kpi-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>💼</div>
          <div className="cd-kpi-content">
            <div className="cd-kpi-value">{formatCurrency(metrics?.pipeline_value)}</div>
            <div className="cd-kpi-label">Pipeline</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="cd-main-grid">
        {/* Left Column - Locations & Contacts */}
        <div className="cd-sidebar">
          {/* Locations Section */}
          <div className="cd-section cd-locations-section">
            <div className="cd-section-header">
              <h3><span className="cd-section-icon">📍</span>Locations</h3>
              <span className="cd-count">{facilities.length}</span>
            </div>
            <div className="cd-locations-list">
              {facilities.length === 0 ? (
                <div className="cd-empty-mini">No facilities found</div>
              ) : (
                facilities.map((facility) => (
                  <div
                    key={facility.id}
                    className={`cd-location-item ${selectedFacilityId === facility.id ? 'selected' : ''} ${facility.id === parseInt(id!) && !selectedFacilityId ? 'current' : ''}`}
                    onClick={() => setSelectedFacilityId(facility.id === selectedFacilityId ? null : facility.id)}
                  >
                    <div className="cd-location-info">
                      <div className="cd-location-name">{facility.customer_facility || 'Unnamed'}</div>
                      <div className="cd-location-address">{facility.city}, {facility.state}</div>
                    </div>
                    <div className="cd-location-stats">
                      <span title="Work Orders">{facility.work_order_count || 0} WO</span>
                      <span title="Estimates">{facility.estimate_count || 0} Est</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Contacts Section */}
          <div className="cd-section cd-contacts-section">
            <div className="cd-section-header">
              <h3><span className="cd-section-icon">👥</span>Contacts</h3>
              <button
                className="cd-add-btn"
                onClick={() => navigate(`/customers/${activeFacilityId}/contacts`)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            <div className="cd-contacts-list">
              {contacts.length === 0 ? (
                <div className="cd-empty-mini">No contacts yet</div>
              ) : (
                contacts.slice(0, 5).map((contact) => (
                  <div key={contact.id} className="cd-contact-item">
                    <div className="cd-contact-avatar">
                      {getInitials(`${contact.first_name} ${contact.last_name}`)}
                    </div>
                    <div className="cd-contact-info">
                      <div className="cd-contact-name">
                        {contact.first_name} {contact.last_name}
                        {contact.is_primary && <span className="cd-primary-badge">Primary</span>}
                      </div>
                      <div className="cd-contact-title">{contact.title || contact.email || '-'}</div>
                    </div>
                  </div>
                ))
              )}
              {contacts.length > 5 && (
                <button
                  className="cd-view-all-btn"
                  onClick={() => navigate(`/customers/${activeFacilityId}/contacts`)}
                >
                  View all {contacts.length} contacts
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Data Modules */}
        <div className="cd-content">
          {/* Work Orders Module */}
          <div className="cd-module">
            <div className="cd-module-header">
              <div className="cd-module-title">
                <span className="cd-module-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>🔧</span>
                <h3>Work Orders</h3>
                <span className="cd-count">{workOrders.length}</span>
              </div>
            </div>
            <div className="cd-module-content">
              {sortedWorkOrders.length === 0 ? (
                <div className="cd-empty-state">
                  <div className="cd-empty-icon">🔧</div>
                  <p>No work orders yet</p>
                </div>
              ) : (
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th className="cd-sortable" onClick={() => handleWoSort('work_order_number')}>
                        WO # <SortIcon active={woSortField === 'work_order_number'} direction={woSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleWoSort('description')}>
                        Description <SortIcon active={woSortField === 'description'} direction={woSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleWoSort('entered_date')}>
                        Date <SortIcon active={woSortField === 'entered_date'} direction={woSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleWoSort('contract_amount')}>
                        Amount <SortIcon active={woSortField === 'contract_amount'} direction={woSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleWoSort('status')}>
                        Status <SortIcon active={woSortField === 'status'} direction={woSortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWorkOrders.slice(0, 5).map((wo: any) => (
                      <tr key={wo.id}>
                        <td><strong>{wo.work_order_number}</strong></td>
                        <td className="cd-truncate">{wo.description || '-'}</td>
                        <td>{formatDate(wo.entered_date)}</td>
                        <td>{formatCurrency(wo.contract_amount)}</td>
                        <td><span className={`cd-status cd-status-${(wo.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{wo.status || '-'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {workOrders.length > 5 && (
                <button className="cd-view-all-btn" onClick={() => navigate('/account-management/work-orders')}>
                  View all {workOrders.length} work orders
                </button>
              )}
            </div>
          </div>

          {/* Projects Module */}
          <div className="cd-module">
            <div className="cd-module-header">
              <div className="cd-module-title">
                <span className="cd-module-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>🏗️</span>
                <h3>Projects</h3>
                <span className="cd-count">{projects.length}</span>
              </div>
            </div>
            <div className="cd-module-content">
              {sortedProjects.length === 0 ? (
                <div className="cd-empty-state">
                  <div className="cd-empty-icon">🏗️</div>
                  <p>No projects yet</p>
                </div>
              ) : (
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th className="cd-sortable" onClick={() => handleProjSort('number')}>
                        # <SortIcon active={projSortField === 'number'} direction={projSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleProjSort('name')}>
                        Project Name <SortIcon active={projSortField === 'name'} direction={projSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleProjSort('date')}>
                        Date <SortIcon active={projSortField === 'date'} direction={projSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleProjSort('contract_value')}>
                        Value <SortIcon active={projSortField === 'contract_value'} direction={projSortDir} />
                      </th>
                      <th className="cd-sortable" onClick={() => handleProjSort('status')}>
                        Status <SortIcon active={projSortField === 'status'} direction={projSortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProjects.slice(0, 5).map((project: any) => (
                      <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                        <td><strong>{project.number || '-'}</strong></td>
                        <td>{project.name}</td>
                        <td>{formatDate(project.date)}</td>
                        <td>{formatCurrency(project.contract_value)}</td>
                        <td><span className={`cd-status cd-status-${(project.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{project.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {projects.length > 5 && (
                <button className="cd-view-all-btn" onClick={() => navigate(`/customers/${id}/projects`)}>
                  View all {projects.length} projects
                </button>
              )}
            </div>
          </div>

          {/* Estimates Module */}
          <div className="cd-module">
            <div className="cd-module-header">
              <div className="cd-module-title">
                <span className="cd-module-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>📊</span>
                <h3>Estimates</h3>
                <span className="cd-count">{estimates.length}</span>
              </div>
              <button
                className="cd-btn cd-btn-primary cd-btn-sm"
                onClick={() => navigate('/estimating/estimates/new', {
                  state: {
                    customerId: activeFacilityId,
                    customerName: selectedFacility?.customer_facility || customer.customer_facility || displayName,
                  }
                })}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Estimate
              </button>
            </div>
            <div className="cd-module-content">
              {estimates.length === 0 ? (
                <div className="cd-empty-state">
                  <div className="cd-empty-icon">📊</div>
                  <p>No estimates yet</p>
                </div>
              ) : (
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th>Estimate</th>
                      <th>Date</th>
                      <th>Value</th>
                      <th>GM%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.slice(0, 5).map((estimate: any) => (
                      <tr key={estimate.id} onClick={() => navigate(`/estimating/estimates/${estimate.id}`)} style={{ cursor: 'pointer' }}>
                        <td><strong>{estimate.name?.includes(' - ') ? estimate.name.split(' - ').slice(1).join(' - ') : estimate.name}</strong></td>
                        <td>{formatDate(estimate.date)}</td>
                        <td>{formatCurrency(estimate.value)}</td>
                        <td>{estimate.gm_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {estimates.length > 5 && (
                <button className="cd-view-all-btn" onClick={() => navigate(`/customers/${id}/estimates`)}>
                  View all {estimates.length} estimates
                </button>
              )}
            </div>
          </div>

          {/* Opportunities Module */}
          <div className="cd-module">
            <div className="cd-module-header">
              <div className="cd-module-title">
                <span className="cd-module-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>💼</span>
                <h3>Opportunities</h3>
                <span className="cd-count">{opportunities.length}</span>
              </div>
              <button
                className="cd-btn cd-btn-primary cd-btn-sm"
                onClick={() => navigate('/sales/pipeline/new', { state: { customerId: activeFacilityId } })}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Opportunity
              </button>
            </div>
            <div className="cd-module-content">
              {opportunities.length === 0 ? (
                <div className="cd-empty-state">
                  <div className="cd-empty-icon">💼</div>
                  <p>No opportunities yet</p>
                </div>
              ) : (
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th>Opportunity</th>
                      <th>Stage</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.slice(0, 5).map((opp: any) => (
                      <tr key={opp.id} onClick={() => navigate('/sales', { state: { opportunityId: opp.id } })} style={{ cursor: 'pointer' }}>
                        <td><strong>{opp.title}</strong></td>
                        <td>
                          {opp.stage_name && (
                            <span className="cd-stage-badge" style={{ background: opp.stage_color || '#6b7280' }}>
                              {opp.stage_name}
                            </span>
                          )}
                        </td>
                        <td>{formatCurrency(opp.estimated_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {opportunities.length > 5 && (
                <button className="cd-view-all-btn" onClick={() => navigate('/sales', { state: { customerId: parseInt(id!) } })}>
                  View all {opportunities.length} opportunities
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEditModal && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onDelete={() => navigate('/account-management/customers')}
        />
      )}
    </div>
  );
};

export default CustomerDetail;
