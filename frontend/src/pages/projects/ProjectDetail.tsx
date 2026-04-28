import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { customersApi, Customer } from '../../services/customers';
import { projectAssignmentsApi, FOREMAN_TRADES } from '../../services/projectAssignments';
import { vistaDataService, VPContract, ShopFieldHours } from '../../services/vistaData';
import { projectGoalsApi, ProjectGoals } from '../../services/projectGoals';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import SearchableSelect from '../../components/SearchableSelect';
import KpiCard, { getKpiStatus, KpiStatus } from '../../components/projects/KpiCard';
import SetGoalsDialog from '../../components/projects/SetGoalsDialog';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';
import { MARKETS as MARKET_OPTIONS } from '../../constants/markets';

const MODULE_ICONS: Record<string, string> = {
  financials: '💰',
  companies: '🏗️',
  specifications: '📋',
  drawings: '📐',
  rfis: '❓',
  submittals: '📦',
  'change-orders': '📝',
  'daily-reports': '📅',
  schedule: '📆',
  'phase-schedule': '📊',
  'weekly-goals': '🎯',
  issues: '⚠️',
};

const MODULES = [
  { path: 'financials', label: 'Financials', description: 'Contract financials and billing' },
  { path: 'companies', label: 'Companies', description: 'Stakeholders and contacts' },
  { path: 'specifications', label: 'Specifications', description: 'Project specifications with Q&A' },
  { path: 'drawings', label: 'Drawings', description: 'Construction drawings and plans' },
  { path: 'rfis', label: 'RFIs', description: 'Requests for Information' },
  { path: 'submittals', label: 'Submittals', description: 'Shop drawings and product data' },
  { path: 'change-orders', label: 'Change Orders', description: 'Contract modifications' },
  { path: 'daily-reports', label: 'Daily Reports', description: 'Field activity logs' },
  { path: 'issues', label: 'Field Issues', description: 'Issues reported from the field' },
  { path: 'schedule', label: 'Schedule', description: 'Project timeline and milestones' },
  { path: 'phase-schedule', label: 'Phase Schedule', description: 'Schedule phase codes with work contours' },
  { path: 'weekly-goals', label: 'Weekly Goal Plans', description: 'Track weekly goals and daily tasks by trade' },
];

// ── Formatting helpers ──────────────────────────────────────────────

const fmt = (val: number | null | undefined, decimals = 0): string => {
  if (val == null) return '-';
  return `$${Number(val).toLocaleString('en-US', { maximumFractionDigits: decimals })}`;
};

const pct = (val: number | null | undefined, multiplied = true): string => {
  if (val == null) return '-';
  const v = multiplied ? Number(val) * 100 : Number(val);
  return `${v.toFixed(1)}%`;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'Open': '#10b981', 'Soft-Closed': '#f59e0b', 'Hard-Closed': '#6b7280',
    'active': '#10b981', 'on_hold': '#f59e0b', 'completed': '#3b82f6', 'cancelled': '#ef4444',
  };
  return colors[status] || '#6b7280';
};

// ── Component ───────────────────────────────────────────────────────

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [showGoalsDialog, setShowGoalsDialog] = useState(false);
  const [isEditingTitan, setIsEditingTitan] = useState(false);
  const [foremanSearch, setForemanSearch] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('');

  // ── Data queries ───────────────────────────────────────────────────

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(Number(id)).then((res) => res.data),
  });

  const { data: vistaContract } = useQuery<VPContract | null>({
    queryKey: ['vpContract', id],
    queryFn: () => vistaDataService.getContractByProjectId(Number(id)),
    enabled: !!project,
  });

  const { data: goals } = useQuery<ProjectGoals | null>({
    queryKey: ['project-goals', id],
    queryFn: () => projectGoalsApi.getByProject(Number(id)),
    enabled: !!project,
  });

  const { data: shopFieldHours = [] } = useQuery<ShopFieldHours[]>({
    queryKey: ['shopFieldHours'],
    queryFn: () => vistaDataService.getShopFieldHours(),
    enabled: !!vistaContract,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.getAll(),
  });

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const { data: projectAssignments = [] } = useQuery({
    queryKey: ['project-assignments', id],
    queryFn: () => projectAssignmentsApi.getByProject(Number(id)),
    enabled: isAdminOrManager,
  });

  const { data: employeeSearchResults = [] } = useQuery({
    queryKey: ['employee-search', foremanSearch],
    queryFn: () => api.get(`/project-assignments/search-employees?q=${encodeURIComponent(foremanSearch)}`).then(res => res.data),
    enabled: isAdminOrManager && foremanSearch.length >= 2,
  });

  const assignedEmployeeIds = projectAssignments.map((a: any) => a.employee_id);
  const filteredResults = (employeeSearchResults as any[]).filter(
    (e: any) => !assignedEmployeeIds.includes(e.id)
  );

  // ── Mutations ──────────────────────────────────────────────────────

  const addForemanMutation = useMutation({
    mutationFn: ({ employeeId, trade }: { employeeId: number; trade?: string }) =>
      projectAssignmentsApi.addToProject(Number(id), employeeId, trade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', id] });
      setForemanSearch('');
      setSelectedTrade('');
    },
  });

  const removeForemanMutation = useMutation({
    mutationFn: (employeeId: number) =>
      projectAssignmentsApi.removeFromProject(Number(id), employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', id] });
    },
  });

  const updateTradeMutation = useMutation({
    mutationFn: ({ employeeId, trade }: { employeeId: number; trade: string }) =>
      projectAssignmentsApi.updateTrade(Number(id), employeeId, trade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', id] });
    },
  });

  // Titan-editable fields
  const [titanFormData, setTitanFormData] = useState({ customer_id: '', owner_customer_id: '', description: '' });

  React.useEffect(() => {
    if (project) {
      setTitanFormData({
        customer_id: project.customer_id?.toString() || '',
        owner_customer_id: project.owner_customer_id?.toString() || '',
        description: project.description || '',
      });
    }
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditingTitan(false);
    },
  });

  const handleTitanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      customerId: titanFormData.customer_id ? Number(titanFormData.customer_id) : undefined,
      ownerCustomerId: titanFormData.owner_customer_id ? Number(titanFormData.owner_customer_id) : undefined,
      description: titanFormData.description || undefined,
    });
  };

  const handleTitanChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTitanFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ── Derived KPI data ──────────────────────────────────────────────

  const projectShopField = useMemo(() => {
    if (!vistaContract || !shopFieldHours.length) return null;
    const rows = shopFieldHours.filter(h => h.contract_number === vistaContract.contract_number);
    const shopHours = rows.filter(r => r.location === 'shop').reduce((s, r) => s + (r.jtd_hours || 0), 0);
    const fieldHours = rows.filter(r => r.location === 'field').reduce((s, r) => s + (r.jtd_hours || 0), 0);
    const totalHours = shopHours + fieldHours;
    return { shopHours, fieldHours, totalHours, shopPct: totalHours > 0 ? shopHours / totalHours : 0 };
  }, [vistaContract, shopFieldHours]);

  const cashFlowPctOfCv = useMemo(() => {
    if (!vistaContract?.cash_flow || !vistaContract?.contract_amount) return null;
    return vistaContract.cash_flow / vistaContract.contract_amount;
  }, [vistaContract]);

  const percentComplete = useMemo(() => {
    if (!vistaContract?.earned_revenue || !vistaContract?.projected_revenue) return null;
    return vistaContract.projected_revenue > 0
      ? (vistaContract.earned_revenue / vistaContract.projected_revenue)
      : null;
  }, [vistaContract]);

  const billingPct = useMemo(() => {
    if (!vistaContract?.billed_amount || !vistaContract?.contract_amount) return null;
    return vistaContract.contract_amount > 0
      ? vistaContract.billed_amount / vistaContract.contract_amount
      : null;
  }, [vistaContract]);

  // ── KPI status computations ───────────────────────────────────────

  const cashFlowStatus: KpiStatus = useMemo(() => {
    if (vistaContract?.cash_flow == null) return 'neutral';
    if (goals?.cash_flow_goal_pct != null && cashFlowPctOfCv != null) {
      return getKpiStatus(cashFlowPctOfCv, goals.cash_flow_goal_pct, true);
    }
    return vistaContract.cash_flow >= 0 ? 'green' : 'red';
  }, [vistaContract, goals, cashFlowPctOfCv]);

  const marginStatus: KpiStatus = useMemo(() => {
    if (vistaContract?.gross_profit_percent == null) return 'neutral';
    if (goals?.margin_goal_pct != null) {
      return getKpiStatus(vistaContract.gross_profit_percent, goals.margin_goal_pct, true);
    }
    return vistaContract.gross_profit_percent >= 0 ? 'green' : 'red';
  }, [vistaContract, goals]);

  const laborRateStatus: KpiStatus = useMemo(() => {
    if (vistaContract?.actual_labor_rate == null) return 'neutral';
    if (goals?.labor_rate_goal != null) {
      return getKpiStatus(Number(vistaContract.actual_labor_rate), Number(goals.labor_rate_goal), false);
    }
    if (vistaContract.estimated_labor_rate) {
      return getKpiStatus(Number(vistaContract.actual_labor_rate), Number(vistaContract.estimated_labor_rate), false);
    }
    return 'neutral';
  }, [vistaContract, goals]);

  const shopFieldStatus: KpiStatus = useMemo(() => {
    if (!projectShopField || projectShopField.totalHours === 0) return 'neutral';
    if (goals?.shop_hours_goal_pct != null) {
      return getKpiStatus(projectShopField.shopPct, goals.shop_hours_goal_pct, true);
    }
    return 'neutral';
  }, [projectShopField, goals]);

  // ── Loading / not found ────────────────────────────────────────────

  if (isLoading) return <div className="loading">Loading...</div>;
  if (!project) return <div className="card">Project not found</div>;

  const marketIcon = MARKET_OPTIONS.find(m => m.value === project.market)?.icon || '';

  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.03em', marginBottom: '1px',
  };
  const valueStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.3 };
  const fieldStyle: React.CSSProperties = { marginBottom: '0.4rem' };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div>
      {/* ─── Header Banner ─── */}
      <div style={{ marginBottom: '0.75rem' }}>
        <Link to="/projects" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.8rem' }}>
          &larr; Back to Projects
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
          <h1 style={{
            margin: 0, fontSize: '1.35rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #1a56db, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            {project.name}
          </h1>
          <span style={{
            fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
            background: `${getStatusColor(project.status)}18`,
            color: getStatusColor(project.status), fontWeight: 600,
            border: `1px solid ${getStatusColor(project.status)}40`,
          }}>
            {project.status}
          </span>
          <button
            onClick={() => setShowGoalsDialog(true)}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid #d1d5db',
              padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem',
              color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>&#9881;</span> Set Goals
          </button>
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
          {project.number} &middot; {project.client || 'No client'} &middot; {project.manager_name || 'No PM'}
          {project.market ? ` · ${marketIcon} ${project.market}` : ''}
        </div>
      </div>

      {/* ─── KPI Row 1 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <KpiCard
          icon="💵"
          label="Cash Flow"
          value={vistaContract?.cash_flow != null ? fmt(vistaContract.cash_flow) : '-'}
          subValue={
            goals?.cash_flow_goal_pct != null && cashFlowPctOfCv != null
              ? `${(cashFlowPctOfCv * 100).toFixed(1)}% of CV (goal: ${(goals.cash_flow_goal_pct * 100).toFixed(1)}%)`
              : vistaContract?.cash_flow != null
                ? (vistaContract.cash_flow >= 0 ? 'Positive' : 'Negative')
                : undefined
          }
          status={cashFlowStatus}
        />
        <KpiCard
          icon="📊"
          label="Margin vs Goal"
          value={vistaContract?.gross_profit_percent != null ? pct(vistaContract.gross_profit_percent) : '-'}
          subValue={
            goals?.margin_goal_pct != null
              ? `Goal: ${(goals.margin_goal_pct * 100).toFixed(1)}% · ${vistaContract?.gross_profit_percent != null
                  ? `${((Number(vistaContract.gross_profit_percent) - Number(goals.margin_goal_pct)) * 100).toFixed(1)}% ${Number(vistaContract.gross_profit_percent) >= Number(goals.margin_goal_pct) ? 'above' : 'below'}`
                  : ''}`
              : vistaContract?.original_estimated_margin_pct != null
                ? `Est: ${(Number(vistaContract.original_estimated_margin_pct) * 100).toFixed(1)}%`
                : undefined
          }
          status={marginStatus}
        />
        <KpiCard
          icon="💲"
          label="Labor Rate"
          value={vistaContract?.actual_labor_rate != null ? `$${Number(vistaContract.actual_labor_rate).toFixed(2)}/hr` : '-'}
          subValue={
            goals?.labor_rate_goal != null
              ? `Goal: $${Number(goals.labor_rate_goal).toFixed(2)}/hr`
              : vistaContract?.estimated_labor_rate != null
                ? `Est: $${Number(vistaContract.estimated_labor_rate).toFixed(2)}/hr`
                : undefined
          }
          status={laborRateStatus}
        />
        <KpiCard
          icon="🏭"
          label="Shop vs Field"
          value={
            projectShopField && projectShopField.totalHours > 0
              ? `${(projectShopField.shopPct * 100).toFixed(0)}% / ${((1 - projectShopField.shopPct) * 100).toFixed(0)}%`
              : '-'
          }
          subValue={
            goals?.shop_hours_goal_pct != null
              ? `Goal: ${(goals.shop_hours_goal_pct * 100).toFixed(0)}% shop`
              : projectShopField && projectShopField.totalHours > 0
                ? `${projectShopField.shopHours.toLocaleString()} shop / ${projectShopField.fieldHours.toLocaleString()} field`
                : undefined
          }
          status={shopFieldStatus}
        />
      </div>

      {/* ─── KPI Row 2 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <KpiCard
          icon="✅"
          label="% Complete"
          value={percentComplete != null ? `${(percentComplete * 100).toFixed(1)}%` : '-'}
          progressBar={percentComplete != null ? percentComplete * 100 : undefined}
          subValue={
            vistaContract?.earned_revenue != null
              ? `${fmt(vistaContract.earned_revenue)} earned of ${fmt(vistaContract.projected_revenue)}`
              : undefined
          }
          status="neutral"
        />
        <KpiCard
          icon="💰"
          label="Billing"
          value={vistaContract?.billed_amount != null ? fmt(vistaContract.billed_amount) : '-'}
          subValue={
            billingPct != null
              ? `${(billingPct * 100).toFixed(1)}% of ${fmt(vistaContract?.contract_amount)}`
              : undefined
          }
          status="neutral"
        />
        <KpiCard
          icon="📋"
          label="Open AR"
          value={vistaContract?.open_receivables != null ? fmt(vistaContract.open_receivables) : '-'}
          subValue={
            vistaContract?.received_amount != null
              ? `${fmt(vistaContract.received_amount)} received`
              : undefined
          }
          status="neutral"
        />
        <KpiCard
          icon="📦"
          label="Backlog"
          value={vistaContract?.backlog != null ? fmt(vistaContract.backlog) : (project.backlog ? fmt(project.backlog) : '-')}
          subValue={
            vistaContract?.backlog != null && vistaContract?.contract_amount
              ? `${((Number(vistaContract.backlog) / Number(vistaContract.contract_amount)) * 100).toFixed(0)}% remaining`
              : undefined
          }
          status="neutral"
        />
      </div>

      {/* ─── Main 3-column layout ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '0.75rem' }}>

        {/* COLUMN 1: Vista Project Data */}
        <div className="card" style={{ padding: '0.85rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginBottom: '0.6rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0',
          }}>
            <span style={{ fontSize: '1rem' }}>📊</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Vista Project Data</span>
            <span style={{
              fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f1f5f9',
              borderRadius: '3px', color: '#64748b', marginLeft: 'auto',
            }}>Read-only</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.1rem 0.75rem' }}>
            <div style={fieldStyle}>
              <div style={labelStyle}>Project Number</div>
              <div style={valueStyle}>{project.number}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Status</div>
              <div style={{ ...valueStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: getStatusColor(project.status), display: 'inline-block' }} />
                {project.status}
              </div>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Project Name</div>
              <div style={valueStyle}>{project.name}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Client (Vista)</div>
              <div style={valueStyle}>{project.client || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Project Manager</div>
              <div style={valueStyle}>{project.manager_name || '-'}</div>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Address</div>
              <div style={{ fontSize: '0.8rem' }}>{project.address || '-'}</div>
            </div>
            <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Ship Address</div>
              <div style={{ fontSize: '0.8rem' }}>{project.ship_address || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Ship City</div>
              <div style={{ fontSize: '0.8rem' }}>{project.ship_city || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Ship State / Zip</div>
              <div style={{ fontSize: '0.8rem' }}>{project.ship_state || '-'} {project.ship_zip || ''}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Market</div>
              <div style={{ fontSize: '0.8rem' }}>{project.market ? <>{marketIcon} {project.market}</> : '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Department</div>
              <div style={{ fontSize: '0.8rem' }}>{project.department_number || '-'}</div>
            </div>
            <div style={fieldStyle}>
              <div style={labelStyle}>Start Date</div>
              <div style={{ fontSize: '0.8rem' }}>
                {project.start_date && !isNaN(new Date(project.start_date + 'T00:00:00').getTime()) ? format(new Date(project.start_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}
              </div>
            </div>
          </div>

          {/* Financial summary row */}
          {(project.contract_value || project.gross_margin_percent !== undefined || project.backlog ||
            project.projected_revenue || project.projected_cost || project.actual_cost) && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <div style={{ textAlign: 'center', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Contract</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.contract_value ? fmt(project.contract_value) : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>GM%</div>
                  <div style={{
                    fontSize: '0.95rem', fontWeight: 600,
                    color: project.gross_margin_percent && project.gross_margin_percent !== 0 ? '#ffffff' : '#3b82f6',
                    backgroundColor: project.gross_margin_percent && project.gross_margin_percent > 0 ? '#10b981'
                      : project.gross_margin_percent && project.gross_margin_percent < 0 ? '#ef4444' : 'transparent',
                    padding: project.gross_margin_percent && project.gross_margin_percent !== 0 ? '0.15rem 0.5rem' : '0',
                    borderRadius: '4px', display: 'inline-block',
                  }}>
                    {project.gross_margin_percent !== undefined && project.gross_margin_percent !== null
                      ? `${(Number(project.gross_margin_percent) * 100).toFixed(1)}%` : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Backlog</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.backlog ? fmt(project.backlog) : '-'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                <div style={{ textAlign: 'center', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Projected Revenue</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.projected_revenue ? fmt(project.projected_revenue) : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>Projected Cost</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.projected_cost ? fmt(project.projected_cost) : '-'}
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>JTD Cost</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>
                    {project.actual_cost ? fmt(project.actual_cost) : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 2: Titan Project Details */}
        <div className="card" style={{ padding: '0.85rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginBottom: '0.6rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0',
          }}>
            <span style={{ fontSize: '1rem' }}>🔧</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Titan Project Details</span>
            {!isEditingTitan && (
              <button
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setIsEditingTitan(true)}
              >
                Edit
              </button>
            )}
          </div>

          {isEditingTitan ? (
            <form onSubmit={handleTitanSubmit}>
              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Customer (GC)</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.name }))}
                  value={titanFormData.customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, customer_id: value }))}
                  placeholder="-- Select Customer --"
                />
                <small style={{ color: '#64748b', fontSize: '0.65rem' }}>The General Contractor you have the contract with</small>
              </div>
              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Owner</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.name }))}
                  value={titanFormData.owner_customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, owner_customer_id: value }))}
                  placeholder="-- Select Owner --"
                />
                <small style={{ color: '#64748b', fontSize: '0.65rem' }}>The building owner / end customer</small>
              </div>
              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Notes</label>
                <textarea
                  name="description"
                  className="form-input"
                  rows={3}
                  value={titanFormData.description}
                  onChange={handleTitanChange}
                  placeholder="Add project notes..."
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    setIsEditingTitan(false);
                    if (project) {
                      setTitanFormData({
                        customer_id: project.customer_id?.toString() || '',
                        owner_customer_id: project.owner_customer_id?.toString() || '',
                        description: project.description || '',
                      });
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
              {updateMutation.isError && (
                <div className="error-message" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  Error updating project. Please try again.
                </div>
              )}
            </form>
          ) : (
            <div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Customer (GC)</div>
                <div style={{ fontSize: '0.85rem' }}>
                  {project.customer_name ? (
                    <Link to={`/customers/${project.customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.customer_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>The General Contractor you have the contract with</div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Owner</div>
                <div style={{ fontSize: '0.85rem' }}>
                  {project.owner_name ? (
                    <Link to={`/customers/${project.owner_customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.owner_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>The building owner / end customer</div>
              </div>
              {project.description && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={labelStyle}>Notes</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#475569' }}>{project.description}</div>
                </div>
              )}
              {!project.customer_name && !project.owner_name && !project.description && (
                <div style={{
                  textAlign: 'center', padding: '1.25rem 0.75rem', color: '#94a3b8',
                  background: '#f8fafc', borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔗</div>
                  <div style={{ fontSize: '0.8rem' }}>No Titan data linked yet</div>
                  <div style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>Click Edit to link Customer and Owner</div>
                </div>
              )}
            </div>
          )}

          {/* Field Foremen Assignment */}
          {isAdminOrManager && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>👷</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Field Foremen</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.15rem' }}>
                  ({projectAssignments.length})
                </span>
              </div>

              <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <input
                    type="text"
                    placeholder="Search employees to add..."
                    value={foremanSearch}
                    onChange={(e) => setForemanSearch(e.target.value)}
                    style={{
                      flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.8rem',
                      border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--bg-dark)',
                    }}
                  />
                  <select
                    value={selectedTrade}
                    onChange={(e) => setSelectedTrade(e.target.value)}
                    style={{
                      padding: '0.35rem 0.4rem', fontSize: '0.75rem',
                      border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--bg-dark)',
                      color: selectedTrade ? 'inherit' : '#94a3b8',
                    }}
                  >
                    <option value="">Trade</option>
                    {FOREMAN_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {foremanSearch.length >= 2 && filteredResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'white', border: '1px solid var(--border)', borderRadius: '5px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto',
                  }}>
                    {filteredResults.slice(0, 10).map((emp: any) => (
                      <div
                        key={emp.id}
                        onClick={() => addForemanMutation.mutate({ employeeId: emp.id, trade: selectedTrade || undefined })}
                        style={{
                          padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem',
                          borderBottom: '1px solid #f1f5f9', display: 'flex',
                          justifyContent: 'space-between', alignItems: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                      >
                        <span style={{ fontWeight: 500 }}>{emp.first_name} {emp.last_name}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{emp.job_title || emp.email}</span>
                      </div>
                    ))}
                  </div>
                )}
                {foremanSearch.length >= 2 && filteredResults.length === 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'white', border: '1px solid var(--border)', borderRadius: '5px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10,
                    padding: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center',
                  }}>
                    No matching employees found
                  </div>
                )}
              </div>

              {projectAssignments.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No foremen assigned yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {projectAssignments.map((a: any) => (
                    <div key={a.employee_id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.25rem 0.4rem', background: '#f8fafc', borderRadius: '5px', fontSize: '0.8rem',
                    }}>
                      <span style={{ fontWeight: 500, flex: 1 }}>{a.first_name} {a.last_name}</span>
                      <select
                        value={a.trade || ''}
                        onChange={(e) => updateTradeMutation.mutate({ employeeId: a.employee_id, trade: e.target.value })}
                        style={{
                          padding: '0.15rem 0.3rem', fontSize: '0.7rem',
                          border: '1px solid var(--border)', borderRadius: '4px', background: 'white',
                          color: a.trade ? 'inherit' : '#94a3b8',
                        }}
                      >
                        <option value="">Trade</option>
                        {FOREMAN_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button
                        onClick={() => removeForemanMutation.mutate(a.employee_id)}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem', lineHeight: 1,
                        }}
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMN 3: Modules sidebar */}
        <div className="card" style={{ padding: '0.85rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            marginBottom: '0.6rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0',
          }}>
            <span style={{ fontSize: '1rem' }}>📂</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Modules</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {MODULES.map((module) => (
              <Link
                key={module.path}
                to={`/projects/${id}/${module.path}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 0.5rem', borderRadius: '6px',
                  textDecoration: 'none', color: 'inherit', transition: 'background 0.15s', fontSize: '0.85rem',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '1rem', width: '1.25rem', textAlign: 'center' }}>
                  {MODULE_ICONS[module.path] || '📄'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--primary)', lineHeight: 1.2 }}>{module.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.2 }}>{module.description}</div>
                </div>
                <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>&rsaquo;</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Set Goals Dialog ─── */}
      {showGoalsDialog && (
        <SetGoalsDialog
          projectId={Number(id)}
          currentGoals={goals ?? null}
          onClose={() => setShowGoalsDialog(false)}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
