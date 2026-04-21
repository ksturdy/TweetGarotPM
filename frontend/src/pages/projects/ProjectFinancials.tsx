import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vistaDataService, VPContract, PhaseCodeCostSummary, LaborTradeSummary } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';
import { projectSnapshotsApi } from '../../services/projectSnapshots';
import { format } from 'date-fns';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const fmt =(value: number | string | null | undefined): string => {
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
  return `$${num.toFixed(2)}/hr`;
};

const calcPctComplete = (earned: number | string | null | undefined, projected: number | string | null | undefined): string => {
  if (earned === null || earned === undefined || projected === null || projected === undefined) return '-';
  const earnedNum = typeof earned === 'string' ? parseFloat(earned) : earned;
  const projectedNum = typeof projected === 'string' ? parseFloat(projected) : projected;
  if (isNaN(earnedNum) || isNaN(projectedNum) || projectedNum === 0) return '-';
  return `${((earnedNum / projectedNum) * 100).toFixed(1)}%`;
};

const getProjectedColor = (projected: number | string | null | undefined, estimate: number | string | null | undefined): string | undefined => {
  if (projected === null || projected === undefined || estimate === null || estimate === undefined) return undefined;
  const projNum = typeof projected === 'string' ? parseFloat(projected) : projected;
  const estNum = typeof estimate === 'string' ? parseFloat(estimate) : estimate;
  if (isNaN(projNum) || isNaN(estNum) || estNum === 0) return undefined;

  const ratio = projNum / estNum;
  if (ratio < 0.95) return '#10b981'; // Green: under budget (< 95%)
  if (ratio <= 1.05) return '#f59e0b'; // Yellow: close to budget (95-105%)
  return '#ef4444'; // Red: over budget (> 105%)
};

const getCashFlowColor = (cashFlow: number | string | null | undefined): string | undefined => {
  if (cashFlow === null || cashFlow === undefined) return undefined;
  const num = typeof cashFlow === 'string' ? parseFloat(cashFlow) : cashFlow;
  if (isNaN(num) || num === 0) return undefined;
  return num > 0 ? '#10b981' : '#ef4444'; // Green for positive, Red for negative
};

const getMarginColor = (margin: number | string | null | undefined): string | undefined => {
  if (margin === null || margin === undefined) return undefined;
  const num = typeof margin === 'string' ? parseFloat(margin) : margin;
  if (isNaN(num)) return undefined;
  if (num >= 0.15) return '#10b981'; // Green: good margin (>= 15%)
  if (num >= 0.05) return '#f59e0b'; // Yellow: acceptable margin (5-15%)
  return '#ef4444'; // Red: poor margin (< 5%)
};

const getGrossProfitColor = (actual: number | string | null | undefined, estimate: number | string | null | undefined): string | undefined => {
  if (actual === null || actual === undefined || estimate === null || estimate === undefined) return undefined;
  const actualNum = typeof actual === 'string' ? parseFloat(actual) : actual;
  const estNum = typeof estimate === 'string' ? parseFloat(estimate) : estimate;
  if (isNaN(actualNum) || isNaN(estNum) || estNum === 0) return undefined;

  // For gross profit, negative is always bad
  if (actualNum < 0) return '#ef4444'; // Red: losing money

  const ratio = actualNum / estNum;
  if (ratio >= 0.95) return '#10b981'; // Green: meeting or exceeding estimate (>= 95%)
  if (ratio >= 0.75) return '#f59e0b'; // Yellow: somewhat below estimate (75-95%)
  return '#ef4444'; // Red: significantly below estimate (< 75%)
};

const Row: React.FC<{ label: string; value: string; highlight?: boolean; valueColor?: string }> = ({ label, value, highlight, valueColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{label}</span>
    <span style={{
      fontWeight: highlight ? 600 : 400,
      color: valueColor ? '#ffffff' : (highlight ? '#1e40af' : '#1e293b'),
      fontSize: '0.8rem',
      backgroundColor: valueColor ? valueColor : 'transparent',
      padding: valueColor ? '0.15rem 0.5rem' : '0',
      borderRadius: valueColor ? '4px' : '0',
    }}>{value}</span>
  </div>
);

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}> = ({ title, children, onClick }) => (
  <div style={{ marginBottom: '0.75rem' }}>
    <div
      style={{
        fontSize: '0.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase',
        marginBottom: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        userSelect: onClick ? 'none' : 'auto',
      }}
      onClick={onClick}
    >
      <span>{title}</span>
      {onClick && (
        <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>▶</span>
      )}
    </div>
    {children}
  </div>
);

const LaborHeader: React.FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0.15rem 0', borderBottom: '1px solid #e2e8f0', marginBottom: '0.15rem' }}>
    <span />
    <span style={{ textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Hours</span>
    <span style={{ textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Cost</span>
  </div>
);

const LaborRow: React.FC<{
  label: string; hours: string; cost: string;
  highlight?: boolean; hoursColor?: string; costColor?: string;
}> = ({ label, hours, cost, highlight, hoursColor, costColor }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0.2rem 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{label}</span>
    <span style={{
      textAlign: 'right', fontWeight: highlight ? 600 : 400, fontSize: '0.8rem',
      color: hoursColor ? '#ffffff' : (highlight ? '#1e40af' : '#1e293b'),
      backgroundColor: hoursColor || 'transparent',
      padding: hoursColor ? '0.1rem 0.4rem' : '0',
      borderRadius: hoursColor ? '4px' : '0',
      justifySelf: 'end',
    }}>{hours}</span>
    <span style={{
      textAlign: 'right', fontWeight: highlight ? 600 : 400, fontSize: '0.8rem',
      color: costColor ? '#ffffff' : (highlight ? '#1e40af' : '#1e293b'),
      backgroundColor: costColor || 'transparent',
      padding: costColor ? '0.1rem 0.4rem' : '0',
      borderRadius: costColor ? '4px' : '0',
      justifySelf: 'end',
    }}>{cost}</span>
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
    if (!costSummary?.labor) return { est_hours: 0, jtd_hours: 0, est_cost: 0, jtd_cost: 0, projected_cost: 0 };
    const rows = costSummary.labor.filter((l: LaborTradeSummary) => l.trade === trade);
    return {
      est_hours: rows.reduce((s: number, r: LaborTradeSummary) => s + r.est_hours, 0),
      jtd_hours: rows.reduce((s: number, r: LaborTradeSummary) => s + r.jtd_hours, 0),
      est_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + r.est_cost, 0),
      jtd_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + r.jtd_cost, 0),
      projected_cost: rows.reduce((s: number, r: LaborTradeSummary) => s + r.projected_cost, 0),
    };
  };

  // Projected Hours = Projected Cost / Rate
  // Rate = JTD Cost / JTD Hours (preferred), fallback to Est Cost / Est Hours
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

  const fmtDollarInput = (num: number) =>
    Math.round(num).toLocaleString('en-US');

  const parseDollarInput = (str: string) =>
    parseFloat(str.replace(/,/g, ''));

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
    // Allow only digits, commas, and minus
    const cleaned = value.replace(/[^0-9,\-]/g, '');
    setMarginOverride(cleaned);
    const num = parseDollarInput(cleaned);
    if (!isNaN(num) && projectedRevenue > 0) {
      const pct = (num / projectedRevenue) * 100;
      setMarginPctOverride(isNaN(pct) ? '' : String(Number(pct.toFixed(2))));
    } else if (!cleaned) {
      setMarginPctOverride('');
    }
  };

  const handleMarginDollarBlur = () => {
    const num = parseDollarInput(marginOverride);
    if (!isNaN(num) && marginOverride) {
      setMarginOverride(fmtDollarInput(num));
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <Link to={`/projects/${projectId}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>&larr; Back</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Financials</h2>
          {project && <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{project.name}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          {c && (
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
              <div><strong>{c.contract_number}</strong> | {c.status}</div>
              <div>{c.project_manager_name} | Dept {c.department_code}</div>
            </div>
          )}
          {c && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => captureSnapshotMutation.mutate()}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                disabled={captureSnapshotMutation.isPending}
              >
                {captureSnapshotMutation.isPending ? '⏳ Capturing...' : '📸 Capture Snapshot'}
              </button>
              <Link
                to={`/projects/${projectId}/performance`}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', textDecoration: 'none' }}
              >
                📊 Performance Trends
              </Link>
            </div>
          )}
          {showSnapshotSuccess && (
            <div style={{
              fontSize: '0.75rem',
              color: '#047857',
              background: '#d1fae5',
              padding: '0.35rem 0.6rem',
              borderRadius: '4px',
              border: '1px solid #10b981'
            }}>
              ✓ Snapshot captured successfully!
            </div>
          )}
        </div>
      </div>

      {!c ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</div>
          <h3 style={{ margin: 0, color: '#64748b' }}>No Vista Contract Linked</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Link a contract in the <Link to="/settings/vista">Vista Linking Manager</Link>
          </p>
        </div>
      ) : (
        <>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {/* Column 1: Contract & Revenue */}
          <div className="card" style={{ padding: '0.75rem' }}>
            <Section title="Contract Values">
              <Row label="Original Contract" value={fmt(c.orig_contract_amount)} />
              <Row label="Current Contract" value={fmt(c.contract_amount)} highlight />
              <Row label="Approved Changes" value={fmt(c.approved_changes)} />
              <Row label="Pending COs" value={fmt(c.pending_change_orders)} />
              <Row label="CO Count" value={fmtNum(c.change_order_count)} />
            </Section>
            <Section title="Revenue & Progress">
              <Row label="Projected Revenue" value={fmt(c.projected_revenue)} highlight />
              <Row label="Earned Revenue" value={fmt(c.earned_revenue)} />
              <Row label="% Complete" value={calcPctComplete(c.earned_revenue, c.projected_revenue)} highlight />
              <Row label="Backlog" value={fmt(c.backlog)} />
            </Section>
            <Section title="Margin">
              <Row label="Gross Profit $" value={fmt(c.gross_profit_dollars)} valueColor={getGrossProfitColor(c.gross_profit_dollars, c.original_estimated_margin)} />
              <Row label="Gross Profit %" value={fmtPct(c.gross_profit_percent)} valueColor={getGrossProfitColor(c.gross_profit_percent, c.original_estimated_margin_pct)} />
              <Row label="Orig Est Margin" value={fmt(c.original_estimated_margin)} />
              <Row label="Orig Est Margin %" value={fmtPct(c.original_estimated_margin_pct)} />
              {project?.override_original_estimated_margin != null && (
                <Row label="Override Margin $" value={fmt(project.override_original_estimated_margin)} valueColor="#2563eb" />
              )}
              {project?.override_original_estimated_margin_pct != null && (
                <Row label="Override Margin %" value={fmtPct(project.override_original_estimated_margin_pct)} valueColor="#2563eb" />
              )}
              <div style={{ marginTop: '0.35rem' }}>
                <button
                  onClick={() => setShowOverrideInputs(!showOverrideInputs)}
                  style={{ fontSize: '0.65rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {showOverrideInputs ? 'Hide Override' : 'Set Override'}
                </button>
              </div>
              {showOverrideInputs && (
                <div style={{ marginTop: '0.35rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
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
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.7rem', color: '#475569', minWidth: '25px' }}>%</label>
                    <input
                      type="number" step="0.01" value={marginPctOverride}
                      onChange={e => handleMarginPctChange(e.target.value)}
                      placeholder="Margin %"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '3px', width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleSaveOverrides}
                      disabled={saveOverridesMutation.isPending}
                      className="btn btn-primary"
                      style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                    >
                      {saveOverridesMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => backfillMutation.mutate()}
                      disabled={backfillMutation.isPending || (project?.override_original_estimated_margin == null && project?.override_original_estimated_margin_pct == null)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                    >
                      {backfillMutation.isPending ? 'Updating...' : 'Apply to Past Snapshots'}
                    </button>
                    <button
                      onClick={handleClearOverrides}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', color: '#ef4444' }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </Section>
          </div>

          {/* Column 2: Billing & Costs */}
          <div className="card" style={{ padding: '0.75rem' }}>
            <Section title="Billing & AR">
              <Row label="Billed Amount" value={fmt(c.billed_amount)} />
              <Row label="Received Amount" value={fmt(c.received_amount)} />
              <Row label="Open Receivables" value={fmt(c.open_receivables)} highlight />
              <Row label="Cash Flow" value={fmt(c.cash_flow)} valueColor={getCashFlowColor(c.cash_flow)} />
            </Section>
            <Section title="Costs">
              <Row label="Actual Cost" value={fmt(c.actual_cost)} highlight />
              <Row label="Projected Cost" value={fmt(c.projected_cost)} />
              <Row label="Current Est Cost" value={fmt(c.current_est_cost)} />
            </Section>
            <Section title="Labor Rates">
              <Row label="Actual Rate" value={fmtRate(c.actual_labor_rate)} valueColor={getProjectedColor(c.actual_labor_rate, c.estimated_labor_rate)} />
              <Row label="Estimated Rate" value={fmtRate(c.estimated_labor_rate)} />
              <Row label="Est Labor Cost" value={fmt(c.current_est_labor_cost)} />
              <Row label="Labor Projected" value={fmt(c.ttl_labor_projected)} valueColor={getProjectedColor(c.ttl_labor_projected, c.current_est_labor_cost)} />
            </Section>
          </div>

          {/* Column 3: Cost Breakdown (from Phase Codes) */}
          <div className="card" style={{ padding: '0.75rem' }}>
            {costSummary ? (
              <>
                <Section title="Material" onClick={() => drillIn(2)}>
                  <Row label="Estimate" value={fmt(costSummary.costs.material.est_cost)} />
                  <Row label="JTD" value={fmt(costSummary.costs.material.jtd_cost)} highlight />
                  <Row label="Projected" value={fmt(costSummary.costs.material.projected_cost)} valueColor={getProjectedColor(costSummary.costs.material.projected_cost, costSummary.costs.material.est_cost)} />
                </Section>
                <Section title="Subcontracts" onClick={() => drillIn(3)}>
                  <Row label="Estimate" value={fmt(costSummary.costs.subcontracts.est_cost)} />
                  <Row label="JTD" value={fmt(costSummary.costs.subcontracts.jtd_cost)} highlight />
                  <Row label="Projected" value={fmt(costSummary.costs.subcontracts.projected_cost)} valueColor={getProjectedColor(costSummary.costs.subcontracts.projected_cost, costSummary.costs.subcontracts.est_cost)} />
                </Section>
                <Section title="Rentals" onClick={() => drillIn(4)}>
                  <Row label="Estimate" value={fmt(costSummary.costs.rentals.est_cost)} />
                  <Row label="JTD" value={fmt(costSummary.costs.rentals.jtd_cost)} highlight />
                  <Row label="Projected" value={fmt(costSummary.costs.rentals.projected_cost)} valueColor={getProjectedColor(costSummary.costs.rentals.projected_cost, costSummary.costs.rentals.est_cost)} />
                </Section>
                <Section title="MEP Equipment" onClick={() => drillIn(5)}>
                  <Row label="Estimate" value={fmt(costSummary.costs.mep_equipment.est_cost)} />
                  <Row label="JTD" value={fmt(costSummary.costs.mep_equipment.jtd_cost)} highlight />
                  <Row label="Projected" value={fmt(costSummary.costs.mep_equipment.projected_cost)} valueColor={getProjectedColor(costSummary.costs.mep_equipment.projected_cost, costSummary.costs.mep_equipment.est_cost)} />
                </Section>
                <Section title="General Conditions" onClick={() => drillIn(6)}>
                  <Row label="Estimate" value={fmt(costSummary.costs.general_conditions.est_cost)} />
                  <Row label="JTD" value={fmt(costSummary.costs.general_conditions.jtd_cost)} highlight />
                  <Row label="Projected" value={fmt(costSummary.costs.general_conditions.projected_cost)} valueColor={getProjectedColor(costSummary.costs.general_conditions.projected_cost, costSummary.costs.general_conditions.est_cost)} />
                </Section>
              </>
            ) : (
              <>
                <Section title="Material">
                  <Row label="Estimate" value={fmt(c.material_estimate)} />
                  <Row label="JTD" value={fmt(c.material_jtd)} highlight />
                  <Row label="Projected" value={fmt(c.material_projected)} valueColor={getProjectedColor(c.material_projected, c.material_estimate)} />
                </Section>
                <Section title="Subcontracts">
                  <Row label="Estimate" value={fmt(c.subcontracts_estimate)} />
                  <Row label="JTD" value={fmt(c.subcontracts_jtd)} highlight />
                  <Row label="Projected" value={fmt(c.subcontracts_projected)} valueColor={getProjectedColor(c.subcontracts_projected, c.subcontracts_estimate)} />
                </Section>
                <Section title="Rentals">
                  <Row label="Estimate" value={fmt(c.rentals_estimate)} />
                  <Row label="JTD" value={fmt(c.rentals_jtd)} highlight />
                  <Row label="Projected" value={fmt(c.rentals_projected)} valueColor={getProjectedColor(c.rentals_projected, c.rentals_estimate)} />
                </Section>
                <Section title="MEP Equipment">
                  <Row label="Estimate" value={fmt(c.mep_equip_estimate)} />
                  <Row label="JTD" value={fmt(c.mep_equip_jtd)} highlight />
                  <Row label="Projected" value={fmt(c.mep_equip_projected)} valueColor={getProjectedColor(c.mep_equip_projected, c.mep_equip_estimate)} />
                </Section>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.5rem' }}>
                  From contract totals. Import phase codes for detailed breakdown.
                </div>
              </>
            )}
          </div>

          {/* Column 4: Labor Hours (from Phase Codes) */}
          <div className="card" style={{ padding: '0.75rem' }}>
            {costSummary ? (
              <>
                {(['pf', 'sm', 'pl'] as const).map(trade => {
                  const ts = getTradeSummary(trade);
                  const tradeLabel = trade === 'pf' ? 'Pipefitter (PF)' : trade === 'sm' ? 'Sheet Metal (SM)' : 'Plumbing (PL)';
                  const projectedHours = calcProjectedHours(ts);
                  return (
                    <Section key={trade} title={tradeLabel} onClick={() => drillIn(1, trade)}>
                      <LaborHeader />
                      <LaborRow label="Estimate" hours={fmtNum(ts.est_hours)} cost={fmt(ts.est_cost)} />
                      <LaborRow label="JTD" hours={fmtNum(ts.jtd_hours)} cost={fmt(ts.jtd_cost)} highlight />
                      <LaborRow label="Projected" hours={fmtNum(projectedHours)} cost={fmt(ts.projected_cost)}
                        hoursColor={getProjectedColor(projectedHours, ts.est_hours)}
                        costColor={getProjectedColor(ts.projected_cost, ts.est_cost)} />
                    </Section>
                  );
                })}
                {costSummary.labor.some(l => l.trade === 'admin') && (
                  (() => {
                    const admin = getTradeSummary('admin');
                    const adminProjHours = calcProjectedHours(admin);
                    return (
                      <Section title="Office/Admin" onClick={() => drillIn(1, 'admin')}>
                        <LaborHeader />
                        <LaborRow label="Estimate" hours={fmtNum(admin.est_hours)} cost={fmt(admin.est_cost)} />
                        <LaborRow label="JTD" hours={fmtNum(admin.jtd_hours)} cost={fmt(admin.jtd_cost)} highlight />
                        <LaborRow label="Projected" hours={fmtNum(adminProjHours)} cost={fmt(admin.projected_cost)}
                          hoursColor={getProjectedColor(adminProjHours, admin.est_hours)}
                          costColor={getProjectedColor(admin.projected_cost, admin.est_cost)} />
                      </Section>
                    );
                  })()
                )}
                <Section title="Total Labor">
                  {(() => {
                    const totalProjHours = calcProjectedHours(costSummary.labor_totals);
                    return (
                      <>
                        <LaborHeader />
                        <LaborRow label="Estimate" hours={fmtNum(costSummary.labor_totals.est_hours)} cost={fmt(costSummary.labor_totals.est_cost)} />
                        <LaborRow label="JTD" hours={fmtNum(costSummary.labor_totals.jtd_hours)} cost={fmt(costSummary.labor_totals.jtd_cost)} highlight />
                        <LaborRow label="Projected" hours={fmtNum(totalProjHours)} cost={fmt(costSummary.labor_totals.projected_cost)}
                          hoursColor={getProjectedColor(totalProjHours, costSummary.labor_totals.est_hours)}
                          costColor={getProjectedColor(costSummary.labor_totals.projected_cost, costSummary.labor_totals.est_cost)} />
                      </>
                    );
                  })()}
                </Section>
              </>
            ) : (
              <>
                <Section title="Pipefitter (PF)">
                  <Row label="Estimate" value={fmtNum(c.pf_hours_estimate)} />
                  <Row label="JTD" value={fmtNum(c.pf_hours_jtd)} highlight />
                  <Row label="Projected" value={fmtNum(c.pf_hours_projected)} valueColor={getProjectedColor(c.pf_hours_projected, c.pf_hours_estimate)} />
                </Section>
                <Section title="Sheet Metal (SM)">
                  <Row label="Estimate" value={fmtNum(c.sm_hours_estimate)} />
                  <Row label="JTD" value={fmtNum(c.sm_hours_jtd)} highlight />
                  <Row label="Projected" value={fmtNum(c.sm_hours_projected)} valueColor={getProjectedColor(c.sm_hours_projected, c.sm_hours_estimate)} />
                </Section>
                <Section title="Plumbing (PL)">
                  <Row label="Estimate" value={fmtNum(c.pl_hours_estimate)} />
                  <Row label="JTD" value={fmtNum(c.pl_hours_jtd)} highlight />
                  <Row label="Projected" value={fmtNum(c.pl_hours_projected)} valueColor={getProjectedColor(c.pl_hours_projected, c.pl_hours_estimate)} />
                </Section>
                <Section title="Total Hours">
                  <Row label="Estimate" value={fmtNum(c.total_hours_estimate)} />
                  <Row label="JTD" value={fmtNum(c.total_hours_jtd)} highlight />
                  <Row label="Projected" value={fmtNum(c.total_hours_projected)} valueColor={getProjectedColor(c.total_hours_projected, c.total_hours_estimate)} />
                </Section>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.5rem' }}>
                  From contract totals. Import phase codes for detailed breakdown.
                </div>
              </>
            )}
            {costSummary ? (
              <>
                <Section title="Cost Totals">
                  <Row label="Labor" value={fmt(costSummary.labor_totals.projected_cost)} />
                  <Row label="Material" value={fmt(costSummary.costs.material.projected_cost)} />
                  <Row label="Subcontracts" value={fmt(costSummary.costs.subcontracts.projected_cost)} />
                  <Row label="Rentals" value={fmt(costSummary.costs.rentals.projected_cost)} />
                  <Row label="MEP Equipment" value={fmt(costSummary.costs.mep_equipment.projected_cost)} />
                  <Row label="General Cond." value={fmt(costSummary.costs.general_conditions.projected_cost)} />
                </Section>
                <Section title="Total Project Cost">
                  {(() => {
                    const totalEst = costSummary.labor_totals.est_cost
                      + costSummary.costs.material.est_cost + costSummary.costs.subcontracts.est_cost
                      + costSummary.costs.rentals.est_cost + costSummary.costs.mep_equipment.est_cost
                      + costSummary.costs.general_conditions.est_cost;
                    const totalJtd = costSummary.labor_totals.jtd_cost
                      + costSummary.costs.material.jtd_cost + costSummary.costs.subcontracts.jtd_cost
                      + costSummary.costs.rentals.jtd_cost + costSummary.costs.mep_equipment.jtd_cost
                      + costSummary.costs.general_conditions.jtd_cost;
                    const totalProj = costSummary.labor_totals.projected_cost
                      + costSummary.costs.material.projected_cost + costSummary.costs.subcontracts.projected_cost
                      + costSummary.costs.rentals.projected_cost + costSummary.costs.mep_equipment.projected_cost
                      + costSummary.costs.general_conditions.projected_cost;
                    return (
                      <>
                        <Row label="Estimate" value={fmt(totalEst)} />
                        <Row label="JTD" value={fmt(totalJtd)} highlight />
                        <Row label="Projected" value={fmt(totalProj)}
                          valueColor={getProjectedColor(totalProj, totalEst)} />
                      </>
                    );
                  })()}
                </Section>
              </>
            ) : (
              <Section title="Info">
                <Row label="Customer" value={c.customer_name || '-'} />
                <Row label="Market" value={c.primary_market || '-'} />
                <Row label="Negotiated" value={c.negotiated_work || '-'} />
                {c.start_month && <Row label="Start" value={format(new Date(c.start_month), 'MMM yyyy')} />}
                {c.month_closed && <Row label="Closed" value={format(new Date(c.month_closed), 'MMM yyyy')} />}
              </Section>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default ProjectFinancials;
