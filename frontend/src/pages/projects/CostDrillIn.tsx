import React, { useState, useMemo } from 'react';
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

const PREFIX_LABELS: Record<string, string> = {
  '30': 'SM Field (30)',
  '35': 'SM Shop (35)',
  '40': 'PF Field (40)',
  '45': 'PF Shop (45)',
  '50': 'PL Field (50)',
  '55': 'PL Shop (55)',
  '70': 'Admin (70)',
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

type SortKey = 'phase' | 'phase_description' | 'job' | 'est_hours' | 'jtd_hours' | 'est_cost' |
  'prior_week_cost' | 'jtd_cost' | 'wk_change' | 'committed_cost' | 'projected_cost' |
  'remaining_spend' | 'variance' | 'percent_complete';
type SortDir = 'asc' | 'desc';

const CostDrillIn: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedPrefixes, setSelectedPrefixes] = useState<Set<string>>(new Set());

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Derive a row value for sorting (including computed columns)
  const getRowSortValue = (row: PhaseCodeDetailRow, key: SortKey): number | string => {
    switch (key) {
      case 'phase': return row.phase || '';
      case 'phase_description': return row.phase_description || '';
      case 'job': return row.job || '';
      case 'est_hours': return Number(row.est_hours || 0);
      case 'jtd_hours': return Number(row.jtd_hours || 0);
      case 'est_cost': return Number(row.est_cost || 0);
      case 'prior_week_cost': return Number(row.prior_week_cost || 0);
      case 'jtd_cost': return Number(row.jtd_cost || 0);
      case 'wk_change': return Number(row.jtd_cost || 0) - Number(row.prior_week_cost || 0);
      case 'committed_cost': return Number(row.committed_cost || 0);
      case 'projected_cost': return Number(row.projected_cost || 0);
      case 'remaining_spend': return Number(row.projected_cost || 0) - Number(row.committed_cost || 0) - Number(row.jtd_cost || 0);
      case 'variance': return Number(row.est_cost || 0) - Number(row.projected_cost || 0);
      case 'percent_complete': return Number(row.percent_complete || 0);
      default: return 0;
    }
  };

  // Derive available prefixes from data (only for labor)
  const availablePrefixes = useMemo(() => {
    if (!rows || !isLabor) return [];
    const prefixSet = new Set<string>();
    rows.forEach(row => {
      if (row.phase) {
        const prefix = row.phase.split('-')[0];
        if (prefix) prefixSet.add(prefix);
      }
    });
    return Array.from(prefixSet).sort();
  }, [rows, isLabor]);

  const togglePrefix = (prefix: string) => {
    setSelectedPrefixes(prev => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  // Filter + sort rows
  const processedRows = useMemo(() => {
    if (!rows) return [];
    let filtered = rows;
    // Prefix filter (labor only, multi-select)
    if (isLabor && selectedPrefixes.size > 0) {
      filtered = filtered.filter(row => {
        const prefix = (row.phase || '').split('-')[0];
        return selectedPrefixes.has(prefix);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(row =>
        (row.phase || '').toLowerCase().includes(q) ||
        (row.phase_description || '').toLowerCase().includes(q) ||
        (row.job || '').toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      filtered = [...filtered].sort((a, b) => {
        const av = getRowSortValue(a, sortKey);
        const bv = getRowSortValue(b, sortKey);
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        const an = av as number, bn = bv as number;
        return sortDir === 'asc' ? an - bn : bn - an;
      });
    }
    return filtered;
  }, [rows, search, sortKey, sortDir, isLabor, selectedPrefixes]);

  // Compute totals from filtered rows
  const totals = processedRows.reduce(
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

  const totalRemainingSpend = totals.projected_cost - totals.committed_cost - totals.jtd_cost;

  return (
    <div style={{ padding: '1rem 1.5rem', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <Link
          to={`/projects/${projectId}/financials`}
          style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
        >
          &larr; Back to Financials
        </Link>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: '0.25rem 0 0.15rem' }}>
          {title}
        </h1>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          {project?.number} - {project?.name}
          {job && <span style={{ marginLeft: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.75rem' }}>Job: {job}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      {processedRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isLabor ? 8 : 6}, 1fr)`, gap: '0.75rem', marginBottom: '1rem' }}>
          {isLabor && (
            <>
              <SummaryCard label="Est Hours" value={fmtNum(totals.est_hours)} />
              <SummaryCard label="JTD Hours" value={fmtNum(totals.jtd_hours)} color={getVarianceColor(totals.jtd_hours, totals.est_hours)} />
            </>
          )}
          <SummaryCard label="Est Cost" value={fmt(totals.est_cost)} />
          <SummaryCard label="JTD Cost" value={fmt(totals.jtd_cost)} />
          <SummaryCard label="Prev Week" value={fmt(totals.prior_week_cost)} />
          <SummaryCard label="Wk Change" value={fmt(totals.jtd_cost - totals.prior_week_cost)}
            color={(totals.jtd_cost - totals.prior_week_cost) > 0 ? '#3b82f6' : undefined} />
          <SummaryCard label="Committed" value={fmt(totals.committed_cost)} />
          <SummaryCard label="Projected" value={fmt(totals.projected_cost)} color={getVarianceColor(totals.projected_cost, totals.est_cost)} />
        </div>
      )}

      {/* Prefix Filters (labor only) */}
      {isLabor && availablePrefixes.length > 1 && (
        <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Prefix:</span>
          <button
            onClick={() => setSelectedPrefixes(new Set())}
            style={{
              fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
              border: selectedPrefixes.size === 0 ? '2px solid #3b82f6' : '1px solid #cbd5e1',
              background: selectedPrefixes.size === 0 ? '#eff6ff' : '#fff',
              cursor: 'pointer', fontWeight: selectedPrefixes.size === 0 ? 600 : 400,
            }}
          >
            All
          </button>
          {availablePrefixes.map(prefix => {
            const active = selectedPrefixes.has(prefix);
            return (
              <button
                key={prefix}
                onClick={() => togglePrefix(prefix)}
                style={{
                  fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                  border: active ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                  background: active ? '#eff6ff' : '#fff',
                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                }}
              >
                {PREFIX_LABELS[prefix] || prefix}
              </button>
            );
          })}
        </div>
      )}

      {/* Search Box */}
      <div style={{ marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Search by phase, description, or job..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '350px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.8rem',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            outline: 'none',
            backgroundColor: '#fff',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
        />
      </div>

      {/* Phase Code Table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading phase codes...</div>
        ) : !processedRows.length ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            {search ? 'No phase codes match your search.' : 'No phase codes found for this cost type.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <SortTh sortKey="phase" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="left">Phase</SortTh>
                <SortTh sortKey="phase_description" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="left">Description</SortTh>
                {job === undefined && <SortTh sortKey="job" currentSort={sortKey} sortDir={sortDir} onSort={handleSort} align="left">Job</SortTh>}
                {isLabor && <SortTh sortKey="est_hours" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Est Hrs</SortTh>}
                {isLabor && <SortTh sortKey="jtd_hours" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>JTD Hrs</SortTh>}
                <SortTh sortKey="est_cost" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Est Cost</SortTh>
                <SortTh sortKey="prior_week_cost" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Prev Wk</SortTh>
                <SortTh sortKey="jtd_cost" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>JTD Cost</SortTh>
                <SortTh sortKey="wk_change" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Wk Chg</SortTh>
                <SortTh sortKey="committed_cost" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Committed</SortTh>
                <SortTh sortKey="projected_cost" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Projected</SortTh>
                <SortTh sortKey="remaining_spend" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Rem Spend</SortTh>
                <SortTh sortKey="variance" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>Variance</SortTh>
                <SortTh sortKey="percent_complete" currentSort={sortKey} sortDir={sortDir} onSort={handleSort}>% Comp</SortTh>
              </tr>
            </thead>
            <tbody>
              {processedRows.map((row: PhaseCodeDetailRow) => {
                const variance = Number(row.est_cost || 0) - Number(row.projected_cost || 0);
                const varianceColor = variance > 0 ? '#10b981' : variance < 0 ? '#ef4444' : undefined;
                const weeklyChange = Number(row.jtd_cost || 0) - Number(row.prior_week_cost || 0);
                const remainingSpend = Number(row.projected_cost || 0) - Number(row.committed_cost || 0) - Number(row.jtd_cost || 0);
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <Td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 500 }}>{row.phase}</Td>
                    <Td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.phase_description || '-'}</Td>
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
                    <Td align="right" style={{ fontWeight: 500, color: remainingSpend > 0 ? '#3b82f6' : remainingSpend < 0 ? '#ef4444' : undefined }}>
                      {fmt(remainingSpend)}
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
                {isLabor && <Td align="right">{fmtNum(totals.est_hours)}</Td>}
                {isLabor && <Td align="right">{fmtNum(totals.jtd_hours)}</Td>}
                <Td align="right">{fmt(totals.est_cost)}</Td>
                <Td align="right">{fmt(totals.prior_week_cost)}</Td>
                <Td align="right">{fmt(totals.jtd_cost)}</Td>
                <Td align="right" style={{ color: (totals.jtd_cost - totals.prior_week_cost) > 0 ? '#3b82f6' : undefined, fontWeight: 700 }}>
                  {fmt(totals.jtd_cost - totals.prior_week_cost)}
                </Td>
                <Td align="right">{fmt(totals.committed_cost)}</Td>
                <Td align="right" style={{ color: getVarianceColor(totals.projected_cost, totals.est_cost), fontWeight: 700 }}>
                  {fmt(totals.projected_cost)}
                </Td>
                <Td align="right" style={{ fontWeight: 700, color: totalRemainingSpend > 0 ? '#3b82f6' : totalRemainingSpend < 0 ? '#ef4444' : undefined }}>
                  {fmt(totalRemainingSpend)}
                </Td>
                <Td align="right" style={{ color: (totals.est_cost - totals.projected_cost) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                  {fmt(totals.est_cost - totals.projected_cost)}
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
  <div className="card" style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{label}</div>
    <div style={{ fontSize: '1rem', fontWeight: 700, color: color || '#1e293b' }}>{value}</div>
  </div>
);

const SortTh: React.FC<{
  children: React.ReactNode;
  sortKey: SortKey;
  currentSort: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right' | 'center';
  style?: React.CSSProperties;
}> = ({ children, sortKey, currentSort, sortDir, onSort, align = 'right', style }) => {
  const isActive = currentSort === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        textAlign: align,
        padding: '0.4rem 0.4rem',
        fontSize: '0.65rem',
        fontWeight: 600,
        color: isActive ? '#1e293b' : '#64748b',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
      <span style={{ marginLeft: '0.25rem', fontSize: '0.65rem', opacity: isActive ? 1 : 0.3 }}>
        {isActive ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25B2'}
      </span>
    </th>
  );
};

const Td: React.FC<{ children?: React.ReactNode; align?: 'left' | 'right' | 'center'; style?: React.CSSProperties }> = ({ children, align = 'left', style }) => (
  <td style={{ textAlign: align, padding: '0.35rem 0.4rem', ...style }}>
    {children || '-'}
  </td>
);

export default CostDrillIn;
