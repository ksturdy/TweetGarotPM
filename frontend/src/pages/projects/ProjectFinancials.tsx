import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vistaDataService, VPContract } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';
import { projectSnapshotsApi } from '../../services/projectSnapshots';
import { format } from 'date-fns';

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

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: '0.75rem' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>{title}</div>
    {children}
  </div>
);

const ProjectFinancials: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showSnapshotSuccess, setShowSnapshotSuccess] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  const { data: c, isLoading } = useQuery({
    queryKey: ['vpContract', projectId],
    queryFn: () => vistaDataService.getContractByProjectId(Number(projectId)),
  });

  const captureSnapshotMutation = useMutation({
    mutationFn: () => projectSnapshotsApi.create(Number(projectId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectSnapshots', projectId] });
      setShowSnapshotSuccess(true);
      setTimeout(() => setShowSnapshotSuccess(false), 3000);
    },
    onError: (error: any) => {
      console.error('Error capturing snapshot:', error);
      alert(error.response?.data?.error || 'Failed to capture snapshot. Please try again.');
    },
  });

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

          {/* Column 3: Cost Breakdown */}
          <div className="card" style={{ padding: '0.75rem' }}>
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
          </div>

          {/* Column 4: Labor Hours */}
          <div className="card" style={{ padding: '0.75rem' }}>
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
            <Section title="Info">
              <Row label="Customer" value={c.customer_name || '-'} />
              <Row label="Market" value={c.primary_market || '-'} />
              <Row label="Negotiated" value={c.negotiated_work || '-'} />
              {c.start_month && <Row label="Start" value={format(new Date(c.start_month), 'MMM yyyy')} />}
              {c.month_closed && <Row label="Closed" value={format(new Date(c.month_closed), 'MMM yyyy')} />}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectFinancials;
