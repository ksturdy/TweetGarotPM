import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vistaDataService, PhaseCodeDetailRow } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';

const COST_TYPE_LABELS: Record<number, string> = {
  1: 'Labor',
  2: 'Material',
  3: 'Subcontracts',
  4: 'Rentals',
  5: 'MEP Equipment',
  6: 'General Conditions',
};

const TRADE_LABELS: Record<string, string> = {
  pf: 'Pipefitter (PF)',
  sm: 'Sheet Metal (SM)',
  pl: 'Plumbing (PL)',
  admin: 'Office/Admin',
};

const fmt = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const fmtNum = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
};

const getVarianceColor = (projected: number, estimate: number): string | undefined => {
  if (!estimate || !projected) return undefined;
  const ratio = projected / estimate;
  if (ratio <= 0.95) return '#10b981';
  if (ratio <= 1.05) return '#f59e0b';
  return '#ef4444';
};

const CostDrillIn: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const costType = Number(searchParams.get('cost_type')) || 0;
  const trade = searchParams.get('trade') || undefined;
  const job = searchParams.get('job') || undefined;

  const isLabor = costType === 1;
  const title = isLabor && trade ? TRADE_LABELS[trade] || 'Labor' : COST_TYPE_LABELS[costType] || 'Cost Detail';

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ['phaseCodeDetail', projectId, job, costType, trade],
    queryFn: () => vistaDataService.getPhaseCodeDetail(Number(projectId), {
      job,
      costType: costType || undefined,
      trade,
    }),
    enabled: !!costType,
  });

  // Compute totals
  const totals = rows?.reduce(
    (acc, row) => ({
      est_hours: acc.est_hours + Number(row.est_hours || 0),
      jtd_hours: acc.jtd_hours + Number(row.jtd_hours || 0),
      est_cost: acc.est_cost + Number(row.est_cost || 0),
      jtd_cost: acc.jtd_cost + Number(row.jtd_cost || 0),
      committed_cost: acc.committed_cost + Number(row.committed_cost || 0),
      projected_cost: acc.projected_cost + Number(row.projected_cost || 0),
      prior_week_cost: acc.prior_week_cost + Number(row.prior_week_cost || 0),
    }),
    { est_hours: 0, jtd_hours: 0, est_cost: 0, jtd_cost: 0, committed_cost: 0, projected_cost: 0, prior_week_cost: 0 }
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to={`/projects/${projectId}/financials`}
          style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        >
          &larr; Back to Financials
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: '0.5rem 0 0.25rem' }}>
          {title}
        </h1>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          {project?.number} - {project?.name}
          {job && <span style={{ marginLeft: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.75rem' }}>Job: {job}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isLabor ? 8 : 6}, 1fr)`, gap: '1rem', marginBottom: '1.5rem' }}>
          {isLabor && (
            <>
              <SummaryCard label="Est Hours" value={fmtNum(totals.est_hours)} />
              <SummaryCard label="JTD Hours" value={fmtNum(totals.jtd_hours)} color={getVarianceColor(totals.jtd_hours, totals.est_hours)} />
            </>
          )}
          <SummaryCard label="Est Cost" value={fmt(totals.est_cost)} />
          <SummaryCard label="JTD Cost" value={fmt(totals.jtd_cost)} />
          <SummaryCard label="Prev Week Cost" value={fmt(totals.prior_week_cost)} />
          <SummaryCard label="Weekly Change" value={fmt(totals.jtd_cost - totals.prior_week_cost)}
            color={(totals.jtd_cost - totals.prior_week_cost) > 0 ? '#3b82f6' : undefined} />
          <SummaryCard label="Committed" value={fmt(totals.committed_cost)} />
          <SummaryCard label="Projected Cost" value={fmt(totals.projected_cost)} color={getVarianceColor(totals.projected_cost, totals.est_cost)} />
        </div>
      )}

      {/* Phase Code Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading phase codes...</div>
        ) : !rows?.length ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No phase codes found for this cost type.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <Th align="left">Phase</Th>
                <Th align="left" style={{ minWidth: '200px' }}>Description</Th>
                {job === undefined && <Th align="left">Job</Th>}
                {isLabor && <Th>Est Hours</Th>}
                {isLabor && <Th>JTD Hours</Th>}
                <Th>Est Cost</Th>
                <Th>Prev Week</Th>
                <Th>JTD Cost</Th>
                <Th>Wk Change</Th>
                <Th>Committed</Th>
                <Th>Projected</Th>
                <Th>Variance</Th>
                <Th>% Complete</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: PhaseCodeDetailRow) => {
                const variance = Number(row.est_cost || 0) - Number(row.projected_cost || 0);
                const varianceColor = variance > 0 ? '#10b981' : variance < 0 ? '#ef4444' : undefined;
                const weeklyChange = Number(row.jtd_cost || 0) - Number(row.prior_week_cost || 0);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <Td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 500 }}>{row.phase}</Td>
                    <Td>{row.phase_description || '-'}</Td>
                    {job === undefined && <Td>{row.job}</Td>}
                    {isLabor && <Td align="right">{fmtNum(row.est_hours)}</Td>}
                    {isLabor && <Td align="right">{fmtNum(row.jtd_hours)}</Td>}
                    <Td align="right">{fmt(row.est_cost)}</Td>
                    <Td align="right">{fmt(row.prior_week_cost)}</Td>
                    <Td align="right">{fmt(row.jtd_cost)}</Td>
                    <Td align="right" style={{ color: weeklyChange > 0 ? '#3b82f6' : weeklyChange < 0 ? '#10b981' : undefined, fontWeight: 500 }}>
                      {fmt(weeklyChange)}
                    </Td>
                    <Td align="right">{fmt(row.committed_cost)}</Td>
                    <Td align="right" style={{ color: getVarianceColor(Number(row.projected_cost), Number(row.est_cost)), fontWeight: 600 }}>
                      {fmt(row.projected_cost)}
                    </Td>
                    <Td align="right" style={{ color: varianceColor, fontWeight: 500 }}>
                      {fmt(variance)}
                    </Td>
                    <Td align="right">
                      {row.percent_complete != null ? `${(Number(row.percent_complete) * 100).toFixed(1)}%` : '-'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                <Td>Total</Td>
                <Td />
                {job === undefined && <Td />}
                {isLabor && <Td align="right">{fmtNum(totals!.est_hours)}</Td>}
                {isLabor && <Td align="right">{fmtNum(totals!.jtd_hours)}</Td>}
                <Td align="right">{fmt(totals!.est_cost)}</Td>
                <Td align="right">{fmt(totals!.prior_week_cost)}</Td>
                <Td align="right">{fmt(totals!.jtd_cost)}</Td>
                <Td align="right" style={{ color: (totals!.jtd_cost - totals!.prior_week_cost) > 0 ? '#3b82f6' : undefined, fontWeight: 700 }}>
                  {fmt(totals!.jtd_cost - totals!.prior_week_cost)}
                </Td>
                <Td align="right">{fmt(totals!.committed_cost)}</Td>
                <Td align="right" style={{ color: getVarianceColor(totals!.projected_cost, totals!.est_cost), fontWeight: 700 }}>
                  {fmt(totals!.projected_cost)}
                </Td>
                <Td align="right" style={{ color: (totals!.est_cost - totals!.projected_cost) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {fmt(totals!.est_cost - totals!.projected_cost)}
                </Td>
                <Td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

// Small helper components
const SummaryCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="card" style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color || '#1e293b' }}>{value}</div>
  </div>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' | 'center'; style?: React.CSSProperties }> = ({ children, align = 'right', style }) => (
  <th style={{ textAlign: align, padding: '0.6rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', ...style }}>
    {children}
  </th>
);

const Td: React.FC<{ children?: React.ReactNode; align?: 'left' | 'right' | 'center'; style?: React.CSSProperties }> = ({ children, align = 'left', style }) => (
  <td style={{ textAlign: align, padding: '0.5rem 0.75rem', ...style }}>
    {children || '-'}
  </td>
);

export default CostDrillIn;
