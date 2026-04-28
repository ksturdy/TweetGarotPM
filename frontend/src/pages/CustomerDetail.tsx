import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCustomer,
  getCompanyMetrics,
  getCompanyProjects,
  getCompanyBids,
  getCompanyOpportunities,
  getCustomerWorkOrders,
  getCustomerContacts,
  getCustomerLocations,
  createCustomerLocation,
  updateCustomerLocation,
  deleteCustomerLocation,
  customersApi,
  CustomerLocation
} from '../services/customers';
import CustomerFormModal from '../components/modals/CustomerFormModal';
import ContactModal from '../components/modals/ContactModal';
import AssessmentScoring from '../components/assessments/AssessmentScoring';
import { assessmentsApi } from '../services/assessments';
import { useTitanFeedback } from '../context/TitanFeedbackContext';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

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
type ProjectSortField = 'number' | 'name' | 'date' | 'contract_value' | 'backlog' | 'status';

const SortIcon: React.FC<{ active: boolean; direction: SortDirection }> = ({ active, direction }) => (
  <span className={`cd-sort-icon ${active ? 'active' : ''}`}>
    {direction === 'desc' ? '▼' : '▲'}
  </span>
);

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [merging, setMerging] = useState(false);

  // Sorting state
  const [woSortField, setWoSortField] = useState<WorkOrderSortField>('work_order_number');
  const [woSortDir, setWoSortDir] = useState<SortDirection>('desc');
  const [projSortField, setProjSortField] = useState<ProjectSortField>('number');
  const [projSortDir, setProjSortDir] = useState<SortDirection>('desc');

  // Fetch data
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: metrics } = useQuery({
    queryKey: ['company-metrics', id],
    queryFn: () => getCompanyMetrics(id!),
    enabled: !!customer,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['customer-projects', id],
    queryFn: () => getCompanyProjects(id!),
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ['customer-bids', id],
    queryFn: () => getCompanyBids(id!),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['customer-opportunities', id],
    queryFn: () => getCompanyOpportunities(id!),
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['customer-work-orders', id],
    queryFn: () => getCustomerWorkOrders(id!),
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['customer-contacts', id],
    queryFn: () => getCustomerContacts(id!),
  });

  const { data: locations = [] } = useQuery<CustomerLocation[]>({
    queryKey: ['customer-locations', id],
    queryFn: () => getCustomerLocations(id!),
  });

  // Inline add state
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');
  const [editLocCity, setEditLocCity] = useState('');
  const [editLocState, setEditLocState] = useState('');
  const [editLocZip, setEditLocZip] = useState('');
  const [deleteLocConfirm, setDeleteLocConfirm] = useState<number | null>(null);
  const locInputRef = useRef<HTMLInputElement>(null);
  const editLocRef = useRef<HTMLInputElement>(null);
  const addLocationMutation = useMutation({
    mutationFn: (name: string) => createCustomerLocation(id!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-locations', id] });
      setNewLocationName('');
      setAddingLocation(false);
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: (data: { id: number; name: string; address?: string; city?: string; state?: string; zip_code?: string }) =>
      updateCustomerLocation(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-locations', id] });
      setEditingLocationId(null);
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: number) => deleteCustomerLocation(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-locations', id] });
      setDeleteLocConfirm(null);
    },
    onError: () => {
      toast.error('Failed to delete location. Please try again.');
      setDeleteLocConfirm(null);
    },
  });

  const startEditLocation = (loc: CustomerLocation) => {
    setEditingLocationId(loc.id);
    setEditLocName(loc.name);
    setEditLocAddress(loc.address || '');
    setEditLocCity(loc.city || '');
    setEditLocState(loc.state || '');
    setEditLocZip(loc.zip_code || '');
    setTimeout(() => editLocRef.current?.focus(), 50);
  };

  const saveEditLocation = () => {
    if (editingLocationId && editLocName.trim()) {
      updateLocationMutation.mutate({
        id: editingLocationId,
        name: editLocName.trim(),
        address: editLocAddress.trim() || undefined,
        city: editLocCity.trim() || undefined,
        state: editLocState.trim() || undefined,
        zip_code: editLocZip.trim() || undefined,
      });
    }
  };

  const cancelEditLocation = () => {
    setEditingLocationId(null);
    setEditLocName('');
    setEditLocAddress('');
    setEditLocCity('');
    setEditLocState('');
    setEditLocZip('');
  };


  const { data: assessmentData } = useQuery({
    queryKey: ['assessment', id],
    queryFn: async () => {
      try {
        const res = await assessmentsApi.getCurrent(Number(id));
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!customer,
  });

  // Fetch all customers for merge target selection (only if this is a prospect)
  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
    enabled: customer?.customer_type === 'prospect',
  });

  const mergeTargets = useMemo(() =>
    allCustomers.filter((c: any) => c.customer_type !== 'prospect' && c.id !== Number(id)),
    [allCustomers, id]
  );

  const handleMerge = async () => {
    if (!mergeTargetId || merging) return;
    setMerging(true);
    try {
      await customersApi.merge(Number(id), Number(mergeTargetId));
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate(`/account-management/customers/${mergeTargetId}`);
    } catch (err) {
      console.error('Merge failed:', err);
      setMerging(false);
    }
  };

  // Sort work orders
  const sortedWorkOrders = useMemo(() => {
    if (!workOrders.length) return [];
    return [...workOrders].sort((a: any, b: any) => {
      let aVal = a[woSortField];
      let bVal = b[woSortField];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (woSortField === 'contract_amount') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }
      if (woSortField === 'entered_date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
        return woSortDir === 'asc' ? comparison : -comparison;
      }
      return woSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [workOrders, woSortField, woSortDir]);

  // Sort projects
  const sortedProjects = useMemo(() => {
    if (!projects.length) return [];
    return [...projects].sort((a: any, b: any) => {
      let aVal = a[projSortField];
      let bVal = b[projSortField];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (projSortField === 'date') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
        return projSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (projSortField === 'contract_value' || projSortField === 'backlog') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
        return projSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
        return projSortDir === 'asc' ? comparison : -comparison;
      }
      return projSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [projects, projSortField, projSortDir]);

  const handleWoSort = (field: WorkOrderSortField) => {
    if (woSortField === field) setWoSortDir(woSortDir === 'asc' ? 'desc' : 'asc');
    else { setWoSortField(field); setWoSortDir('desc'); }
  };

  const handleProjSort = (field: ProjectSortField) => {
    if (projSortField === field) setProjSortDir(projSortDir === 'asc' ? 'desc' : 'asc');
    else { setProjSortField(field); setProjSortDir('desc'); }
  };

  if (customerLoading) {
    return <div className="customer-detail-page"><div className="loading-state">Loading...</div></div>;
  }

  if (!customer) {
    return <div className="customer-detail-page"><div className="error-state">Customer not found</div></div>;
  }

  const formatCurrency = (value: number | string | null | undefined) => {
    const num = typeof value === 'string' ? parseFloat(value) : (value || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const displayName = customer.name || 'Unnamed Company';

  return (
    <div className="customer-detail-page">
      {/* Row 1: Header Strip */}
      <div className="cd-header">
        <div className="sales-page-header">
          <div className="sales-page-title">
            <div>
              <Link to="/account-management/customers" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '10px' }}>
                &larr; Back to Customers
              </Link>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                👥 {displayName}
                {customer.customer_type === 'prospect' && (
                  <span style={{
                    fontSize: '0.55em',
                    padding: '2px 8px',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '4px',
                    fontWeight: 600,
                    verticalAlign: 'middle'
                  }}>PROSPECT</span>
                )}
              </h1>
              <div className="sales-subtitle">
                {customer.city && customer.state ? `${customer.city}, ${customer.state}` : ''}
              </div>
            </div>
          </div>
          <div className="cd-header-right">
            <div className="cd-quick-tags">
              {customer.market && <span className="cd-tag"><span className="cd-tag-icon">🏢</span>{customer.market}</span>}
              {customer.account_manager && <span className="cd-tag"><span className="cd-tag-icon">👤</span>{customer.account_manager}</span>}
              {customer.active_customer && <span className="cd-tag cd-tag-active"><span className="cd-tag-dot"></span>Active</span>}
            </div>
            <button className={`cd-info-toggle ${showInfoDrawer ? 'active' : ''}`} onClick={() => setShowInfoDrawer(!showInfoDrawer)}>
              ℹ️ Info
            </button>
            {customer.customer_type === 'prospect' && (
              <button className="sales-btn sales-btn-secondary" onClick={() => setShowMergeModal(true)}>
                Merge into Customer
              </button>
            )}
            <button className="sales-btn sales-btn-secondary" onClick={() => setShowAssessment(true)}>
              📊 Score
            </button>
            <button className="sales-btn sales-btn-secondary" onClick={() => setShowEditModal(true)}>
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Collapsible Info Drawer */}
      {showInfoDrawer && (
        <div className="cd-info-drawer">
          <div className="cd-info-drawer-content">
            <div className="cd-info-section">
              <div className="cd-info-section-header">
                <h4>Vista Information</h4>
                <span className="cd-readonly-badge">Read Only</span>
              </div>
              <div className="cd-info-grid">
                <div className="cd-info-item">
                  <span className="cd-info-label">Company</span>
                  <span className="cd-info-value">{customer.customer_owner || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">Facility</span>
                  <span className="cd-info-value">{customer.customer_facility || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">Customer #</span>
                  <span className="cd-info-value">{customer.customer_number || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">Address</span>
                  <span className="cd-info-value">{customer.address || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">City</span>
                  <span className="cd-info-value">{customer.city || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">State</span>
                  <span className="cd-info-value">{customer.state || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">Market</span>
                  <span className="cd-info-value">{customer.market || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">Account Mgr</span>
                  <span className="cd-info-value">{customer.account_manager || '-'}</span>
                </div>
                <div className="cd-info-item">
                  <span className="cd-info-label">Status</span>
                  <span className="cd-info-value">{customer.active_customer ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>
            <div className="cd-info-section">
              <div className="cd-info-section-header">
                <h4>Titan Information</h4>
                <button onClick={() => setShowEditModal(true)} className="cd-edit-btn">✏️ Edit</button>
              </div>
              <div className="cd-info-grid">
                <div className="cd-info-item cd-info-item-full">
                  <span className="cd-info-label">Notes</span>
                  <span className="cd-info-value cd-notes-value">{customer.notes || 'No notes added'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 3: KPI Strip */}
      <div className="cd-kpi-grid">
        <div
          className={`cd-kpi-card ${assessmentData ? (assessmentData.verdict === 'GO' ? 'green' : assessmentData.verdict === 'MAYBE' ? 'amber' : 'rose') : 'cyan'}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setShowAssessment(true)}
          title={assessmentData ? `${assessmentData.verdict.replace('_', ' ')}${assessmentData.tier ? ` — Tier ${assessmentData.tier}` : ''}${assessmentData.knockout ? ' (KNOCKOUT)' : ''}\nClick to edit` : 'Click to score this customer'}
        >
          <div className="cd-kpi-value">
            {assessmentData
              ? `${assessmentData.total_score}${assessmentData.tier ? ` · ${assessmentData.tier}` : ''}`
              : '—'}
          </div>
          <div className="cd-kpi-label">Customer Score</div>
        </div>
        <div className="cd-kpi-card green" title={`WO: ${formatCurrency(metrics?.wo_ytd_revenue)} | Proj: ${formatCurrency(metrics?.proj_ytd_revenue)}`}>
          <div className="cd-kpi-value">{formatCurrency(metrics?.ytd_revenue)}</div>
          <div className="cd-kpi-label">YTD Sales</div>
        </div>
        <div className="cd-kpi-card blue" title={`WO: ${formatCurrency(metrics?.wo_avg_annual_revenue)} | Proj: ${formatCurrency(metrics?.proj_avg_annual_revenue)}`}>
          <div className="cd-kpi-value">{formatCurrency(metrics?.avg_annual_revenue)}</div>
          <div className="cd-kpi-label">Avg Annual ({metrics?.year_span || 1} yr{(metrics?.year_span || 1) > 1 ? 's' : ''})</div>
        </div>
        <div className="cd-kpi-card amber" title={`Proj: ${metrics?.proj_gm_percent || 0}% | Est: ${metrics?.estimate_gm_percent || 0}%`}>
          <div className="cd-kpi-value">{metrics?.avg_gm_percent || 0}%</div>
          <div className="cd-kpi-label">Avg GM%</div>
        </div>
        <div className="cd-kpi-card purple" title={`WO: ${formatCurrency(metrics?.wo_backlog)} | Proj: ${formatCurrency(metrics?.proj_backlog)}`}>
          <div className="cd-kpi-value">{formatCurrency(metrics?.total_backlog)}</div>
          <div className="cd-kpi-label">Backlog</div>
        </div>
        <div className="cd-kpi-card cyan">
          <div className="cd-kpi-value">{metrics?.hit_rate || 0}%</div>
          <div className="cd-kpi-label">Hit Rate</div>
        </div>
        <div className="cd-kpi-card rose">
          <div className="cd-kpi-value">{formatCurrency(metrics?.pipeline_value)}</div>
          <div className="cd-kpi-label">Pipeline</div>
        </div>
      </div>

      {/* Row 4: Main Content */}
      <div className="cd-main-grid">
        {/* Left Column: Locations + Contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
          {/* Locations */}
          <div className="cd-locations-panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="cd-panel-header">
              <h3><span className="cd-panel-icon">📍</span> Locations <span className="cd-count">{locations.length}</span></h3>
              <button
                className="sales-btn sales-btn-primary"
                onClick={() => { setAddingLocation(true); setTimeout(() => locInputRef.current?.focus(), 50); }}
                title="Add location"
                style={{ padding: '2px 8px', fontSize: '10px' }}
              >+ New</button>
            </div>
            <div className="cd-locations-list">
              {addingLocation && (
                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '4px' }}>
                  <input
                    ref={locInputRef}
                    type="text"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLocationName.trim()) addLocationMutation.mutate(newLocationName.trim());
                      if (e.key === 'Escape') { setAddingLocation(false); setNewLocationName(''); }
                    }}
                    placeholder="Location name..."
                    style={{ flex: 1, fontSize: '11px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                  />
                  <button
                    onClick={() => newLocationName.trim() && addLocationMutation.mutate(newLocationName.trim())}
                    disabled={!newLocationName.trim() || addLocationMutation.isPending}
                    style={{ fontSize: '10px', padding: '2px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: !newLocationName.trim() ? 0.5 : 1 }}
                  >{addLocationMutation.isPending ? '...' : 'Add'}</button>
                  <button
                    onClick={() => { setAddingLocation(false); setNewLocationName(''); }}
                    style={{ fontSize: '10px', padding: '2px 6px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              )}
              {locations.length === 0 && !addingLocation ? (
                <div className="cd-empty-mini">No locations added</div>
              ) : (
                locations.map((loc: CustomerLocation) => (
                  editingLocationId === loc.id ? (
                    <div key={loc.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        ref={editLocRef}
                        type="text"
                        value={editLocName}
                        onChange={(e) => setEditLocName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                        placeholder="Name *"
                        style={{ fontSize: '11px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
                      />
                      <input
                        type="text"
                        value={editLocAddress}
                        onChange={(e) => setEditLocAddress(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                        placeholder="Address"
                        style={{ fontSize: '11px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          value={editLocCity}
                          onChange={(e) => setEditLocCity(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          placeholder="City"
                          style={{ flex: 2, fontSize: '11px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                        />
                        <input
                          type="text"
                          value={editLocState}
                          onChange={(e) => setEditLocState(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          placeholder="State"
                          style={{ flex: 1, fontSize: '11px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                        />
                        <input
                          type="text"
                          value={editLocZip}
                          onChange={(e) => setEditLocZip(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          placeholder="Zip"
                          style={{ flex: 1, fontSize: '11px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={saveEditLocation}
                          disabled={!editLocName.trim() || updateLocationMutation.isPending}
                          style={{ fontSize: '10px', padding: '2px 8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: !editLocName.trim() ? 0.5 : 1 }}
                        >{updateLocationMutation.isPending ? '...' : 'Save'}</button>
                        <button
                          onClick={cancelEditLocation}
                          style={{ fontSize: '10px', padding: '2px 6px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                        >Cancel</button>
                      </div>
                    </div>
                  ) : deleteLocConfirm === loc.id ? (
                    <div key={loc.id} className="cd-location-item" style={{ background: '#fef2f2', borderLeftColor: '#ef4444' }}>
                      <div className="cd-location-info">
                        <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>Delete "{loc.name}"?</div>
                        <div style={{ fontSize: '10px', color: '#b91c1c' }}>This cannot be undone. Opportunities linked to this location will be unlinked.</div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => deleteLocationMutation.mutate(loc.id)}
                          disabled={deleteLocationMutation.isPending}
                          style={{ fontSize: '10px', padding: '2px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >{deleteLocationMutation.isPending ? '...' : 'Delete'}</button>
                        <button
                          onClick={() => setDeleteLocConfirm(null)}
                          style={{ fontSize: '10px', padding: '2px 6px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}
                        >Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={loc.id} className="cd-location-item" style={{ cursor: 'pointer' }} onClick={() => startEditLocation(loc)}>
                      <div className="cd-location-info">
                        <div className="cd-location-name">{loc.name}</div>
                        {(loc.address || loc.city || loc.state) && (
                          <div className="cd-location-address">
                            {loc.address && <span>{loc.address}</span>}
                            {loc.address && (loc.city || loc.state) && <span> · </span>}
                            {[loc.city, loc.state, loc.zip_code].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        className="cd-icon-btn cd-loc-delete-btn"
                        onClick={(e) => { e.stopPropagation(); setDeleteLocConfirm(loc.id); }}
                        title="Delete location"
                        style={{ fontSize: '11px', width: '20px', height: '20px', color: '#ef4444', opacity: 0 }}
                      >✕</button>
                    </div>
                  )
                ))
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="cd-locations-panel" style={{ flex: 1, minHeight: 0 }}>
            <div className="cd-panel-header">
              <h3><span className="cd-panel-icon">👥</span> Contacts <span className="cd-count">{contacts.length}</span></h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="sales-btn"
                  onClick={() => navigate(`/customers/${id}/org-chart`)}
                  title="View org chart"
                  style={{ padding: '2px 8px', fontSize: '10px', background: '#10b981', color: 'white' }}
                >Org Chart</button>
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={() => setShowContactModal(true)}
                  title="Add contact"
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >+ New</button>
                <button
                  className="sales-btn"
                  onClick={() => navigate(`/customers/${id}/contacts`)}
                  title="View all contacts"
                  style={{ padding: '2px 8px', fontSize: '10px', background: '#3b82f6', color: 'white' }}
                >Contacts</button>
              </div>
            </div>
            <div className="cd-locations-list">
              {contacts.length === 0 ? (
                <div className="cd-empty-mini">No contacts added</div>
              ) : (
                contacts.map((contact: Contact) => (
                  <div key={contact.id} className="cd-location-item" onClick={() => navigate(`/customers/${id}/contacts`)} style={{ cursor: 'pointer' }}>
                    <div className="cd-location-info">
                      <div className="cd-location-name">
                        {contact.first_name} {contact.last_name}
                        {contact.is_primary && <span style={{ fontSize: '8px', marginLeft: '4px', color: '#3b82f6', fontWeight: 600 }}>PRIMARY</span>}
                      </div>
                      <div className="cd-location-address">
                        {[contact.title, contact.email, contact.phone].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Projects */}
        <div className="cd-module-card">
          <div className="cd-module-header">
            <span className="cd-module-title">🏗️ Projects <span className="cd-count">{projects.length}</span></span>
          </div>
          <div className="cd-module-body">
            {sortedProjects.length === 0 ? (
              <div className="cd-empty-state"><p>No projects</p></div>
            ) : (
              <table className="cd-table cd-projects-table">
                <colgroup>
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="cd-sortable" onClick={() => handleProjSort('number')}># <SortIcon active={projSortField === 'number'} direction={projSortDir} /></th>
                    <th className="cd-sortable" onClick={() => handleProjSort('name')}>Project <SortIcon active={projSortField === 'name'} direction={projSortDir} /></th>
                    <th>PM</th>
                    <th className="cd-sortable" onClick={() => handleProjSort('date')}>Date <SortIcon active={projSortField === 'date'} direction={projSortDir} /></th>
                    <th className="cd-sortable" onClick={() => handleProjSort('contract_value')}>Value <SortIcon active={projSortField === 'contract_value'} direction={projSortDir} /></th>
                    <th className="cd-sortable" onClick={() => handleProjSort('backlog')}>Backlog <SortIcon active={projSortField === 'backlog'} direction={projSortDir} /></th>
                    <th className="cd-sortable" onClick={() => handleProjSort('status')}>Status <SortIcon active={projSortField === 'status'} direction={projSortDir} /></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((project: any) => (
                    <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                      <td><strong>{project.number || '-'}</strong></td>
                      <td className="cd-truncate">{project.name}</td>
                      <td className="cd-truncate">{project.manager_name || '-'}</td>
                      <td>{formatDate(project.date)}</td>
                      <td>{formatCurrency(project.contract_value)}</td>
                      <td>{formatCurrency(project.backlog)}</td>
                      <td><span className={`cd-status cd-status-${(project.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{project.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bottom Row: Work Orders, Estimates, Opportunities */}
        <div className="cd-modules-row">
          {/* Work Orders */}
          <div className="cd-module-card">
            <div className="cd-module-header">
              <span className="cd-module-title">🔧 Work Orders <span className="cd-count">{workOrders.length}</span></span>
            </div>
            <div className="cd-module-body">
              {sortedWorkOrders.length === 0 ? (
                <div className="cd-empty-state"><p>No work orders</p></div>
              ) : (
                <table className="cd-table">
                  <thead>
                    <tr>
                      <th className="cd-sortable" onClick={() => handleWoSort('work_order_number')}>WO # <SortIcon active={woSortField === 'work_order_number'} direction={woSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleWoSort('description')}>Description <SortIcon active={woSortField === 'description'} direction={woSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleWoSort('entered_date')}>Date <SortIcon active={woSortField === 'entered_date'} direction={woSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleWoSort('contract_amount')}>Amount <SortIcon active={woSortField === 'contract_amount'} direction={woSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleWoSort('status')}>Status <SortIcon active={woSortField === 'status'} direction={woSortDir} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWorkOrders.map((wo: any) => (
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
            </div>
          </div>

          {/* Estimates */}
          <div className="cd-module-card">
            <div className="cd-module-header">
              <span className="cd-module-title">📊 Estimates <span className="cd-count">{estimates.length}</span></span>
              <button
                className="sales-btn sales-btn-primary"
                style={{ padding: '2px 8px', fontSize: '10px' }}
                onClick={() => navigate('/estimating/estimates/new', {
                  state: {
                    customerId: parseInt(id!),
                    customerName: displayName,
                  }
                })}
              >
                + New
              </button>
            </div>
            <div className="cd-module-body">
              {estimates.length === 0 ? (
                <div className="cd-empty-state"><p>No estimates</p></div>
              ) : (
                <table className="cd-table">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '38%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '10%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Estimate</th>
                      <th>Stage</th>
                      <th>Value</th>
                      <th>GM%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((estimate: any) => (
                      <tr key={estimate.id} onClick={() => navigate(`/estimating/estimates/${estimate.id}`)} style={{ cursor: 'pointer' }}>
                        <td>{formatDate(estimate.date)}</td>
                        <td className="cd-truncate"><strong>{estimate.name?.includes(' - ') ? estimate.name.split(' - ').slice(1).join(' - ') : estimate.name}</strong></td>
                        <td><span className={`cd-status cd-status-${(estimate.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{estimate.status || '-'}</span></td>
                        <td>{formatCurrency(estimate.value)}</td>
                        <td>{estimate.gm_percent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Opportunities */}
          <div className="cd-module-card">
            <div className="cd-module-header">
              <span className="cd-module-title">💼 Opportunities <span className="cd-count">{opportunities.length}</span></span>
              <button
                className="sales-btn sales-btn-primary"
                style={{ padding: '2px 8px', fontSize: '10px' }}
                onClick={() => navigate('/sales/pipeline/new', { state: { customerId: parseInt(id!) } })}
              >
                + New
              </button>
            </div>
            <div className="cd-module-body">
              {opportunities.length === 0 ? (
                <div className="cd-empty-state"><p>No opportunities</p></div>
              ) : (
                <table className="cd-table">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opportunity</th>
                      <th>Assigned</th>
                      <th>Stage</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp: any) => (
                      <tr key={opp.id} onClick={() => navigate('/sales', { state: { selectedOpportunityId: opp.id } })} style={{ cursor: 'pointer' }}>
                        <td>{formatDate(opp.created_at)}</td>
                        <td className="cd-truncate"><strong>{opp.title}</strong></td>
                        <td className="cd-truncate">{opp.assigned_to_name || '-'}</td>
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
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showContactModal && (
        <ContactModal
          customerId={parseInt(id!)}
          customerName={displayName}
          onClose={() => setShowContactModal(false)}
        />
      )}

      {showEditModal && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
          onDelete={() => navigate('/account-management/customers')}
        />
      )}

      {showAssessment && (
        <AssessmentScoring
          customerId={Number(id)}
          customerName={displayName}
          onClose={() => {
            setShowAssessment(false);
            queryClient.invalidateQueries({ queryKey: ['assessment', id] });
          }}
        />
      )}

      {showMergeModal && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem' }}>Merge Prospect into Customer</h2>
              <button className="modal-close" onClick={() => setShowMergeModal(false)}>&times;</button>
            </div>
            <div style={{ padding: '1rem 1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
                This will re-link all opportunities and estimates from <strong>{displayName}</strong> to
                the selected customer, then delete this prospect record.
              </p>
              <div className="form-group">
                <label className="form-label">Merge into:</label>
                <select
                  className="form-input"
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                >
                  <option value="">-- Select a customer --</option>
                  {mergeTargets.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.customer_number ? ` (#${c.customer_number})` : ''}{c.city && c.state ? ` — ${c.city}, ${c.state}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="sales-btn sales-btn-secondary" onClick={() => setShowMergeModal(false)}>
                Cancel
              </button>
              <button
                className="sales-btn sales-btn-primary"
                onClick={handleMerge}
                disabled={!mergeTargetId || merging}
              >
                {merging ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetail;
