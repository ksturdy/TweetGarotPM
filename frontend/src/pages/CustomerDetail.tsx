import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, User, MapPin, Users, HardHat, Wrench, BarChart2, Briefcase, Info, Star, Pencil } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
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
  CustomerLocation,
  getCustomerAnnualRevenue,
  uploadCustomerLogo,
  deleteCustomerLogo,
} from '../services/customers';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend, Filler);
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
type ProjectSortField = 'number' | 'name' | 'date' | 'contract_value' | 'backlog' | 'status' | 'manager_name' | 'gm_percent';

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
  const [drillDown, setDrillDown] = useState<{ type: 'gm' | 'revenue' | 'projects' | 'hitrate' | 'bids'; year: number } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [pendingFilename, setPendingFilename] = useState('logo.png');
  const cropImgRef = useRef<HTMLImageElement>(null);
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

  // Filter state
  const [projStatusFilter, setProjStatusFilter] = useState<string[]>(['Open', 'Soft-Closed']);
  const [oppStageFilter, setOppStageFilter] = useState<string>('all');

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

  const { data: annualRevenue = [] } = useQuery({
    queryKey: ['customer-annual-revenue', id],
    queryFn: () => getCustomerAnnualRevenue(id!),
    enabled: !!customer,
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
        aVal = aVal ? new Date(aVal + 'T00:00:00').getTime() : 0;
        bVal = bVal ? new Date(bVal + 'T00:00:00').getTime() : 0;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true });
        return woSortDir === 'asc' ? comparison : -comparison;
      }
      return woSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [workOrders, woSortField, woSortDir]);

  // Derived filter options
  const oppStages = useMemo(() => {
    const seen = new Set<string>();
    return opportunities
      .map((o: any) => o.stage_name)
      .filter((s: string) => s && !seen.has(s) && seen.add(s));
  }, [opportunities]);

  // Filtered opportunities
  const filteredOpportunities = useMemo(() =>
    oppStageFilter === 'all'
      ? opportunities
      : opportunities.filter((o: any) => o.stage_name === oppStageFilter),
    [opportunities, oppStageFilter]
  );

  const parseYear = (d: any) => { if (!d) return 0; const s = String(d).includes('T') ? d : d + 'T00:00:00'; return new Date(s).getFullYear(); };

  // Project metrics (dynamic with filter)
  const projKpis = useMemo(() => {
    const yearFiltered = drillDown && ['gm', 'revenue', 'projects'].includes(drillDown.type)
      ? projects.filter((p: any) => parseYear(p.date) === drillDown.year)
      : projects;
    const list = projStatusFilter.length === 0 ? yearFiltered : yearFiltered.filter((p: any) => projStatusFilter.includes(p.status));
    const contractValue = list.reduce((s: number, p: any) => s + (parseFloat(p.contract_value) || 0), 0);
    const backlog = list.reduce((s: number, p: any) => s + (parseFloat(p.backlog) || 0), 0);
    const gcCount = list.filter((p: any) => p.relationship === 'GC' || p.relationship === 'GC & Owner').length;
    const ownerCount = list.filter((p: any) => p.relationship === 'Owner' || p.relationship === 'GC & Owner').length;
    const gmProjects = list.filter((p: any) => parseFloat(p.gm_percent) > 0 && parseFloat(p.gm_percent) < 1);
    const totalGmDollars = gmProjects.reduce((s: number, p: any) => s + (parseFloat(p.contract_value) || 0) * parseFloat(p.gm_percent), 0);
    const totalGmBase = gmProjects.reduce((s: number, p: any) => s + (parseFloat(p.contract_value) || 0), 0);
    const weightedGm = totalGmBase > 0 ? (totalGmDollars / totalGmBase) * 100 : null;
    return { contractValue, backlog, count: list.length, gcCount, ownerCount, weightedGm };
  }, [projects, projStatusFilter, drillDown]);

  // Opportunity metrics (dynamic with filter)
  const oppKpis = useMemo(() => {
    const pipeline = filteredOpportunities.reduce((s: number, o: any) => s + (parseFloat(o.estimated_value) || 0), 0);
    const avgDeal = filteredOpportunities.length > 0 ? pipeline / filteredOpportunities.length : 0;
    return { pipeline, avgDeal, count: filteredOpportunities.length };
  }, [filteredOpportunities]);

  // Bid volume by year (count of estimates per year)
  const bidVolumeByYear = useMemo(() => {
    const byYear: Record<number, number> = {};
    estimates.forEach((e: any) => {
      if (!e.date) return;
      const year = new Date(e.date.includes('T') ? e.date : e.date + 'T00:00:00').getFullYear();
      if (year < 2015) return;
      byYear[year] = (byYear[year] || 0) + 1;
    });
    return Object.entries(byYear)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year);
  }, [estimates]);

  // Project count by year
  const projectCountByYear = useMemo(() => {
    const byYear: Record<number, number> = {};
    projects.forEach((p: any) => {
      if (!p.date) return;
      const year = new Date(p.date.includes('T') ? p.date : p.date + 'T00:00:00').getFullYear();
      if (year < 2015) return;
      byYear[year] = (byYear[year] || 0) + 1;
    });
    return Object.entries(byYear)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => a.year - b.year);
  }, [projects]);

  // Sort projects (with status filter)
  const sortedProjects = useMemo(() => {
    const yearFiltered = drillDown && ['gm', 'revenue', 'projects'].includes(drillDown.type)
      ? projects.filter((p: any) => parseYear(p.date) === drillDown.year)
      : projects;
    const filtered = projStatusFilter.length === 0
      ? yearFiltered
      : yearFiltered.filter((p: any) => projStatusFilter.includes(p.status));
    if (!filtered.length) return [];
    return [...filtered].sort((a: any, b: any) => {
      let aVal = a[projSortField];
      let bVal = b[projSortField];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (projSortField === 'date') {
        aVal = aVal ? new Date(String(aVal).includes('T') ? aVal : aVal + 'T00:00:00').getTime() : 0;
        bVal = bVal ? new Date(String(bVal).includes('T') ? bVal : bVal + 'T00:00:00').getTime() : 0;
        return projSortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (projSortField === 'contract_value' || projSortField === 'backlog' || projSortField === 'gm_percent') {
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
  }, [projects, projSortField, projSortDir, projStatusFilter, drillDown]);

  const handleWoSort = (field: WorkOrderSortField) => {
    if (woSortField === field) setWoSortDir(woSortDir === 'asc' ? 'desc' : 'asc');
    else { setWoSortField(field); setWoSortDir('desc'); }
  };

  const handleProjSort = (field: ProjectSortField) => {
    if (projSortField === field) setProjSortDir(projSortDir === 'asc' ? 'desc' : 'asc');
    else { setProjSortField(field); setProjSortDir('desc'); }
  };

  // Opens the crop modal; does NOT upload yet
  const handleLogoFile = useCallback((file: File | Blob, filename?: string) => {
    const name = filename || (file instanceof File ? file.name : 'logo.png');
    setPendingFilename(name);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleLogoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLogoFile(file);
    e.target.value = '';
  };

  const doUpload = async (blob: Blob, name: string) => {
    setLogoUploading(true);
    try {
      await uploadCustomerLogo(id!, blob, name);
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Logo updated');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed';
      toast.error(`Logo upload failed: ${msg}`);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadCropped = async () => {
    if (!cropImgRef.current || !completedCrop?.width) return;
    const img = cropImgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, completedCrop.x * scaleX, completedCrop.y * scaleY,
      completedCrop.width * scaleX, completedCrop.height * scaleY,
      0, 0, completedCrop.width, completedCrop.height);
    setCropSrc(null);
    canvas.toBlob(blob => { if (blob) doUpload(blob, pendingFilename); }, 'image/png');
  };

  const handleUploadFull = async () => {
    if (!cropSrc) return;
    setCropSrc(null);
    const res = await fetch(cropSrc);
    const blob = await res.blob();
    doUpload(blob, pendingFilename);
  };

  const handleRemoveLogo = async () => {
    try {
      await deleteCustomerLogo(id!);
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    }
  };

  // Global paste listener — must be before early returns to satisfy Rules of Hooks
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      if (item) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) handleLogoFile(blob, 'pasted-logo.png');
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [handleLogoFile]);

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
    const parsed = dateString.includes('T') ? dateString : dateString + 'T00:00:00';
    return new Date(parsed).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const displayName = customer.name || 'Unnamed Company';

  const resolveFileUrl = (url: string | undefined) => {
    if (!url) return undefined;
    if (url.startsWith('/')) {
      const base = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace('/api', '');
      return base + url;
    }
    return url;
  };

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
                {/* Logo / upload widget */}
                <span
                  className={`cd-logo-widget${logoUploading ? ' cd-logo-uploading' : ''}`}
                  onClick={() => logoInputRef.current?.click()}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && logoInputRef.current?.click()}
                  title="Click to upload logo, or paste (Ctrl+V) a screenshot"
                >
                  {customer.logo_url
                    ? <img src={resolveFileUrl(customer.logo_url)} alt="logo" className="cd-logo-img" />
                    : <Building2 size={32} strokeWidth={1.5} className="cd-logo-placeholder-icon" />}
                  <span className="cd-logo-overlay">{logoUploading ? '…' : '↑'}</span>
                  {customer.logo_url && (
                    <>
                      <button
                        className="cd-logo-action cd-logo-crop-btn"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const url = resolveFileUrl(customer.logo_url);
                          if (!url) return;
                          // Fetch via backend to avoid CORS on R2 presigned URLs
                          const res = await fetch(url);
                          const blob = await res.blob();
                          const reader = new FileReader();
                          reader.onload = () => { setCropSrc(reader.result as string); setPendingFilename('logo.png'); };
                          reader.readAsDataURL(blob);
                        }}
                        title="Crop logo"
                      >✂</button>
                      <button
                        className="cd-logo-action cd-logo-remove"
                        onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                        title="Remove logo"
                      >✕</button>
                    </>
                  )}
                </span>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoInputChange} />
                {displayName}
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
              {customer.market && <span className="cd-tag"><span className="cd-tag-icon"><Building2 size={11} strokeWidth={2} /></span>{customer.market}</span>}
              {customer.account_manager && <span className="cd-tag"><span className="cd-tag-icon"><User size={11} strokeWidth={2} /></span>{customer.account_manager}</span>}
              {customer.active_customer && <span className="cd-tag cd-tag-active"><span className="cd-tag-dot"></span>Active</span>}
            </div>
            <button className={`cd-info-toggle ${showInfoDrawer ? 'active' : ''}`} onClick={() => setShowInfoDrawer(!showInfoDrawer)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Info size={13} strokeWidth={2} /> Info
            </button>
            {customer.customer_type === 'prospect' && (
              <button className="sales-btn sales-btn-secondary" onClick={() => setShowMergeModal(true)}>
                Merge into Customer
              </button>
            )}
            <button className="sales-btn sales-btn-secondary" onClick={() => setShowAssessment(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Star size={14} strokeWidth={2} /> Score
            </button>
            <button className="sales-btn sales-btn-secondary" onClick={() => setShowEditModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Pencil size={14} strokeWidth={2} /> Edit
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
                <button onClick={() => setShowEditModal(true)} className="cd-edit-btn" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Pencil size={11} strokeWidth={2} /> Edit</button>
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
        <div className="cd-kpi-card teal" title={`WO: ${formatCurrency(metrics?.wo_contract_total)} | Proj: ${formatCurrency(metrics?.proj_contract_total)}`}>
          <div className="cd-kpi-value">{formatCurrency((parseFloat(metrics?.wo_contract_total || 0) + parseFloat(metrics?.proj_contract_total || 0)))}</div>
          <div className="cd-kpi-label">Total Contracts</div>
        </div>
        <div className="cd-kpi-card blue" title={`WO: ${formatCurrency(metrics?.wo_avg_annual_revenue)} | Proj: ${formatCurrency(metrics?.proj_avg_annual_revenue)}`}>
          <div className="cd-kpi-value">{formatCurrency(metrics?.avg_annual_revenue)}</div>
          <div className="cd-kpi-label">Avg Annual ({metrics?.year_span || 1} yr{(metrics?.year_span || 1) > 1 ? 's' : ''})</div>
        </div>
        <div className="cd-kpi-card amber" title={`Proj: ${(parseFloat(metrics?.proj_gm_percent || 0) * 100).toFixed(1)}% | Est: ${(parseFloat(metrics?.estimate_gm_percent || 0) * 100).toFixed(1)}%`}>
          <div className="cd-kpi-value">{(parseFloat(metrics?.avg_gm_percent || 0) * 100).toFixed(1)}%</div>
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

      {/* Charts Strip — always 5 charts */}
      <div className="cd-charts-strip">
        <div className="cd-chart-card">
          <div className="cd-chart-title">Revenue by Year</div>
          <div className="cd-chart-body">
            <Bar
              data={{
                labels: annualRevenue.map((r: any) => r.year),
                datasets: [
                  { label: 'WO', data: annualRevenue.map((r: any) => parseFloat(r.wo_revenue) || 0), backgroundColor: 'rgba(59, 130, 246, 0.75)', borderRadius: 2 },
                  { label: 'Proj', data: annualRevenue.map((r: any) => parseFloat(r.proj_revenue) || 0), backgroundColor: 'rgba(139, 92, 246, 0.75)', borderRadius: 2 },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                onClick: (_e, els, chart) => { if (els.length) { setDrillDown({ type: 'revenue', year: Number((chart.data.labels as any[])[els[0].index]) }); setProjStatusFilter([]); } },
                plugins: {
                  legend: { position: 'bottom', labels: { font: { size: 8 }, boxWidth: 7, padding: 3 } },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: $${((ctx.raw as number) / 1000000).toFixed(1)}M` } },
                },
                scales: {
                  x: { stacked: true, grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45 } },
                  y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 }, callback: (v) => `$${(Number(v) / 1000000).toFixed(0)}M` } },
                },
              }}
            />
          </div>
        </div>
        <div className="cd-chart-card">
          <div className="cd-chart-title">Avg GM% by Year</div>
          <div className="cd-chart-body">
            <Line
              data={{
                labels: annualRevenue.map((r: any) => r.year),
                datasets: [{
                  label: 'GM%',
                  data: annualRevenue.map((r: any) => Math.round((parseFloat(r.avg_gm_percent) || 0) * 100 * 10) / 10),
                  borderColor: 'rgba(217, 119, 6, 0.9)',
                  backgroundColor: 'rgba(217, 119, 6, 0.15)',
                  borderWidth: 2,
                  pointRadius: 3,
                  pointBackgroundColor: 'rgba(217, 119, 6, 0.9)',
                  fill: true,
                  tension: 0.3,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                onClick: (_e, els, chart) => { if (els.length) { setDrillDown({ type: 'gm', year: Number((chart.data.labels as any[])[els[0].index]) }); setProjStatusFilter([]); } },
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => ` GM%: ${(ctx.raw as number).toFixed(1)}%` } },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45 } },
                  y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 }, callback: (v) => `${v}%` } },
                },
              }}
            />
          </div>
        </div>
        <div className="cd-chart-card">
          <div className="cd-chart-title">Projects by Year</div>
          <div className="cd-chart-body">
            <Bar
              data={{
                labels: projectCountByYear.map(d => d.year),
                datasets: [{
                  label: 'Projects',
                  data: projectCountByYear.map(d => d.count),
                  backgroundColor: 'rgba(245, 158, 11, 0.75)',
                  borderRadius: 2,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                onClick: (_e, els, chart) => { if (els.length) { setDrillDown({ type: 'projects', year: Number((chart.data.labels as any[])[els[0].index]) }); setProjStatusFilter([]); } },
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} projects` } },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45 } },
                  y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 }, stepSize: 1 } },
                },
              }}
            />
          </div>
        </div>
        <div className="cd-chart-card">
          <div className="cd-chart-title">Hit Rate by Year</div>
          <div className="cd-chart-body">
            <Bar
              data={{
                labels: bidVolumeByYear.map(d => d.year),
                datasets: [{
                  label: 'Hit Rate',
                  data: bidVolumeByYear.map(d => {
                    const estsByYear = estimates.filter((e: any) => {
                      if (!e.date) return false;
                      return new Date(e.date.includes('T') ? e.date : e.date + 'T00:00:00').getFullYear() === d.year;
                    });
                    const won = estsByYear.filter((e: any) => ['won','awarded'].includes((e.status||'').toLowerCase())).length;
                    const decided = estsByYear.filter((e: any) => ['won','awarded','lost','no-bid','no bid'].includes((e.status||'').toLowerCase())).length;
                    return decided > 0 ? Math.round(won / decided * 100) : 0;
                  }),
                  backgroundColor: 'rgba(99, 102, 241, 0.75)',
                  borderRadius: 2,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                onClick: (_e, els, chart) => { if (els.length) setDrillDown({ type: 'hitrate', year: Number((chart.data.labels as any[])[els[0].index]) }); },
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw}%` } },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45 } },
                  y: { min: 0, max: 100, grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 }, callback: (v) => `${v}%` } },
                },
              }}
            />
          </div>
        </div>
        <div className="cd-chart-card">
          <div className="cd-chart-title">Bid Volume by Year</div>
          <div className="cd-chart-body">
            <Bar
              data={{
                labels: bidVolumeByYear.map(d => d.year),
                datasets: [{
                  label: 'Bids',
                  data: bidVolumeByYear.map(d => d.count),
                  backgroundColor: 'rgba(16, 185, 129, 0.75)',
                  borderRadius: 2,
                }],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                onClick: (_e, els, chart) => { if (els.length) setDrillDown({ type: 'bids', year: Number((chart.data.labels as any[])[els[0].index]) }); },
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} bids` } },
                },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 8 }, maxRotation: 45 } },
                  y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 8 }, stepSize: 1 } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Content Layout: Projects | Opportunities | Right Stack */}
      <div className="cd-content-layout">
        {/* Right Stack: Locations, Contacts, Work Orders, Estimates */}
        <div className="cd-right-stack">
          {/* Locations */}
          <div className="cd-stack-panel">
            <div className="cd-stack-panel-header">
              <span><MapPin size={12} strokeWidth={2} style={{ verticalAlign: 'middle' }} /> <strong>Locations</strong> <span className="cd-count">{locations.length}</span></span>
              <button className="sales-btn sales-btn-primary"
                onClick={() => { setAddingLocation(true); setTimeout(() => locInputRef.current?.focus(), 50); }}
                style={{ padding: '1px 6px', fontSize: '9px' }}>+ New</button>
            </div>
            <div className="cd-stack-panel-body">
              {addingLocation && (
                <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '4px' }}>
                  <input ref={locInputRef} type="text" value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newLocationName.trim()) addLocationMutation.mutate(newLocationName.trim());
                      if (e.key === 'Escape') { setAddingLocation(false); setNewLocationName(''); }
                    }}
                    placeholder="Location name..."
                    style={{ flex: 1, fontSize: '11px', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: '3px' }}
                  />
                  <button onClick={() => newLocationName.trim() && addLocationMutation.mutate(newLocationName.trim())}
                    disabled={!newLocationName.trim() || addLocationMutation.isPending}
                    style={{ fontSize: '9px', padding: '2px 6px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                    {addLocationMutation.isPending ? '…' : 'Add'}
                  </button>
                  <button onClick={() => { setAddingLocation(false); setNewLocationName(''); }}
                    style={{ fontSize: '9px', padding: '2px 4px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                </div>
              )}
              {locations.length === 0 && !addingLocation
                ? <div className="cd-stack-empty">No locations</div>
                : locations.map((loc: CustomerLocation) => (
                  editingLocationId === loc.id ? (
                    <div key={loc.id} style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <input ref={editLocRef} type="text" value={editLocName} onChange={(e) => setEditLocName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                        placeholder="Name *" style={{ fontSize: '11px', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: '3px' }} />
                      <input type="text" value={editLocAddress} onChange={(e) => setEditLocAddress(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                        placeholder="Address" style={{ fontSize: '11px', padding: '2px 5px', border: '1px solid var(--border)', borderRadius: '3px' }} />
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <input type="text" value={editLocCity} onChange={(e) => setEditLocCity(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          placeholder="City" style={{ flex: 2, fontSize: '11px', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: '3px' }} />
                        <input type="text" value={editLocState} onChange={(e) => setEditLocState(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          placeholder="ST" style={{ flex: 1, fontSize: '11px', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: '3px' }} />
                        <input type="text" value={editLocZip} onChange={(e) => setEditLocZip(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditLocation(); if (e.key === 'Escape') cancelEditLocation(); }}
                          placeholder="Zip" style={{ flex: 1, fontSize: '11px', padding: '2px 4px', border: '1px solid var(--border)', borderRadius: '3px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                        <button onClick={saveEditLocation} disabled={!editLocName.trim() || updateLocationMutation.isPending}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                          {updateLocationMutation.isPending ? '…' : 'Save'}
                        </button>
                        <button onClick={cancelEditLocation}
                          style={{ fontSize: '9px', padding: '2px 4px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : deleteLocConfirm === loc.id ? (
                    <div key={loc.id} className="cd-stack-item" style={{ background: '#fef2f2', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                      <div style={{ fontSize: '10px', color: '#991b1b', fontWeight: 600 }}>Delete "{loc.name}"?</div>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <button onClick={() => deleteLocationMutation.mutate(loc.id)} disabled={deleteLocationMutation.isPending}
                          style={{ fontSize: '9px', padding: '2px 6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                          {deleteLocationMutation.isPending ? '…' : 'Delete'}
                        </button>
                        <button onClick={() => setDeleteLocConfirm(null)}
                          style={{ fontSize: '9px', padding: '2px 4px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={loc.id} className="cd-stack-item" onClick={() => startEditLocation(loc)}>
                      <MapPin size={11} strokeWidth={2} style={{ flexShrink: 0, color: '#6b7280' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</div>
                        {(loc.city || loc.state) && (
                          <div style={{ fontSize: '10px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[loc.city, loc.state].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                      <button className="cd-icon-btn cd-loc-delete-btn"
                        onClick={(e) => { e.stopPropagation(); setDeleteLocConfirm(loc.id); }}
                        style={{ fontSize: '10px', width: '16px', height: '16px', color: '#ef4444', opacity: 0, flexShrink: 0 }}>✕</button>
                    </div>
                  )
                ))
              }
            </div>
          </div>

          {/* Contacts */}
          <div className="cd-stack-panel">
            <div className="cd-stack-panel-header">
              <span><Users size={12} strokeWidth={2} style={{ verticalAlign: 'middle' }} /> <strong>Contacts</strong> <span className="cd-count">{contacts.length}</span></span>
              <div style={{ display: 'flex', gap: '3px' }}>
                <button className="sales-btn" onClick={() => navigate(`/customers/${id}/org-chart`)}
                  style={{ padding: '1px 5px', fontSize: '9px', background: '#10b981', color: 'white' }}>Org</button>
                <button className="sales-btn sales-btn-primary" onClick={() => setShowContactModal(true)}
                  style={{ padding: '1px 5px', fontSize: '9px' }}>+ New</button>
              </div>
            </div>
            <div className="cd-stack-panel-body">
              {contacts.length === 0
                ? <div className="cd-stack-empty">No contacts</div>
                : contacts.map((contact: Contact) => (
                  <div key={contact.id} className="cd-stack-item" onClick={() => navigate(`/customers/${id}/contacts`)}>
                    <User size={11} strokeWidth={2} style={{ flexShrink: 0, color: '#6b7280' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {contact.first_name} {contact.last_name}
                        {contact.is_primary && <span style={{ fontSize: '8px', marginLeft: '4px', color: '#3b82f6', fontWeight: 600 }}>PRIMARY</span>}
                      </div>
                      {contact.title && <div style={{ fontSize: '10px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.title}</div>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

        </div>

        {/* Projects */}
        <div className="cd-projects-panel cd-module-card">
            <div className="cd-module-header">
              <span className="cd-module-title">
                <HardHat size={13} strokeWidth={2} /> Projects{' '}
                <span className="cd-count">{sortedProjects.length}/{projects.length}</span>
                {drillDown && ['gm', 'revenue', 'projects'].includes(drillDown.type) && (
                  <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 500, color: '#f59e0b', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {drillDown.year}
                    <button onClick={() => { setDrillDown(null); setProjStatusFilter(['Open', 'Soft-Closed']); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e', fontWeight: 700, fontSize: '10px', lineHeight: 1 }}>✕</button>
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', gap: '3px' }}>
                <button onClick={() => setProjStatusFilter([])} style={{
                  padding: '2px 6px', fontSize: '9px',
                  fontWeight: projStatusFilter.length === 0 ? 600 : 400,
                  background: projStatusFilter.length === 0 ? '#3b82f6' : 'transparent',
                  color: projStatusFilter.length === 0 ? '#fff' : '#6b7280',
                  border: `1px solid ${projStatusFilter.length === 0 ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>All</button>
                {(['Open', 'Soft-Closed', 'Hard-Closed'] as const).map(s => {
                  const active = projStatusFilter.includes(s);
                  return (
                    <button key={s} onClick={() => setProjStatusFilter(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    )} style={{
                      padding: '2px 6px', fontSize: '9px',
                      fontWeight: active ? 600 : 400,
                      background: active ? '#3b82f6' : 'transparent',
                      color: active ? '#fff' : '#6b7280',
                      border: `1px solid ${active ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>{s}</button>
                  );
                })}
              </div>
            </div>
            <div className="cd-stats-bar">
              <div className="cd-stats-cell cd-stats-cell--blue">
                <span className="cd-stats-label">Contract Value</span>
                <span className="cd-stats-value">{formatCurrency(projKpis.contractValue)}</span>
              </div>
              <div className="cd-stats-cell cd-stats-cell--amber">
                <span className="cd-stats-label">Avg GM%</span>
                <span className="cd-stats-value">{projKpis.weightedGm != null ? `${projKpis.weightedGm.toFixed(1)}%` : '—'}</span>
              </div>
              <div className="cd-stats-cell cd-stats-cell--purple">
                <span className="cd-stats-label">Backlog</span>
                <span className="cd-stats-value">{formatCurrency(projKpis.backlog)}</span>
              </div>
              <div className="cd-stats-cell cd-stats-cell--slate">
                <span className="cd-stats-label">GC Role</span>
                <span className="cd-stats-value">{projKpis.gcCount}</span>
              </div>
              <div className="cd-stats-cell cd-stats-cell--teal">
                <span className="cd-stats-label">Owner Role</span>
                <span className="cd-stats-value">{projKpis.ownerCount}</span>
              </div>
            </div>
            <div className="cd-module-body">
              {sortedProjects.length === 0 ? (
                <div className="cd-empty-state"><p>{projects.length === 0 ? 'No projects' : 'No matches'}</p></div>
              ) : (
                <table className="cd-table cd-projects-table">
                  <colgroup>
                    <col style={{ width: '7%' }} /><col style={{ width: '28%' }} /><col style={{ width: '15%' }} />
                    <col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
                    <col style={{ width: '8%' }} /><col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="cd-sortable" onClick={() => handleProjSort('number')}># <SortIcon active={projSortField === 'number'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('name')}>Project <SortIcon active={projSortField === 'name'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('manager_name')}>PM <SortIcon active={projSortField === 'manager_name'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('date')}>Date <SortIcon active={projSortField === 'date'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('contract_value')}>Value <SortIcon active={projSortField === 'contract_value'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('backlog')}>Backlog <SortIcon active={projSortField === 'backlog'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('gm_percent')}>GM% <SortIcon active={projSortField === 'gm_percent'} direction={projSortDir} /></th>
                      <th className="cd-sortable" onClick={() => handleProjSort('status')}>Status <SortIcon active={projSortField === 'status'} direction={projSortDir} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProjects.map((project: any) => {
                      const gm = Math.round((parseFloat(project.gm_percent) || 0) * 100 * 10) / 10;
                      const gmColor = gm >= 15 ? '#059669' : gm >= 10 ? '#d97706' : gm > 0 ? '#dc2626' : '#94a3b8';
                      return (
                        <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                          <td><strong>{project.number || '-'}</strong></td>
                          <td className="cd-truncate">{project.name}</td>
                          <td className="cd-truncate">{project.manager_name || '-'}</td>
                          <td>{formatDate(project.date)}</td>
                          <td>{formatCurrency(project.contract_value)}</td>
                          <td>{formatCurrency(project.backlog)}</td>
                          <td style={{ color: project.gm_overridden ? '#f59e0b' : gmColor, fontWeight: 600, fontStyle: project.gm_overridden ? 'italic' : undefined }} title={project.gm_overridden ? 'Overridden from 0% or 100% (no cost projection yet)' : undefined}>
                            {gm > 0 ? `${gm.toFixed(1)}%${project.gm_overridden ? '*' : ''}` : '-'}
                          </td>
                          <td><span className={`cd-status cd-status-${(project.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{project.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        {/* Opportunities + Work Orders + Estimates */}
        <div className="cd-opps-column">
          <div className="cd-opps-panel cd-module-card">
            <div className="cd-module-header">
              <span className="cd-module-title">
                <Briefcase size={13} strokeWidth={2} /> Opportunities{' '}
                <span className="cd-count">{filteredOpportunities.length}{oppStageFilter !== 'all' ? `/${opportunities.length}` : ''}</span>
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {oppStages.length > 0 && (
                  <select value={oppStageFilter} onChange={(e) => setOppStageFilter(e.target.value)}
                    style={{ fontSize: '9px', padding: '2px 4px', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer', color: '#374151', background: '#fff' }}>
                    <option value="all">All Stages</option>
                    {oppStages.map((stage: string) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                )}
                <button className="sales-btn sales-btn-primary" style={{ padding: '2px 8px', fontSize: '10px' }}
                  onClick={() => navigate('/sales/pipeline/new', { state: { customerId: parseInt(id!) } })}>+ New</button>
              </div>
            </div>
            <div className="cd-stats-bar">
              <div className="cd-stats-cell cd-stats-cell--emerald">
                <span className="cd-stats-label">Pipeline</span>
                <span className="cd-stats-value">{formatCurrency(oppKpis.pipeline)}</span>
              </div>
              <div className="cd-stats-cell cd-stats-cell--amber">
                <span className="cd-stats-label">Avg Deal</span>
                <span className="cd-stats-value">{oppKpis.count > 0 ? formatCurrency(oppKpis.avgDeal) : '—'}</span>
              </div>
            </div>
            <div className="cd-module-body">
              {filteredOpportunities.length === 0 ? (
                <div className="cd-empty-state"><p>{opportunities.length === 0 ? 'No opportunities' : 'No matches'}</p></div>
              ) : (
                <table className="cd-table">
                  <colgroup>
                    <col style={{ width: '12%' }} /><col style={{ width: '32%' }} /><col style={{ width: '16%' }} />
                    <col style={{ width: '20%' }} /><col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date</th><th>Opportunity</th><th>Assigned</th><th>Stage</th><th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpportunities.map((opp: any) => (
                      <tr key={opp.id} onClick={() => navigate('/sales', { state: { selectedOpportunityId: opp.id } })} style={{ cursor: 'pointer' }}>
                        <td>{formatDate(opp.created_at)}</td>
                        <td className="cd-truncate"><strong>{opp.title}</strong></td>
                        <td className="cd-truncate">{opp.assigned_to_name || '-'}</td>
                        <td>
                          {opp.stage_name && <span className="cd-stage-badge" style={{ background: opp.stage_color || '#6b7280' }}>{opp.stage_name}</span>}
                        </td>
                        <td>{formatCurrency(opp.estimated_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          {/* Work Orders */}
          <div className="cd-stack-panel">
            <div className="cd-stack-panel-header">
              <span><Wrench size={12} strokeWidth={2} style={{ verticalAlign: 'middle' }} /> <strong>Work Orders</strong> <span className="cd-count">{workOrders.length}</span></span>
            </div>
            <div className="cd-stack-panel-body">
              {workOrders.length === 0
                ? <div className="cd-stack-empty">No work orders</div>
                : sortedWorkOrders.slice(0, 20).map((wo: any) => (
                  <div key={wo.id} className="cd-stack-item" style={{ cursor: 'default' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong>#{wo.work_order_number}</strong>{wo.description ? ` — ${wo.description}` : ''}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {formatDate(wo.entered_date)} · {formatCurrency(wo.contract_amount)}
                      </div>
                    </div>
                    <span className={`cd-status cd-status-${(wo.status || '').toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '9px', flexShrink: 0 }}>{wo.status || '-'}</span>
                  </div>
                ))
              }
            </div>
          </div>
          {/* Estimates */}
          <div className="cd-stack-panel">
            <div className="cd-stack-panel-header">
              <span><BarChart2 size={12} strokeWidth={2} style={{ verticalAlign: 'middle' }} /> <strong>Estimates</strong> <span className="cd-count">{estimates.length}</span></span>
              <button className="sales-btn sales-btn-primary" style={{ padding: '1px 5px', fontSize: '9px' }}
                onClick={() => navigate('/estimating/estimates/new', { state: { customerId: parseInt(id!), customerName: displayName } })}>
                + New
              </button>
            </div>
            <div className="cd-stack-panel-body">
              {estimates.length === 0
                ? <div className="cd-stack-empty">No estimates</div>
                : estimates.map((estimate: any) => (
                  <div key={estimate.id} className="cd-stack-item" onClick={() => navigate(`/estimating/estimates/${estimate.id}`)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {estimate.name?.includes(' - ') ? estimate.name.split(' - ').slice(1).join(' - ') : estimate.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                        {formatDate(estimate.date)} · {formatCurrency(estimate.value)}
                      </div>
                    </div>
                    <span className={`cd-status cd-status-${(estimate.status || '').toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '9px', flexShrink: 0 }}>{estimate.status || '-'}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Logo crop modal */}
      {cropSrc && (
        <div className="cd-crop-backdrop" onClick={() => setCropSrc(null)}>
          <div className="cd-crop-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-crop-header">
              <strong>Crop Logo</strong>
              <button className="cd-crop-close" onClick={() => setCropSrc(null)}>✕</button>
            </div>
            <div className="cd-crop-body">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={undefined}
                style={{ maxHeight: '60vh' }}
              >
                <img
                  ref={cropImgRef}
                  src={cropSrc}
                  alt="crop preview"
                  style={{ maxHeight: '60vh', maxWidth: '100%' }}
                  onLoad={e => {
                    const { width, height } = e.currentTarget;
                    const c = centerCrop(makeAspectCrop({ unit: '%', width: 80 }, 1, width, height), width, height);
                    setCrop(c);
                  }}
                />
              </ReactCrop>
            </div>
            <div className="cd-crop-footer">
              <button className="sales-btn sales-btn-secondary" onClick={() => setCropSrc(null)}>Cancel</button>
              <button className="sales-btn sales-btn-secondary" onClick={handleUploadFull}>Use Full Image</button>
              <button className="sales-btn sales-btn-primary" onClick={handleUploadCropped} disabled={!completedCrop?.width}>Upload Cropped</button>
            </div>
          </div>
        </div>
      )}

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
