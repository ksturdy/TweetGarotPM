import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { customersApi, Customer } from '../../services/customers';
import { projectAssignmentsApi } from '../../services/projectAssignments';
import AssignDialog from '../../components/labor/AssignDialog';
import NotifyDialog from '../../components/labor/NotifyDialog';
import { AssignmentRecord } from '../../services/labor';
import { vistaDataService, VPContract, ShopFieldHours } from '../../services/vistaData';
import { projectGoalsApi, ProjectGoals } from '../../services/projectGoals';
import { useAuth } from '../../context/AuthContext';
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
  'gc-schedule': '📋',
  'phase-schedule': '📊',
  stratus: '☁️',
  'weekly-goals': '🎯',
  issues: '⚠️',
  'cost-model': '🔧',
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
  { path: 'gc-schedule', label: 'GC Schedule', description: 'Upload, view, and compare GC project schedules' },
  { path: 'phase-schedule', label: 'Phase Schedule', description: 'Schedule phase codes with work contours' },
  { path: 'stratus', label: 'Stratus', description: 'Model content and part-level statuses' },
  { path: 'weekly-goals', label: 'Weekly Goal Plans', description: 'Track weekly goals and daily tasks by trade' },
  { path: 'cost-model', label: 'Cost Model', description: 'Equipment counts and cost data' },
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
  const [crewAssignOpen, setCrewAssignOpen] = useState(false);
  const [editingCrewAssignment, setEditingCrewAssignment] = useState<AssignmentRecord | null>(null);
  const [notifyCrewAssignment, setNotifyCrewAssignment] = useState<AssignmentRecord | null>(null);

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

  const removeCrewMutation = useMutation({
    mutationFn: (assignmentId: number) =>
      projectAssignmentsApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', id] });
      queryClient.invalidateQueries({ queryKey: ['labor-board'] });
    },
  });

  // Titan-editable fields
  const [titanFormData, setTitanFormData] = useState({ customer_id: '', owner_customer_id: '', architect_customer_id: '', description: '' });

  React.useEffect(() => {
    if (project) {
      setTitanFormData({
        customer_id: project.customer_id?.toString() || '',
        owner_customer_id: project.owner_customer_id?.toString() || '',
        architect_customer_id: project.architect_customer_id?.toString() || '',
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
      architectCustomerId: titanFormData.architect_customer_id ? Number(titanFormData.architect_customer_id) : undefined,
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
    const sumHours = (rs: typeof rows) => rs.reduce((s, r) => s + Number(r.jtd_hours || 0), 0);
    const shopHours = sumHours(rows.filter(r => r.location === 'shop'));
    const fieldHours = sumHours(rows.filter(r => r.location === 'field'));
    const totalHours = shopHours + fieldHours;
    const TRADE_LABELS: Record<'pf' | 'sm' | 'pl', string> = { pf: 'PF', sm: 'SM', pl: 'PL' };
    const byTrade = (['pf', 'sm', 'pl'] as const).map(trade => {
      const tradeRows = rows.filter(r => r.trade === trade);
      const shop = sumHours(tradeRows.filter(r => r.location === 'shop'));
      const field = sumHours(tradeRows.filter(r => r.location === 'field'));
      const total = shop + field;
      return { trade, label: TRADE_LABELS[trade], shop, field, total, shopPct: total > 0 ? shop / total : 0 };
    }).filter(t => t.total > 0);
    return { shopHours, fieldHours, totalHours, shopPct: totalHours > 0 ? shopHours / totalHours : 0, byTrade };
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
          table={
            projectShopField && projectShopField.byTrade.length > 0
              ? {
                  headers: ['Trade', 'Shop', 'Field', '% Shop'],
                  rows: projectShopField.byTrade.map(t => [
                    t.label,
                    Math.round(t.shop).toLocaleString(),
                    Math.round(t.field).toLocaleString(),
                    `${(t.shopPct * 100).toFixed(0)}%`,
                  ]),
                  footer: [
                    'Total',
                    Math.round(projectShopField.shopHours).toLocaleString(),
                    Math.round(projectShopField.fieldHours).toLocaleString(),
                    `${(projectShopField.shopPct * 100).toFixed(0)}%`,
                  ],
                }
              : undefined
          }
          subValue={
            goals?.shop_hours_goal_pct != null
              ? `Goal: ${(goals.shop_hours_goal_pct * 100).toFixed(0)}% shop`
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
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Architect</label>
                <SearchableSelect
                  options={customers.map((c: Customer) => ({ value: c.id, label: c.name }))}
                  value={titanFormData.architect_customer_id}
                  onChange={(value) => setTitanFormData(prev => ({ ...prev, architect_customer_id: value }))}
                  placeholder="-- Select Architect --"
                />
                <small style={{ color: '#64748b', fontSize: '0.65rem' }}>The architect of record</small>
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
                        architect_customer_id: project.architect_customer_id?.toString() || '',
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
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={labelStyle}>Architect</div>
                <div style={{ fontSize: '0.85rem' }}>
                  {project.architect_name ? (
                    <Link to={`/customers/${project.architect_customer_id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
                      {project.architect_name}
                    </Link>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.8rem' }}>Not linked</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>The architect of record</div>
              </div>
              {project.description && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={labelStyle}>Notes</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', color: '#475569' }}>{project.description}</div>
                </div>
              )}
              {!project.customer_name && !project.owner_name && !project.architect_name && !project.description && (
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

          {/* Project Crew */}
          {isAdminOrManager && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem' }}>👷</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Project Crew</span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.15rem' }}>
                  ({projectAssignments.length})
                </span>
                <button
                  onClick={() => { setEditingCrewAssignment(null); setCrewAssignOpen(true); }}
                  style={{
                    marginLeft: 'auto', background: '#16a34a', color: 'white', border: 'none',
                    padding: '0.25rem 0.65rem', borderRadius: 5, fontSize: '0.75rem',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  + Add Crew
                </button>
              </div>

              {projectAssignments.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No crew assigned yet. Click + Add Crew to start.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {projectAssignments.map((a: any) => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.35rem 0.5rem', background: '#f8fafc', borderRadius: 5, fontSize: '0.8rem',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          to={`/labor/employee/${a.employee_id}`}
                          style={{ fontWeight: 500, color: '#1e293b', textDecoration: 'none' }}
                        >
                          {a.first_name} {a.last_name}
                        </Link>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {a.role || 'Crew'}{a.trade ? ` · ${a.trade}` : ''}
                          {a.start_date ? ` · ${new Date(a.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                          {a.end_date ? ` – ${new Date(a.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => setNotifyCrewAssignment(a as AssignmentRecord)}
                        title="Send notification"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem' }}
                      >📤</button>
                      <button
                        onClick={() => { setEditingCrewAssignment(a as AssignmentRecord); setCrewAssignOpen(true); }}
                        title="Edit"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.2rem' }}
                      >✏️</button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${a.first_name} ${a.last_name} from this project?`)) {
                            removeCrewMutation.mutate(a.id);
                          }
                        }}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444',
                          cursor: 'pointer', fontSize: '0.95rem', padding: '0 0.2rem', lineHeight: 1,
                        }}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <AssignDialog
                open={crewAssignOpen}
                onClose={() => { setCrewAssignOpen(false); setEditingCrewAssignment(null); }}
                lockedProjectId={editingCrewAssignment ? undefined : Number(id)}
                lockedProjectName={project?.name}
                editing={editingCrewAssignment}
                invalidateKeys={[['project-assignments', id || ''], ['labor-board'], ['labor-summary']]}
              />

              {notifyCrewAssignment && (
                <NotifyDialog
                  open={!!notifyCrewAssignment}
                  onClose={() => setNotifyCrewAssignment(null)}
                  assignment={notifyCrewAssignment}
                />
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
