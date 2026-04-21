import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { buyoutMetricReportApi, BuyoutMetricProject } from '../../services/buyoutMetricReport';
import { teamsApi, Team } from '../../services/teams';
import SearchableSelect from '../../components/SearchableSelect';

import '../../styles/SalesPipeline.css';

const COST_TYPE_OPTIONS = [
  { value: 1, label: 'Labor' },
  { value: 2, label: 'Material' },
  { value: 3, label: 'Subcontracts' },
  { value: 4, label: 'Rentals' },
  { value: 5, label: 'MEP Equipment' },
  { value: 6, label: 'General Conditions' },
];

const DEFAULT_COST_TYPES = [3, 5]; // Subcontracts + MEP Equipment

const fmtCurrency = (v: number | undefined | null): string => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtPercent = (v: number | undefined | null): string => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Math.round(Number(v) * 100)}%`;
};

const fmtCompact = (v: number): string => {
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const KPI_STYLES = {
  blue:   { gradient: 'linear-gradient(135deg, #002356 0%, #004080 100%)', text: '#3b82f6' },
  purple: { gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', text: '#8b5cf6' },
  amber:  { gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', text: '#f59e0b' },
  green:  { gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', text: '#10b981' },
  cyan:   { gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', text: '#06b6d4' },
  rose:   { gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', text: '#f43f5e' },
  orange: { gradient: 'linear-gradient(135deg, #ea580c 0%, #F37B03 100%)', text: '#F37B03' },
};

interface KpiCardData {
  label: string;
  value: string;
  subValue?: string;
  style: { gradient: string; text: string };
  icon: React.ReactNode;
  hasBar?: boolean;
  barPct?: number;
}

const KpiCard: React.FC<{ card: KpiCardData }> = ({ card }) => (
  <div style={{
    background: '#ffffff',
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden',
  }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)';
    }}
  >
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
      background: card.style.gradient,
    }} />
    <div style={{
      width: '44px', height: '44px', borderRadius: '0.5rem',
      background: card.style.gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {card.icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.025em', marginBottom: '2px' }}>{card.label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#002356', lineHeight: 1.2 }}>
        {card.value}
        {card.subValue && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: card.style.text, marginLeft: '6px' }}>
            ({card.subValue})
          </span>
        )}
      </div>
      {card.hasBar && (
        <div style={{ marginTop: '6px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(card.barPct || 0, 100)}%`,
            background: card.style.gradient,
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}
    </div>
  </div>
);

const BuyoutMetricReport: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTeam = searchParams.get('team') || 'all';
  const initialMinPct = searchParams.get('min_percent_complete');

  // Cost type filter (multi-select)
  const [selectedCostTypes, setSelectedCostTypes] = useState<number[]>(DEFAULT_COST_TYPES);
  const [minPctComplete, setMinPctComplete] = useState<number>(initialMinPct !== null ? Number(initialMinPct) : 10);

  // Standard filters
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Open');
  const [pmFilter, setPmFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>(initialTeam);

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('buyout_remaining');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Build query params from cost type + min pct filters (server-side filters)
  const queryParams = useMemo(() => ({
    cost_types: selectedCostTypes,
    min_percent_complete: minPctComplete / 100, // convert to decimal
  }), [selectedCostTypes, minPctComplete]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['buyoutMetricReport', queryParams],
    queryFn: () => buyoutMetricReportApi.getData(queryParams),
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await teamsApi.getAll();
      return response.data.data || [];
    },
  });

  const { data: teamMembersResponse } = useQuery({
    queryKey: ['teamMembers', teamFilter],
    queryFn: () => teamsApi.getMembers(Number(teamFilter)),
    enabled: teamFilter !== 'all',
  });
  const teamEmployeeIds: number[] = useMemo(() => {
    if (teamFilter === 'all' || !teamMembersResponse?.data?.data) return [];
    return teamMembersResponse.data.data.map((m: any) => Number(m.employee_id));
  }, [teamFilter, teamMembersResponse]);

  // Derive unique filter options
  const uniqueStatuses = useMemo(() =>
    [...new Set(projects.map(p => p.status).filter(Boolean))].sort(),
    [projects]
  );
  const uniquePMs = useMemo(() =>
    [...new Set(projects.map(p => p.manager_name).filter(Boolean))].sort() as string[],
    [projects]
  );
  const uniqueDepartments = useMemo(() =>
    [...new Set(projects.map(p => p.department_number).filter(Boolean))].sort() as string[],
    [projects]
  );
  const uniqueMarkets = useMemo(() =>
    [...new Set(projects.map(p => p.market).filter(Boolean))].sort() as string[],
    [projects]
  );

  // Client-side filters — stage 1: everything except project search (for dynamic project dropdown)
  const baseFilteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (pmFilter !== 'all' && p.manager_name !== pmFilter) return false;
      if (departmentFilter !== 'all' && p.department_number !== departmentFilter) return false;
      if (marketFilter !== 'all' && p.market !== marketFilter) return false;
      if (teamFilter !== 'all' && teamEmployeeIds.length > 0 && !teamEmployeeIds.includes(Number(p.manager_id))) return false;
      return true;
    });
  }, [projects, statusFilter, pmFilter, departmentFilter, marketFilter, teamFilter, teamEmployeeIds]);

  // Dynamic project list for dropdown (derived from base-filtered data)
  const uniqueProjects = useMemo(() => {
    const seen = new Map<number, { id: number; number: string; name: string }>();
    for (const p of baseFilteredProjects) {
      if (!seen.has(p.id)) seen.set(p.id, { id: p.id, number: p.number, name: p.name });
    }
    return [...seen.values()].sort((a, b) => a.number.localeCompare(b.number));
  }, [baseFilteredProjects]);

  // Stage 2: apply project filter
  const filteredProjects = useMemo(() => {
    if (!projectFilter) return baseFilteredProjects;
    const pid = Number(projectFilter);
    return baseFilteredProjects.filter(p => p.id === pid);
  }, [baseFilteredProjects, projectFilter]);

  // Sort
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'number':
          aVal = a.number?.toLowerCase() ?? '';
          bVal = b.number?.toLowerCase() ?? '';
          break;
        case 'name':
          aVal = a.name?.toLowerCase() ?? '';
          bVal = b.name?.toLowerCase() ?? '';
          break;
        case 'manager':
          aVal = a.manager_name?.toLowerCase() ?? '';
          bVal = b.manager_name?.toLowerCase() ?? '';
          break;
        case 'phase':
          aVal = a.phase?.toLowerCase() ?? '';
          bVal = b.phase?.toLowerCase() ?? '';
          break;
        case 'percent_complete':
          aVal = Number(a.percent_complete) || 0;
          bVal = Number(b.percent_complete) || 0;
          break;
        case 'est_cost':
          aVal = a.est_cost || 0;
          bVal = b.est_cost || 0;
          break;
        case 'jtd_cost':
          aVal = a.jtd_cost || 0;
          bVal = b.jtd_cost || 0;
          break;
        case 'committed_cost':
          aVal = a.committed_cost || 0;
          bVal = b.committed_cost || 0;
          break;
        case 'projected_cost':
          aVal = a.projected_cost || 0;
          bVal = b.projected_cost || 0;
          break;
        case 'buyout_remaining':
          aVal = a.buyout_remaining || 0;
          bVal = b.buyout_remaining || 0;
          break;
        case 'buyout_pct':
          aVal = a.est_cost > 0 ? a.committed_cost / a.est_cost : 0;
          bVal = b.est_cost > 0 ? b.committed_cost / b.est_cost : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  // KPIs
  const kpis = useMemo(() => {
    const totalEst = filteredProjects.reduce((s, p) => s + p.est_cost, 0);
    const totalJtd = filteredProjects.reduce((s, p) => s + p.jtd_cost, 0);
    const totalCommitted = filteredProjects.reduce((s, p) => s + p.committed_cost, 0);
    const totalProjected = filteredProjects.reduce((s, p) => s + p.projected_cost, 0);
    const totalBuyoutRemaining = filteredProjects.reduce((s, p) => s + p.buyout_remaining, 0);
    const overallBuyoutPct = totalEst > 0 ? (totalCommitted / totalEst) * 100 : 0;
    const uniqueProjectCount = new Set(filteredProjects.map(p => p.id)).size;

    return {
      count: uniqueProjectCount,
      totalEst,
      totalJtd,
      totalCommitted,
      totalProjected,
      totalBuyoutRemaining,
      overallBuyoutPct,
    };
  }, [filteredProjects]);

  // Footer totals
  const footerTotals = useMemo(() => {
    const totalEst = sortedProjects.reduce((s, p) => s + p.est_cost, 0);
    const totalJtd = sortedProjects.reduce((s, p) => s + p.jtd_cost, 0);
    const totalCommitted = sortedProjects.reduce((s, p) => s + p.committed_cost, 0);
    const totalProjected = sortedProjects.reduce((s, p) => s + p.projected_cost, 0);
    const totalBuyoutRemaining = sortedProjects.reduce((s, p) => s + p.buyout_remaining, 0);

    // Weighted % complete (weighted by projected cost)
    const pctNumerator = sortedProjects.reduce((s, p) => {
      const pc = Number(p.percent_complete) || 0;
      const proj = p.projected_cost || 0;
      return s + pc * proj;
    }, 0);
    const weightedPct = totalProjected > 0 ? pctNumerator / totalProjected : 0;

    return { totalEst, totalJtd, totalCommitted, totalProjected, totalBuyoutRemaining, weightedPct };
  }, [sortedProjects]);

  const toggleCostType = useCallback((ct: number) => {
    setSelectedCostTypes(prev => {
      if (prev.includes(ct)) {
        if (prev.length === 1) return prev; // Don't allow empty selection
        return prev.filter(x => x !== ct);
      }
      return [...prev, ct].sort();
    });
  }, []);

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleExportPdf = async () => {
    setPdfLoading(true);
    try {
      await buyoutMetricReportApi.downloadPdf({
        cost_types: selectedCostTypes,
        min_percent_complete: minPctComplete / 100,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        pm: pmFilter !== 'all' ? pmFilter : undefined,
        department: departmentFilter !== 'all' ? departmentFilter : undefined,
        market: marketFilter !== 'all' ? marketFilter : undefined,
        search: undefined,
        team: teamFilter !== 'all' ? teamFilter : undefined,
      });
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const anyFilterActive = statusFilter !== 'all' || pmFilter !== 'all' || !!projectFilter ||
    departmentFilter !== 'all' || marketFilter !== 'all' || teamFilter !== 'all' ||
    JSON.stringify(selectedCostTypes) !== JSON.stringify(DEFAULT_COST_TYPES) || minPctComplete !== 10;

  const clearAllFilters = () => {
    setSelectedCostTypes(DEFAULT_COST_TYPES);
    setMinPctComplete(10);
    setStatusFilter('all');
    setPmFilter('all');
    setProjectFilter('');
    setDepartmentFilter('all');
    setMarketFilter('all');
    setTeamFilter('all');
  };

  const sortIcon = (col: string) =>
    sortColumn === col ? (sortDirection === 'asc' ? ' \u2191' : ' \u2193') : ' \u2195';

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            borderRadius: '50%', border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading buyout metric data...</div>
        </div>
      </div>
    );
  }

  const costTypeLabel = selectedCostTypes
    .map(ct => COST_TYPE_OPTIONS.find(o => o.value === ct)?.label)
    .filter(Boolean)
    .join(', ');

  const kpiCards: KpiCardData[] = [
    {
      label: 'Projects',
      value: kpis.count.toLocaleString(),
      style: KPI_STYLES.blue,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      label: 'Estimated Cost',
      value: fmtCompact(kpis.totalEst),
      style: KPI_STYLES.blue,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: 'Projected Cost',
      value: fmtCompact(kpis.totalProjected),
      style: KPI_STYLES.cyan,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      label: 'JTD Cost',
      value: fmtCompact(kpis.totalJtd),
      style: KPI_STYLES.orange,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>,
    },
    {
      label: 'Committed Cost',
      value: fmtCompact(kpis.totalCommitted),
      subValue: `${Math.round(kpis.overallBuyoutPct)}% bought out`,
      style: KPI_STYLES.purple,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
      hasBar: true,
      barPct: kpis.overallBuyoutPct,
    },
    {
      label: 'Buyout Remaining',
      value: fmtCompact(kpis.totalBuyoutRemaining),
      style: kpis.totalBuyoutRemaining >= 0 ? KPI_STYLES.amber : KPI_STYLES.rose,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    },
  ];

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header" style={{ position: 'relative' }}>
        <div className="sales-page-title">
          <div>
            <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Dashboard
            </Link>
            <h1 style={{
              background: 'linear-gradient(135deg, #002356, #004080)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Buyout Metric</h1>
            <div className="sales-subtitle">
              Project buyout status by cost type — {costTypeLabel}
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary" onClick={handleExportPdf} disabled={pdfLoading}>
            {pdfLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            {pdfLoading ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        {kpiCards.map(card => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '1rem',
        alignItems: 'flex-end',
        border: '1px solid #e5e7eb',
      }}>
        {/* Cost Type checkboxes */}
        <div style={{ minWidth: '280px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Cost Types</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {COST_TYPE_OPTIONS.map(ct => (
              <label
                key={ct.value}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer', userSelect: 'none',
                  background: selectedCostTypes.includes(ct.value) ? '#002356' : '#e5e7eb',
                  color: selectedCostTypes.includes(ct.value) ? '#fff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedCostTypes.includes(ct.value)}
                  onChange={() => toggleCostType(ct.value)}
                  style={{ display: 'none' }}
                />
                {ct.label}
              </label>
            ))}
          </div>
        </div>

        {/* Min % Complete */}
        <div style={{ minWidth: '120px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Min % Complete</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              value={minPctComplete}
              onChange={(e) => setMinPctComplete(Number(e.target.value) || 0)}
              className="form-input"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '80px', textAlign: 'right' }}
            />
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>%</span>
          </div>
        </div>

        {/* Project search / select */}
        <div style={{ flex: '1', minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Project</label>
          <SearchableSelect
            options={uniqueProjects.map(proj => ({
              value: proj.id.toString(),
              label: `${proj.number} - ${proj.name}`,
            }))}
            value={projectFilter}
            onChange={setProjectFilter}
            placeholder="All Projects"
          />
        </div>

        {/* Status */}
        <div style={{ minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Status</label>
          <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* PM */}
        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Project Manager</label>
          <input
            className="form-input"
            list="buyout-pm-list"
            placeholder="All PMs"
            value={pmFilter === 'all' ? '' : pmFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) setPmFilter('all');
              else setPmFilter(val);
            }}
            onBlur={(e) => {
              const val = e.target.value;
              if (!val) setPmFilter('all');
              else if (!uniquePMs.includes(val)) setPmFilter('all');
            }}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}
          />
          <datalist id="buyout-pm-list">
            {uniquePMs.map(pm => <option key={pm} value={pm} />)}
          </datalist>
        </div>

        {/* Team */}
        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Team</label>
          <select className="form-input" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Department */}
        <div style={{ minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Department</label>
          <select className="form-input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Depts</option>
            {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Market */}
        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Market</label>
          <select className="form-input" value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Markets</option>
            {uniqueMarkets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {anyFilterActive && (
          <button className="sales-filter-btn" onClick={clearAllFilters} style={{ padding: '0.5rem 1rem', height: 'fit-content' }}>
            Clear All
          </button>
        )}
      </div>

      {/* Table */}
      <div className="sales-table-section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #002356, #3b82f6, #8b5cf6)',
        }} />
        <div className="sales-table-header" style={{ paddingTop: '0.75rem' }}>
          <div className="sales-table-title">
            Buyout Detail
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({filteredProjects.length.toLocaleString()} of {projects.length.toLocaleString()} phases)
            </span>
          </div>
        </div>
        <table className="sales-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '6%' }} />      {/* # */}
            <col style={{ width: '17%' }} />     {/* Project */}
            <col style={{ width: '11%' }} />     {/* PM */}
            <col style={{ width: '12%' }} />     {/* Phase */}
            <col style={{ width: '5%' }} />      {/* % Comp */}
            <col style={{ width: '8.5%' }} />    {/* Est Cost */}
            <col style={{ width: '8.5%' }} />    {/* JTD Cost */}
            <col style={{ width: '8.5%' }} />    {/* Committed */}
            <col style={{ width: '8.5%' }} />    {/* Projected */}
            <col style={{ width: '8.5%' }} />    {/* Buyout Rem */}
            <col style={{ width: '6%' }} />      {/* Buyout % */}
          </colgroup>
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('number')}>#{sortIcon('number')}</th>
              <th className="sales-sortable" onClick={() => handleSort('name')}>Project{sortIcon('name')}</th>
              <th className="sales-sortable" onClick={() => handleSort('manager')}>PM{sortIcon('manager')}</th>
              <th className="sales-sortable" onClick={() => handleSort('phase')}>Phase{sortIcon('phase')}</th>
              <th className="sales-sortable" onClick={() => handleSort('percent_complete')} style={{ textAlign: 'right' }}>% Comp{sortIcon('percent_complete')}</th>
              <th className="sales-sortable" onClick={() => handleSort('est_cost')} style={{ textAlign: 'right' }}>Est Cost{sortIcon('est_cost')}</th>
              <th className="sales-sortable" onClick={() => handleSort('jtd_cost')} style={{ textAlign: 'right' }}>JTD Cost{sortIcon('jtd_cost')}</th>
              <th className="sales-sortable" onClick={() => handleSort('committed_cost')} style={{ textAlign: 'right' }}>Committed{sortIcon('committed_cost')}</th>
              <th className="sales-sortable" onClick={() => handleSort('projected_cost')} style={{ textAlign: 'right' }}>Projected{sortIcon('projected_cost')}</th>
              <th className="sales-sortable" onClick={() => handleSort('buyout_remaining')} style={{ textAlign: 'right' }}>Buyout Rem{sortIcon('buyout_remaining')}</th>
              <th className="sales-sortable" onClick={() => handleSort('buyout_pct')} style={{ textAlign: 'right' }}>Buyout %{sortIcon('buyout_pct')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.length > 0 ? (
              sortedProjects.map((p, idx) => {
                const pctComplete = Number(p.percent_complete) || 0;
                const pctDisplay = Math.round(pctComplete * 100);
                const buyoutPct = p.est_cost > 0 ? Math.round((p.committed_cost / p.est_cost) * 100) : 0;
                const br = p.buyout_remaining;

                return (
                  <tr key={`${p.id}-${p.phase}-${idx}`} onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500, color: '#475569' }}>{p.number}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customer_name || '-'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: p.manager_name
                            ? `hsl(${[...p.manager_name].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % 360}, 60%, 55%)`
                            : '#94a3b8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                          {p.manager_name ? p.manager_name.split(' ').map(n => n[0]).join('') : '?'}
                        </div>
                        <span style={{ fontSize: '0.8125rem' }}>{p.manager_name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.8125rem' }}>{p.phase}</div>
                        {p.phase_description && (
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.phase_description}</div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.percent_complete !== null ? (
                        <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{pctDisplay}%</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCurrency(p.est_cost)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.jtd_cost)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.committed_cost)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.projected_cost)}</td>
                    <td style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: br > 0 ? '#d97706' : br < 0 ? '#dc2626' : '#059669',
                    }}>
                      {fmtCurrency(br)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{buyoutPct}%</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px', border: 'none' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No projects found</h3>
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    {anyFilterActive ? 'Try adjusting your search or filters' : 'No buyout data available for selected cost types'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
          {sortedProjects.length > 0 && (
            <tfoot>
              <tr style={{
                background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                fontWeight: 700,
                borderTop: '2px solid #cbd5e1',
                position: 'sticky',
                bottom: 0,
              }}>
                <td colSpan={4} style={{ textAlign: 'right', color: '#334155' }}>
                  Totals ({new Set(sortedProjects.map(p => p.id)).size.toLocaleString()} project{new Set(sortedProjects.map(p => p.id)).size !== 1 ? 's' : ''}, {sortedProjects.length.toLocaleString()} phase{sortedProjects.length !== 1 ? 's' : ''}):
                </td>
                <td style={{ textAlign: 'right', color: '#334155' }}>{fmtPercent(footerTotals.weightedPct)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.totalEst)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.totalJtd)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.totalCommitted)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.totalProjected)}</td>
                <td style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  color: footerTotals.totalBuyoutRemaining > 0 ? '#d97706'
                    : footerTotals.totalBuyoutRemaining < 0 ? '#dc2626' : '#059669',
                }}>
                  {fmtCurrency(footerTotals.totalBuyoutRemaining)}
                </td>
                <td style={{ textAlign: 'right', color: '#334155' }}>
                  {footerTotals.totalEst > 0 ? `${Math.round((footerTotals.totalCommitted / footerTotals.totalEst) * 100)}%` : '-'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default BuyoutMetricReport;
