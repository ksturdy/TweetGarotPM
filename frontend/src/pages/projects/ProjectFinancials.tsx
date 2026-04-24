import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vistaDataService, VPContract, PhaseCodeCostSummary, LaborTradeSummary } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';
import { projectSnapshotsApi } from '../../services/projectSnapshots';
import { format } from 'date-fns';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const fmt = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const fmtPct = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${(num * 100).toFixed(1)}%`;
};

const fmtPctRaw = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${(num * 100).toFixed(2)}%`;
};

const fmtNum = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const fmtRate = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `$${num.toFixed(2)}`;
};

const calcPctComplete = (earned: number | string | null | undefined, projected: number | string | null | undefined): string => {
  if (earned === null || earned === undefined || projected === null || projected === undefined) return '-';
  const earnedNum = typeof earned === 'string' ? parseFloat(earned) : earned;
  const projectedNum = typeof projected === 'string' ? parseFloat(projected) : projected;
  if (isNaN(earnedNum) || isNaN(projectedNum) || projectedNum === 0) return '-';
  return `${((earnedNum / projectedNum) * 100).toFixed(2)}%`;
};

const getProjectedColor = (projected: number | string | null | undefined, estimate: number | string | null | undefined): string | undefined => {
  if (projected === null || projected === undefined || estimate === null || estimate === undefined) return undefined;
  const projNum = typeof projected === 'string' ? parseFloat(projected) : projected;
  const estNum = typeof estimate === 'string' ? parseFloat(estimate) : estimate;
  if (isNaN(projNum) || isNaN(estNum) || estNum === 0) return undefined;
  const ratio = projNum / estNum;
  if (ratio < 0.95) return '#10b981';
  if (ratio <= 1.05) return '#f59e0b';
  return '#ef4444';
};

const getCashFlowColor = (cashFlow: number | string | null | undefined): string | undefined => {
  if (cashFlow === null || cashFlow === undefined) return undefined;
  const num = typeof cashFlow === 'string' ? parseFloat(cashFlow) : cashFlow;
  if (isNaN(num) || num === 0) return undefined;
  return num > 0 ? '#10b981' : '#ef4444';
};

const getVarianceColor = (variance: number): string | undefined => {
  if (variance === 0) return undefined;
  return variance > 0 ? '#10b981' : '#ef4444';
};

const getGrossProfitColor = (actual: number | string | null | undefined, estimate: number | string | null | undefined): string | undefined => {
  if (actual === null || actual === undefined || estimate === null || estimate === undefined) return undefined;
  const actualNum = typeof actual === 'string' ? parseFloat(actual) : actual;
  const estNum = typeof estimate === 'string' ? parseFloat(estimate) : estimate;
  if (isNaN(actualNum) || isNaN(estNum) || estNum === 0) return undefined;
  if (actualNum < 0) return '#ef4444';
  const ratio = actualNum / estNum;
  if (ratio >= 0.95) return '#10b981';
  if (ratio >= 0.75) return '#f59e0b';
  return '#ef4444';
};

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

// Shared table cell styles
const thStyle: React.CSSProperties = {
  textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
  color: '#475569', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0',
};
const tdStyle: React.CSSProperties = {
  textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.8rem',
  borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
};
const tfStyle: React.CSSProperties = {
  textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.8rem', fontWeight: 700,
  borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap',
};

// Summary box row component
const SRow: React.FC<{ label: string; value: string; highlight?: boolean; valueColor?: string; italic?: boolean }> = ({ label, value, highlight, valueColor, italic }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ color: italic ? '#94a3b8' : '#64748b', fontSize: '0.78rem', fontStyle: italic ? 'italic' : 'normal' }}>{label}</span>
    <span style={{
      fontWeight: highlight ? 700 : 400, fontSize: '0.8rem',
      color: valueColor || (highlight ? '#1e293b' : '#334155'),
      fontVariantNumeric: 'tabular-nums',
    }}>{value}</span>
  </div>
);

const ProjectFinancials: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [showSnapshotSuccess, setShowSnapshotSuccess] = useState(false);
  const [showOverrideInputs, setShowOverrideInputs] = useState(false);
  const [marginOverride, setMarginOverride] = useState('');
  const [marginPctOverride, setMarginPctOverride] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const drillIn = (costType: number, trade?: string) => {
    const params = new URLSearchParams();
    params.set('cost_type', String(costType));
    if (trade) params.set('trade', trade);
    if (selectedJob) params.set('job', selectedJob);
    navigate(`/projects/${projectId}/financials/cost-detail?${params.toString()}`);
  };

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  const { data: c, isLoading } = useQuery({
    queryKey: ['vpContract', projectId],
    queryFn: () => vistaDataService.getContractByProjectId(Number(projectId)),
  });

  const { data: jobs } = useQuery({
    queryKey: ['projectJobs', projectId],
    queryFn: () => vistaDataService.getProjectJobs(Number(projectId)),
    enabled: !!c,
  });

  const { data: costSummary } = useQuery({
    queryKey: ['phaseCodeCostSummary', projectId, selectedJob],
    queryFn: () => vistaDataService.getPhaseCodeCostSummary(Number(projectId), selectedJob || undefined),
    enabled: !!c,
  });

  const getTradeSummary = (trade: string) => {
    if (!costSummary?.labor) return { est_hours: 0, jtd_hours: 0, est_cost: 0, jtd_cost: 0, committed_cost: 0, projected_cost: 0, prior_week_cost: 0 };
    const rows = costSummary.labor.filter((l: LaborTradeSummary) => l.trade === trade);
    return {
      est_hours: rows.reduce((s: number, r: LaborTradeSummary) => s + r.est_hours, 0),
      jtd_hours: rows.reduce((s: number, r: LaborTradeSummary) => s + r.jtd_hours, 0),
      est_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + r.est_cost, 0),
      jtd_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + r.jtd_cost, 0),
      committed_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + (r.committed_cost || 0), 0),
      projected_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + r.projected_cost, 0),
      prior_week_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + (r.prior_week_cost || 0), 0),
    };
  };

  const calcProjectedHours = (summary: { jtd_cost: number; jtd_hours: number; est_cost: number; est_hours: number; projected_cost: number }) => {
    if (!summary.projected_cost) return 0;
    const rate = summary.jtd_hours > 0
      ? summary.jtd_cost / summary.jtd_hours
      : summary.est_hours > 0
        ? summary.est_cost / summary.est_hours
        : 0;
    return rate > 0 ? summary.projected_cost / rate : 0;
  };

  const captureSnapshotMutation = useMutation({
    mutationFn: () => projectSnapshotsApi.create(Number(projectId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectSnapshots', projectId] });
      setShowSnapshotSuccess(true);
      setTimeout(() => setShowSnapshotSuccess(false), 3000);
    },
    onError: (error: any) => {
      console.error('Error capturing snapshot:', error);
      toast.error(error.response?.data?.error || 'Failed to capture snapshot. Please try again.');
    },
  });

  const fmtDollarInput = (n: number) => Math.round(n).toLocaleString('en-US');
  const parseDollarInput = (str: string) => parseFloat(str.replace(/,/g, ''));

  useEffect(() => {
    if (project) {
      setMarginOverride(project.override_original_estimated_margin != null
        ? fmtDollarInput(Number(project.override_original_estimated_margin)) : '');
      setMarginPctOverride(project.override_original_estimated_margin_pct != null
        ? String(Number((Number(project.override_original_estimated_margin_pct) * 100).toFixed(2))) : '');
    }
  }, [project]);

  const projectedRevenue = c ? parseFloat(String(c.projected_revenue)) || 0 : 0;

  const handleMarginDollarChange = (value: string) => {
    const cleaned = value.replace(/[^0-9,\-]/g, '');
    setMarginOverride(cleaned);
    const n = parseDollarInput(cleaned);
    if (!isNaN(n) && projectedRevenue > 0) {
      const pct = (n / projectedRevenue) * 100;
      setMarginPctOverride(isNaN(pct) ? '' : String(Number(pct.toFixed(2))));
    } else if (!cleaned) {
      setMarginPctOverride('');
    }
  };

  const handleMarginDollarBlur = () => {
    const n = parseDollarInput(marginOverride);
    if (!isNaN(n) && marginOverride) setMarginOverride(fmtDollarInput(n));
  };

  const handleMarginPctChange = (value: string) => {
    setMarginPctOverride(value);
    if (value && projectedRevenue > 0) {
      const dollars = projectedRevenue * (parseFloat(value) / 100);
      setMarginOverride(isNaN(dollars) ? '' : fmtDollarInput(dollars));
    } else if (!value) {
      setMarginOverride('');
    }
  };

  const saveOverridesMutation = useMutation({
    mutationFn: (data: { override_original_estimated_margin: number | null; override_original_estimated_margin_pct: number | null }) =>
      projectsApi.update(Number(projectId), data as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['project', projectId] }); },
    onError: (error: any) => {
      console.error('Error saving margin overrides:', error);
      toast.error('Failed to save overrides.');
    },
  });

  const backfillMutation = useMutation({
    mutationFn: () => projectSnapshotsApi.backfillMargin(Number(projectId)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projectSnapshots', projectId] });
      toast.success(`Updated ${res.data.snapshotsUpdated} historical snapshot(s) with margin overrides.`);
    },
    onError: (error: any) => {
      console.error('Error backfilling snapshots:', error);
      toast.error(error.response?.data?.error || 'Failed to update past snapshots.');
    },
  });

  const handleSaveOverrides = () => {
    const dollarVal = marginOverride ? parseDollarInput(marginOverride) : NaN;
    saveOverridesMutation.mutate({
      override_original_estimated_margin: !isNaN(dollarVal) ? dollarVal : null,
      override_original_estimated_margin_pct: marginPctOverride ? parseFloat(marginPctOverride) / 100 : null,
    });
  };

  const handleClearOverrides = () => {
    setMarginOverride('');
    setMarginPctOverride('');
    saveOverridesMutation.mutate({
      override_original_estimated_margin: null,
      override_original_estimated_margin_pct: null,
    });
  };

  if (isLoading) return <div className="loading">Loading...</div>;

  // Computed values for summary boxes
  const billedAmt = num(c?.billed_amount);
  const contractAmt = num(c?.contract_amount);
  const earnedRev = num(c?.earned_revenue);
  const pctBilled = contractAmt > 0 ? billedAmt / contractAmt : 0;
  const overUnderBilled = billedAmt - earnedRev;

  // Build cost type rows for the main table
  const buildCostRows = () => {
    if (!costSummary) return null;
    const lt = costSummary.labor_totals;
    const cs = costSummary.costs;
    return [
      { label: 'Labor', num: 1, costType: 1, est_hours: lt.est_hours, est_cost: lt.est_cost, prev_wk: lt.prior_week_cost, jtd_hours: lt.jtd_hours, jtd_cost: lt.jtd_cost, committed: lt.committed_cost, projected: lt.projected_cost },
      { label: 'Material', num: 2, costType: 2, est_hours: 0, est_cost: cs.material.est_cost, prev_wk: cs.material.prior_week_cost, jtd_hours: 0, jtd_cost: cs.material.jtd_cost, committed: cs.material.committed_cost, projected: cs.material.projected_cost },
      { label: 'Subcontracts', num: 3, costType: 3, est_hours: 0, est_cost: cs.subcontracts.est_cost, prev_wk: cs.subcontracts.prior_week_cost, jtd_hours: 0, jtd_cost: cs.subcontracts.jtd_cost, committed: cs.subcontracts.committed_cost, projected: cs.subcontracts.projected_cost },
      { label: 'Rentals', num: 4, costType: 4, est_hours: 0, est_cost: cs.rentals.est_cost, prev_wk: cs.rentals.prior_week_cost, jtd_hours: 0, jtd_cost: cs.rentals.jtd_cost, committed: cs.rentals.committed_cost, projected: cs.rentals.projected_cost },
      { label: 'MEP Equipment', num: 5, costType: 5, est_hours: 0, est_cost: cs.mep_equipment.est_cost, prev_wk: cs.mep_equipment.prior_week_cost, jtd_hours: 0, jtd_cost: cs.mep_equipment.jtd_cost, committed: cs.mep_equipment.committed_cost, projected: cs.mep_equipment.projected_cost },
      { label: 'General Conditions', num: 6, costType: 6, est_hours: 0, est_cost: cs.general_conditions.est_cost, prev_wk: cs.general_conditions.prior_week_cost, jtd_hours: 0, jtd_cost: cs.general_conditions.jtd_cost, committed: cs.general_conditions.committed_cost, projected: cs.general_conditions.projected_cost },
    ];
  };

  const costRows = buildCostRows();

  // Compute totals from cost rows
  const totals = costRows ? costRows.reduce((acc, r) => ({
    est_hours: acc.est_hours + r.est_hours,
    est_cost: acc.est_cost + r.est_cost,
    prev_wk: acc.prev_wk + r.prev_wk,
    jtd_hours: acc.jtd_hours + r.jtd_hours,
    jtd_cost: acc.jtd_cost + r.jtd_cost,
    committed: acc.committed + r.committed,
    projected: acc.projected + r.projected,
  }), { est_hours: 0, est_cost: 0, prev_wk: 0, jtd_hours: 0, jtd_cost: 0, committed: 0, projected: 0 }) : null;

  // Cost type colors for the numbered badges (matching Vista's color coding)
  const costTypeColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div>
      {/* ===== HEADER ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <Link to={`/projects/${projectId}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>&larr; Back</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem', color: '#1e293b' }}>Contract Status Drilldown</h2>
          {project && <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{project.number} - {project.name}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          {c && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => captureSnapshotMutation.mutate()}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                disabled={captureSnapshotMutation.isPending}
              >
                {captureSnapshotMutation.isPending ? 'Capturing...' : 'Capture Snapshot'}
              </button>
              <Link
                to={`/projects/${projectId}/performance`}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', textDecoration: 'none' }}
              >
                Performance Trends
              </Link>
            </div>
          )}
          {showSnapshotSuccess && (
            <div style={{ fontSize: '0.75rem', color: '#047857', background: '#d1fae5', padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #10b981' }}>
              Snapshot captured!
            </div>
          )}
        </div>
      </div>

      {!c ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ margin: 0, color: '#64748b' }}>No Vista Contract Linked</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Link a contract in the <Link to="/settings/vista">Vista Linking Manager</Link>
          </p>
        </div>
      ) : (
        <>
          {/* ===== CONTRACT INFO BAR ===== */}
          <div className="card" style={{ padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: '#334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span><strong>Contract:</strong> {c.contract_number}</span>
                {c.description && <span><strong>Description:</strong> {c.description}</span>}
                {c.customer_name && <span><strong>Customer:</strong> {c.customer_name}</span>}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {c.project_manager_name && <span><strong>PM:</strong> {c.project_manager_name}</span>}
                {c.department_code && <span><strong>Dept:</strong> {c.department_code}</span>}
                {c.status && <span><strong>Status:</strong> {c.status}</span>}
                {c.start_month && <span><strong>Start:</strong> {format(new Date(c.start_month), 'MM/yy')}</span>}
              </div>
            </div>
          </div>

          {/* ===== JOB SELECTOR ===== */}
          {jobs && jobs.length > 1 && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Job:</span>
              <button
                onClick={() => setSelectedJob(null)}
                style={{
                  fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                  border: selectedJob === null ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                  background: selectedJob === null ? '#eff6ff' : '#fff',
                  cursor: 'pointer', fontWeight: selectedJob === null ? 600 : 400,
                }}
              >
                All Jobs ({jobs.length})
              </button>
              {jobs.map(j => (
                <button
                  key={j.job}
                  onClick={() => setSelectedJob(j.job)}
                  style={{
                    fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                    border: selectedJob === j.job ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    background: selectedJob === j.job ? '#eff6ff' : '#fff',
                    cursor: 'pointer', fontWeight: selectedJob === j.job ? 600 : 400,
                  }}
                  title={j.job_description}
                >
                  {j.job}
                </button>
              ))}
              {selectedJob && (() => {
                const selected = jobs.find(j => j.job === selectedJob);
                return selected?.job_description ? (
                  <span style={{ fontSize: '0.7rem', color: '#475569', fontStyle: 'italic', marginLeft: '0.25rem' }}>
                    — {selected.job_description}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {/* ===== THREE-BOX SUMMARY ROW ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {/* Box 1: Contract */}
            <div className="card" style={{ padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.35rem' }}>Contract</div>
              <SRow label="Original Contract" value={fmt(c.orig_contract_amount)} highlight />
              <SRow label="Approved Changes" value={fmt(c.approved_changes)} />
              <SRow label="Revised Contract" value={fmt(c.contract_amount)} highlight />
              <SRow label="Pending Change Orders" value={fmt(c.pending_change_orders)} italic={num(c.pending_change_orders) > 0} valueColor={num(c.pending_change_orders) > 0 ? '#0891b2' : undefined} />
              <SRow label="Est Revenue" value={fmt(c.projected_revenue)} highlight />
            </div>

            {/* Box 2: Progress */}
            <div className="card" style={{ padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.35rem' }}>Progress</div>
              <SRow label="% Complete" value={calcPctComplete(c.earned_revenue, c.projected_revenue)} highlight />
              <SRow label="% Billed" value={fmtPctRaw(pctBilled)} />
              <SRow label="Billed To Date" value={fmt(c.billed_amount)} />
              <SRow label="Earned Revenue" value={fmt(c.earned_revenue)} />
              <SRow label="Over/(Under) Billed" value={fmt(overUnderBilled)} valueColor={overUnderBilled !== 0 ? (overUnderBilled > 0 ? '#10b981' : '#ef4444') : undefined} />
            </div>

            {/* Box 3: Net Cash Flow */}
            <div className="card" style={{ padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.35rem' }}>Net Cash Flow</div>
              <SRow label="Cash Received" value={fmt(c.received_amount)} />
              <SRow label="Cash Paid" value={fmt(c.actual_cost)} />
              <SRow label="Net Cash Flow" value={fmt(c.cash_flow)} highlight valueColor={getCashFlowColor(c.cash_flow)} />
              <SRow label="Open Receivables" value={fmt(c.open_receivables)} italic />
              <SRow label="Backlog" value={fmt(c.backlog)} />
            </div>
          </div>

          {/* ===== COST TYPE TABLE ===== */}
          <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: '0.75rem' }}>
            {costRows && totals ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ ...thStyle, textAlign: 'left', minWidth: '140px' }}>Cost Type</th>
                    <th style={thStyle}>Est Hours</th>
                    <th style={thStyle}>Est Cost</th>
                    <th style={thStyle}>Prev Week</th>
                    <th style={thStyle}>JTD Hours</th>
                    <th style={thStyle}>JTD Cost</th>
                    <th style={thStyle}>Variance</th>
                    <th style={thStyle}>Committed</th>
                    <th style={thStyle}>Projected @ Compl</th>
                    <th style={thStyle}>Variance</th>
                    <th style={thStyle}>Rem Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {costRows.map((row, i) => {
                    const jtdVariance = row.est_cost - row.jtd_cost;
                    const projVariance = row.est_cost - row.projected;
                    const remSpend = row.projected - row.committed - row.jtd_cost;
                    return (
                      <tr
                        key={row.costType}
                        onClick={() => drillIn(row.costType)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ''; }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>
                          <span style={{
                            display: 'inline-block', width: '1.2rem', height: '1.2rem', lineHeight: '1.2rem',
                            textAlign: 'center', borderRadius: '3px', marginRight: '0.4rem',
                            backgroundColor: costTypeColors[i], color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                          }}>{row.num}</span>
                          {row.label}
                        </td>
                        <td style={tdStyle}>{row.est_hours ? fmtNum(row.est_hours) : '-'}</td>
                        <td style={tdStyle}>{fmt(row.est_cost)}</td>
                        <td style={tdStyle}>{fmt(row.prev_wk)}</td>
                        <td style={tdStyle}>{row.jtd_hours ? fmtNum(row.jtd_hours) : '-'}</td>
                        <td style={tdStyle}>{fmt(row.jtd_cost)}</td>
                        <td style={{ ...tdStyle, color: getVarianceColor(jtdVariance), fontWeight: 500 }}>{fmt(jtdVariance)}</td>
                        <td style={tdStyle}>{fmt(row.committed)}</td>
                        <td style={{ ...tdStyle, color: getProjectedColor(row.projected, row.est_cost), fontWeight: 600 }}>{fmt(row.projected)}</td>
                        <td style={{ ...tdStyle, color: getVarianceColor(projVariance), fontWeight: 500 }}>{fmt(projVariance)}</td>
                        <td style={{ ...tdStyle, fontWeight: 500, color: remSpend > 0 ? '#3b82f6' : remSpend < 0 ? '#ef4444' : undefined }}>{fmt(remSpend)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ ...tfStyle, textAlign: 'left' }}>Total for Contract</td>
                    <td style={tfStyle}>{totals.est_hours ? fmtNum(totals.est_hours) : '-'}</td>
                    <td style={tfStyle}>{fmt(totals.est_cost)}</td>
                    <td style={tfStyle}>{fmt(totals.prev_wk)}</td>
                    <td style={tfStyle}>{totals.jtd_hours ? fmtNum(totals.jtd_hours) : '-'}</td>
                    <td style={tfStyle}>{fmt(totals.jtd_cost)}</td>
                    <td style={{ ...tfStyle, color: getVarianceColor(totals.est_cost - totals.jtd_cost) }}>{fmt(totals.est_cost - totals.jtd_cost)}</td>
                    <td style={tfStyle}>{fmt(totals.committed)}</td>
                    <td style={{ ...tfStyle, color: getProjectedColor(totals.projected, totals.est_cost) }}>{fmt(totals.projected)}</td>
                    <td style={{ ...tfStyle, color: getVarianceColor(totals.est_cost - totals.projected) }}>{fmt(totals.est_cost - totals.projected)}</td>
                    {(() => { const totalRemSpend = totals.projected - totals.committed - totals.jtd_cost; return (
                      <td style={{ ...tfStyle, color: totalRemSpend > 0 ? '#3b82f6' : totalRemSpend < 0 ? '#ef4444' : undefined }}>{fmt(totalRemSpend)}</td>
                    ); })()}
                  </tr>
                </tfoot>
              </table>
            ) : (
              /* Fallback: contract-level totals when no phase code data */
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Cost Type</th>
                    <th style={thStyle}>Estimate</th>
                    <th style={thStyle}>JTD</th>
                    <th style={thStyle}>Projected</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Labor', num: 1, est: c.current_est_labor_cost, jtd: null, proj: c.ttl_labor_projected },
                    { label: 'Material', num: 2, est: c.material_estimate, jtd: c.material_jtd, proj: c.material_projected },
                    { label: 'Subcontracts', num: 3, est: c.subcontracts_estimate, jtd: c.subcontracts_jtd, proj: c.subcontracts_projected },
                    { label: 'Rentals', num: 4, est: c.rentals_estimate, jtd: c.rentals_jtd, proj: c.rentals_projected },
                    { label: 'MEP Equipment', num: 5, est: c.mep_equip_estimate, jtd: c.mep_equip_jtd, proj: c.mep_equip_projected },
                  ].map((row, i) => (
                    <tr key={row.num} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>
                        <span style={{
                          display: 'inline-block', width: '1.2rem', height: '1.2rem', lineHeight: '1.2rem',
                          textAlign: 'center', borderRadius: '3px', marginRight: '0.4rem',
                          backgroundColor: costTypeColors[i], color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                        }}>{row.num}</span>
                        {row.label}
                      </td>
                      <td style={tdStyle}>{fmt(row.est)}</td>
                      <td style={tdStyle}>{fmt(row.jtd)}</td>
                      <td style={{ ...tdStyle, color: getProjectedColor(row.proj, row.est), fontWeight: 600 }}>{fmt(row.proj)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ ...tfStyle, textAlign: 'left' }}>Total</td>
                    <td style={tfStyle}>{fmt(c.current_est_cost)}</td>
                    <td style={tfStyle}>{fmt(c.actual_cost)}</td>
                    <td style={{ ...tfStyle, color: getProjectedColor(c.projected_cost, c.current_est_cost) }}>{fmt(c.projected_cost)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* ===== BOTTOM METRICS BAR ===== */}
          <div className="card" style={{ padding: '0.6rem 0.85rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <MetricChip label="Estimated Margin" value={fmt(c.original_estimated_margin)} />
              <MetricChip label="Estimated Margin %" value={fmtPct(c.original_estimated_margin_pct)} />
              <MetricChip label="Gross Margin" value={fmt(c.gross_profit_dollars)}
                valueColor={getGrossProfitColor(c.gross_profit_dollars, c.original_estimated_margin)} />
              <MetricChip label="Gross Margin %" value={fmtPct(c.gross_profit_percent)}
                valueColor={getGrossProfitColor(c.gross_profit_percent, c.original_estimated_margin_pct)} />
              <MetricChip label="Estimated Labor Rate" value={fmtRate(c.estimated_labor_rate)} />
              <MetricChip label="Actual Labor Rate" value={fmtRate(c.actual_labor_rate)}
                valueColor={getProjectedColor(c.actual_labor_rate, c.estimated_labor_rate)} />
            </div>
            {/* Margin override controls */}
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem' }}>
              {project?.override_original_estimated_margin != null && (
                <div style={{ fontSize: '0.72rem', color: '#2563eb', marginBottom: '0.25rem' }}>
                  Override: {fmt(project.override_original_estimated_margin)} ({fmtPct(project.override_original_estimated_margin_pct)})
                </div>
              )}
              <button
                onClick={() => setShowOverrideInputs(!showOverrideInputs)}
                style={{ fontSize: '0.68rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                {showOverrideInputs ? 'Hide Override' : 'Set Margin Override'}
              </button>
              {showOverrideInputs && (
                <div style={{ marginTop: '0.35rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', maxWidth: '400px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginBottom: '0.35rem' }}>
                    Override Vista margin for snapshots & charts
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.7rem', color: '#475569', minWidth: '25px' }}>$</label>
                    <input
                      type="text" inputMode="numeric" value={marginOverride}
                      onChange={e => handleMarginDollarChange(e.target.value)}
                      onBlur={handleMarginDollarBlur}
                      placeholder="Margin $"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.7rem', color: '#475569', minWidth: '25px' }}>%</label>
                    <input
                      type="number" step="0.01" value={marginPctOverride}
                      onChange={e => handleMarginPctChange(e.target.value)}
                      placeholder="Margin %"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button onClick={handleSaveOverrides} disabled={saveOverridesMutation.isPending}
                      className="btn btn-primary" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                      {saveOverridesMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => backfillMutation.mutate()}
                      disabled={backfillMutation.isPending || (project?.override_original_estimated_margin == null && project?.override_original_estimated_margin_pct == null)}
                      className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}>
                      {backfillMutation.isPending ? 'Updating...' : 'Apply to Past Snapshots'}
                    </button>
                    <button onClick={handleClearOverrides} className="btn btn-secondary"
                      style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== RATES BY PHASE PREFIX (Trade Drilldowns) ===== */}
          {costSummary && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>Rates By Phase Prefix</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Trade</th>
                    <th style={thStyle}>Est Hours</th>
                    <th style={thStyle}>JTD Hours</th>
                    <th style={thStyle}>Proj Hours</th>
                    <th style={thStyle}>Est Cost</th>
                    <th style={thStyle}>JTD Cost</th>
                    <th style={thStyle}>Projected Cost</th>
                    <th style={thStyle}>Est Rate</th>
                    <th style={thStyle}>JTD Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(['pf', 'sm', 'pl'] as const).map(trade => {
                    const ts = getTradeSummary(trade);
                    const projHours = calcProjectedHours(ts);
                    const tradeLabel = trade === 'pf' ? 'Pipefitter (PF)' : trade === 'sm' ? 'Sheet Metal (SM)' : 'Plumbing (PL)';
                    const estRate = ts.est_hours > 0 ? ts.est_cost / ts.est_hours : 0;
                    const jtdRate = ts.jtd_hours > 0 ? ts.jtd_cost / ts.jtd_hours : 0;
                    return (
                      <tr
                        key={trade}
                        onClick={() => drillIn(1, trade)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ''; }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, color: '#2563eb' }}>{tradeLabel}</td>
                        <td style={tdStyle}>{fmtNum(ts.est_hours)}</td>
                        <td style={tdStyle}>{fmtNum(ts.jtd_hours)}</td>
                        <td style={{ ...tdStyle, color: getProjectedColor(projHours, ts.est_hours), fontWeight: 500 }}>{fmtNum(projHours)}</td>
                        <td style={tdStyle}>{fmt(ts.est_cost)}</td>
                        <td style={tdStyle}>{fmt(ts.jtd_cost)}</td>
                        <td style={{ ...tdStyle, color: getProjectedColor(ts.projected_cost, ts.est_cost), fontWeight: 600 }}>{fmt(ts.projected_cost)}</td>
                        <td style={tdStyle}>{estRate ? fmtRate(estRate) : '-'}</td>
                        <td style={{ ...tdStyle, color: jtdRate && estRate ? getProjectedColor(jtdRate, estRate) : undefined, fontWeight: 500 }}>{jtdRate ? fmtRate(jtdRate) : '-'}</td>
                      </tr>
                    );
                  })}
                  {costSummary.labor.some((l: LaborTradeSummary) => l.trade === 'admin') && (() => {
                    const admin = getTradeSummary('admin');
                    const adminProjHours = calcProjectedHours(admin);
                    const adminEstRate = admin.est_hours > 0 ? admin.est_cost / admin.est_hours : 0;
                    const adminJtdRate = admin.jtd_hours > 0 ? admin.jtd_cost / admin.jtd_hours : 0;
                    return (
                      <tr
                        onClick={() => drillIn(1, 'admin')}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ''; }}
                      >
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, color: '#2563eb' }}>Office/Admin</td>
                        <td style={tdStyle}>{fmtNum(admin.est_hours)}</td>
                        <td style={tdStyle}>{fmtNum(admin.jtd_hours)}</td>
                        <td style={{ ...tdStyle, color: getProjectedColor(adminProjHours, admin.est_hours), fontWeight: 500 }}>{fmtNum(adminProjHours)}</td>
                        <td style={tdStyle}>{fmt(admin.est_cost)}</td>
                        <td style={tdStyle}>{fmt(admin.jtd_cost)}</td>
                        <td style={{ ...tdStyle, color: getProjectedColor(admin.projected_cost, admin.est_cost), fontWeight: 600 }}>{fmt(admin.projected_cost)}</td>
                        <td style={tdStyle}>{adminEstRate ? fmtRate(adminEstRate) : '-'}</td>
                        <td style={{ ...tdStyle, color: adminJtdRate && adminEstRate ? getProjectedColor(adminJtdRate, adminEstRate) : undefined, fontWeight: 500 }}>{adminJtdRate ? fmtRate(adminJtdRate) : '-'}</td>
                      </tr>
                    );
                  })()}
                </tbody>
                <tfoot>
                  {(() => {
                    const lt = costSummary.labor_totals;
                    const totalProjHours = calcProjectedHours(lt);
                    const totalEstRate = lt.est_hours > 0 ? lt.est_cost / lt.est_hours : 0;
                    const totalJtdRate = lt.jtd_hours > 0 ? lt.jtd_cost / lt.jtd_hours : 0;
                    return (
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <td style={{ ...tfStyle, textAlign: 'left' }}>Total Labor</td>
                        <td style={tfStyle}>{fmtNum(lt.est_hours)}</td>
                        <td style={tfStyle}>{fmtNum(lt.jtd_hours)}</td>
                        <td style={{ ...tfStyle, color: getProjectedColor(totalProjHours, lt.est_hours) }}>{fmtNum(totalProjHours)}</td>
                        <td style={tfStyle}>{fmt(lt.est_cost)}</td>
                        <td style={tfStyle}>{fmt(lt.jtd_cost)}</td>
                        <td style={{ ...tfStyle, color: getProjectedColor(lt.projected_cost, lt.est_cost) }}>{fmt(lt.projected_cost)}</td>
                        <td style={tfStyle}>{totalEstRate ? fmtRate(totalEstRate) : '-'}</td>
                        <td style={{ ...tfStyle, color: totalJtdRate && totalEstRate ? getProjectedColor(totalJtdRate, totalEstRate) : undefined }}>{totalJtdRate ? fmtRate(totalJtdRate) : '-'}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const MetricChip: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{label}</div>
    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: valueColor || '#1e293b', fontFamily: 'monospace' }}>{value}</div>
  </div>
);

export default ProjectFinancials;
