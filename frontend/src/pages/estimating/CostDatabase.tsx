import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  costDatabaseService,
  estimateDbService,
  CostDbFilters,
  EstDbFilters,
  COST_TYPE_LABELS,
  PhaseRow,
  PhaseProjectRow,
  ProjectRow,
  EstSectionRow,
  EstimateListRow,
} from '../../services/costDatabase';
import '../../styles/SalesPipeline.css';

const fmt = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
};

const fmtNum = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const fmtPct = (value: number | null | undefined): string => {
  if (value == null) return '-';
  return `${(value * 100).toFixed(1)}%`;
};

type DataSource = 'vista' | 'estimates';
type Tab = 'cost-type' | 'phase' | 'projects';

type PhaseRowEnriched = PhaseRow & {
  avg_est_cost: number;
  avg_jtd_cost: number;
  avg_committed_cost: number;
  avg_projected_cost: number;
  avg_est_hours: number;
  avg_jtd_hours: number;
  pct_of_total: number;
};

const safeAvg = (sum: number, count: number) => (count > 0 ? sum / count : 0);

const CostDatabase: React.FC = () => {
  const [dataSource, setDataSource] = useState<DataSource>('vista');

  // Vista state
  const [filters, setFilters] = useState<CostDbFilters>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<Tab>('cost-type');
  const [drillPhase, setDrillPhase] = useState<{ phase: string; cost_type: number } | null>(null);
  const [search, setSearch] = useState('');

  // Estimates state
  const [estFilters, setEstFilters] = useState<EstDbFilters>({});
  const [estExcluded, setEstExcluded] = useState<Set<number>>(new Set());
  const [estTab, setEstTab] = useState<'cost-type' | 'section' | 'list'>('cost-type');
  const [estSearch, setEstSearch] = useState('');

  // Filters with exclusions applied — used for all aggregations.
  const aggFilters = useMemo<CostDbFilters>(
    () => ({ ...filters, excluded_project_ids: excluded.size ? Array.from(excluded) : undefined }),
    [filters, excluded]
  );

  const toggleExcluded = (projectId: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };
  const [phaseSort, setPhaseSort] = useState<{ key: keyof PhaseRowEnriched; dir: 'asc' | 'desc' }>({
    key: 'avg_jtd_cost', dir: 'desc',
  });

  const { data: opts } = useQuery({
    queryKey: ['costDb', 'filters'],
    queryFn: () => costDatabaseService.getFilters(),
  });

  const { data: summary } = useQuery({
    queryKey: ['costDb', 'summary', aggFilters],
    queryFn: () => costDatabaseService.getSummary(aggFilters),
  });

  const { data: byCostType, isLoading: ctLoading } = useQuery({
    queryKey: ['costDb', 'by-cost-type', aggFilters],
    queryFn: () => costDatabaseService.getByCostType(aggFilters),
  });

  const { data: byPhase, isLoading: phaseLoading } = useQuery({
    queryKey: ['costDb', 'by-phase', aggFilters],
    queryFn: () => costDatabaseService.getByPhase(aggFilters),
    enabled: tab === 'phase',
  });

  // Source-project list uses the *base* filters (no exclusion) so users can see
  // and re-include excluded projects.
  const { data: projects, isLoading: projLoading } = useQuery({
    queryKey: ['costDb', 'projects', filters],
    queryFn: () => costDatabaseService.getProjects(filters),
  });

  const { data: drillRows, isLoading: drillLoading } = useQuery({
    queryKey: ['costDb', 'phase-projects', drillPhase, aggFilters],
    queryFn: () => drillPhase
      ? costDatabaseService.getPhaseProjects(drillPhase.phase, { ...aggFilters, cost_type: drillPhase.cost_type })
      : Promise.resolve([] as PhaseProjectRow[]),
    enabled: !!drillPhase,
  });

  // Estimates queries
  const estAggFilters = useMemo<EstDbFilters>(
    () => ({ ...estFilters, excluded_estimate_ids: estExcluded.size ? Array.from(estExcluded) : undefined }),
    [estFilters, estExcluded]
  );

  const { data: estOpts } = useQuery({
    queryKey: ['estDb', 'filters'],
    queryFn: () => estimateDbService.getFilters(),
    enabled: dataSource === 'estimates',
  });

  const { data: estSummary } = useQuery({
    queryKey: ['estDb', 'summary', estAggFilters],
    queryFn: () => estimateDbService.getSummary(estAggFilters),
    enabled: dataSource === 'estimates',
  });

  const { data: estByCostType, isLoading: estCtLoading } = useQuery({
    queryKey: ['estDb', 'by-cost-type', estAggFilters],
    queryFn: () => estimateDbService.getByCostType(estAggFilters),
    enabled: dataSource === 'estimates',
  });

  const { data: estBySection, isLoading: estSectionLoading } = useQuery({
    queryKey: ['estDb', 'by-section', estAggFilters],
    queryFn: () => estimateDbService.getBySection(estAggFilters),
    enabled: dataSource === 'estimates' && estTab === 'section',
  });

  const { data: estList, isLoading: estListLoading } = useQuery({
    queryKey: ['estDb', 'list', estFilters],
    queryFn: () => estimateDbService.getList(estFilters),
    enabled: dataSource === 'estimates',
  });

  const setEstFilter = <K extends keyof EstDbFilters>(key: K, value: EstDbFilters[K]) => {
    setEstFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleEstListFilter = (key: 'status' | 'market', value: string) => {
    setEstFilters(prev => {
      const list = prev[key] || [];
      const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
      return { ...prev, [key]: next.length ? next : undefined };
    });
  };

  const toggleEstExcluded = (id: number) => {
    setEstExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearEstFilters = () => { setEstFilters({}); setEstSearch(''); };

  const estActiveFilterCount = useMemo(() => {
    let n = 0;
    if (estFilters.status?.length) n++;
    if (estFilters.estimator_id?.length) n++;
    if (estFilters.market?.length) n++;
    if (estFilters.date_from || estFilters.date_to) n++;
    if (estFilters.value_min != null || estFilters.value_max != null) n++;
    return n;
  }, [estFilters]);

  const filteredEstSections = useMemo<EstSectionRow[]>(() => {
    if (!estBySection) return [];
    if (!estSearch.trim()) return estBySection;
    const q = estSearch.toLowerCase();
    return estBySection.filter(r => r.section_name.toLowerCase().includes(q));
  }, [estBySection, estSearch]);

  const filteredEstList = useMemo<EstimateListRow[]>(() => {
    if (!estList) return [];
    if (!estSearch.trim()) return estList;
    const q = estSearch.toLowerCase();
    return estList.filter(r =>
      r.estimate_number.toLowerCase().includes(q) ||
      r.project_name.toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q)
    );
  }, [estList, estSearch]);

  const setFilter = <K extends keyof CostDbFilters>(key: K, value: CostDbFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleListFilter = (key: 'status' | 'department' | 'market', value: string) => {
    setFilters(prev => {
      const list = prev[key] || [];
      const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
      return { ...prev, [key]: next.length ? next : undefined };
    });
  };

  const clearFilters = () => { setFilters({}); setSearch(''); };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status?.length) n++;
    if (filters.department?.length) n++;
    if (filters.market?.length) n++;
    if (filters.manager_id?.length) n++;
    if (filters.date_from || filters.date_to) n++;
    if (filters.value_min != null || filters.value_max != null) n++;
    return n;
  }, [filters]);

  const filteredPhases = useMemo<PhaseRowEnriched[]>(() => {
    if (!byPhase) return [];
    let rows = byPhase;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.phase.toLowerCase().includes(q) ||
        (r.phase_description || '').toLowerCase().includes(q)
      );
    }
    const total = rows.reduce((s, r) => s + r.projected_cost, 0);
    const enriched: PhaseRowEnriched[] = rows.map(r => ({
      ...r,
      avg_est_cost: safeAvg(r.est_cost, r.project_count),
      avg_jtd_cost: safeAvg(r.jtd_cost, r.project_count),
      avg_committed_cost: safeAvg(r.committed_cost, r.project_count),
      avg_projected_cost: safeAvg(r.projected_cost, r.project_count),
      avg_est_hours: safeAvg(r.est_hours, r.project_count),
      avg_jtd_hours: safeAvg(r.jtd_hours, r.project_count),
      pct_of_total: total > 0 ? r.projected_cost / total : 0,
    }));
    const { key, dir } = phaseSort;
    enriched.sort((a, b) => {
      const av = a[key]; const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av || 0); const bn = Number(bv || 0);
      return dir === 'asc' ? an - bn : bn - an;
    });
    return enriched;
  }, [byPhase, search, phaseSort]);

  const togglePhaseSort = (key: keyof PhaseRowEnriched) => {
    setPhaseSort(p => p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  return (
    <div style={{ padding: '1rem 1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <Link to="/estimating" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
          &larr; Back to Estimating
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.15rem' }}>
              📊 Cost Database
            </h1>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {dataSource === 'vista'
                ? 'Historical cost data aggregated from project phase codes'
                : 'Aggregated cost data from estimates'}
            </div>
          </div>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '3px', gap: '2px' }}>
            <SourceBtn active={dataSource === 'vista'} onClick={() => setDataSource('vista')}>Vista Projects</SourceBtn>
            <SourceBtn active={dataSource === 'estimates'} onClick={() => setDataSource('estimates')}>Estimates</SourceBtn>
          </div>
        </div>
      </div>

      {dataSource === 'vista' && (<>

      {/* Filters panel */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Filters {activeFilterCount > 0 && <span style={{ marginLeft: '0.4rem', background: '#3b82f6', color: '#fff', padding: '0.05rem 0.4rem', borderRadius: '8px', fontSize: '0.7rem' }}>{activeFilterCount}</span>}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }}>
              Clear all
            </button>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: '0.75rem 1rem',
        }}>
          {/* Status — wider basis so 3 chips fit on one line */}
          <div style={{ flex: '1 1 240px' }}>
            <Label>Status</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {opts?.statuses.map(s => (
                <Chip key={s} active={filters.status?.includes(s) ?? false}
                  onClick={() => toggleListFilter('status', s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          {/* Department */}
          <div style={{ flex: '1 1 150px' }}>
            <Label>Department</Label>
            <MultiSelect
              options={opts?.departments.map(d => ({ value: d.number, label: `${d.number} — ${d.name}` })) || []}
              selected={filters.department || []}
              onChange={next => setFilter('department', next.length ? next : undefined)}
              placeholder="All departments"
            />
          </div>

          {/* Market */}
          <div style={{ flex: '1 1 150px' }}>
            <Label>Market</Label>
            <MultiSelect
              options={(opts?.markets || []).map(m => ({ value: m, label: m }))}
              selected={filters.market || []}
              onChange={next => setFilter('market', next.length ? next : undefined)}
              placeholder="All markets"
            />
          </div>

          {/* Manager */}
          <div style={{ flex: '1 1 170px' }}>
            <Label>Project Manager</Label>
            <MultiSelect
              options={(opts?.managers || []).map(m => ({ value: String(m.id), label: m.name }))}
              selected={(filters.manager_id || []).map(String)}
              onChange={next => setFilter('manager_id', next.length ? next.map(v => parseInt(v, 10)) : undefined)}
              placeholder="All managers"
            />
          </div>

          {/* Project Date Range (overlap) */}
          <div style={{ flex: '0 0 260px' }}>
            <Label>Project Date Range</Label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <input type="date" value={filters.date_from || ''}
                onChange={e => setFilter('date_from', e.target.value || undefined)}
                style={inputStyle} />
              <input type="date" value={filters.date_to || ''}
                onChange={e => setFilter('date_to', e.target.value || undefined)}
                style={inputStyle} />
            </div>
            {opts?.dateRange.minStart && opts?.dateRange.maxEnd && (() => {
              const minMs = new Date(opts.dateRange.minStart).getTime();
              const maxMs = new Date(opts.dateRange.maxEnd!).getTime();
              const lowMs = filters.date_from ? new Date(filters.date_from).getTime() : minMs;
              const highMs = filters.date_to ? new Date(filters.date_to).getTime() : maxMs;
              return (
                <DualRangeSlider
                  min={minMs} max={maxMs} step={86_400_000}
                  low={lowMs} high={highMs}
                  onChange={(lo, hi) => setFilters(prev => ({
                    ...prev,
                    date_from: lo === minMs ? undefined : new Date(lo).toISOString().slice(0, 10),
                    date_to: hi === maxMs ? undefined : new Date(hi).toISOString().slice(0, 10),
                  }))}
                  formatValue={ms => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                />
              );
            })()}
          </div>

          {/* Contract value range */}
          <div style={{ flex: '0 0 260px' }}>
            <Label>Contract Value</Label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <CurrencyInput placeholder="Min" value={filters.value_min}
                onChange={v => setFilter('value_min', v)} style={inputStyle} />
              <CurrencyInput placeholder="Max" value={filters.value_max}
                onChange={v => setFilter('value_max', v)} style={inputStyle} />
            </div>
            {opts?.valueRange.min != null && opts?.valueRange.max != null && opts.valueRange.max > opts.valueRange.min && (() => {
              const minV = Math.floor(opts.valueRange.min!);
              const maxV = Math.ceil(opts.valueRange.max!);
              const lowV = filters.value_min != null ? filters.value_min : minV;
              const highV = filters.value_max != null ? filters.value_max : maxV;
              const step = Math.max(1000, Math.round((maxV - minV) / 1000));
              return (
                <DualRangeSlider
                  min={minV} max={maxV} step={step}
                  low={lowV} high={highV}
                  onChange={(lo, hi) => setFilters(prev => ({
                    ...prev,
                    value_min: lo === minV ? null : lo,
                    value_max: hi === maxV ? null : hi,
                  }))}
                  formatValue={v => fmt(v)}
                />
              );
            })()}
          </div>
        </div>
      </div>

      {/* Summary cards — per-project averages (project count stays a count) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
        <Card label="Projects" value={fmtNum(summary?.project_count)} color="#3b82f6" />
        <Card label="Avg Contract Value" value={fmt(safeAvg(summary?.contract_value_total || 0, summary?.project_count || 0))} color="#0ea5e9" />
        <Card label="Avg Est Cost" value={fmt(safeAvg(summary?.est_cost || 0, summary?.project_count || 0))} color="#8b5cf6" />
        <Card label="Avg JTD Cost" value={fmt(safeAvg(summary?.jtd_cost || 0, summary?.project_count || 0))} color="#f59e0b" />
        <Card label="Avg Committed" value={fmt(safeAvg(summary?.committed_cost || 0, summary?.project_count || 0))} color="#6366f1" />
        <Card label="Avg Projected" value={fmt(safeAvg(summary?.projected_cost || 0, summary?.project_count || 0))} color="#10b981" />
        <Card label="Avg Est Hours" value={fmtNum(safeAvg(summary?.est_hours || 0, summary?.project_count || 0))} color="#64748b" />
        <Card label="Avg JTD Hours" value={fmtNum(safeAvg(summary?.jtd_hours || 0, summary?.project_count || 0))} color="#64748b" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
        <TabBtn active={tab === 'cost-type'} onClick={() => setTab('cost-type')}>By Cost Type</TabBtn>
        <TabBtn active={tab === 'phase'} onClick={() => setTab('phase')}>By Phase Code</TabBtn>
        <TabBtn active={tab === 'projects'} onClick={() => setTab('projects')}>Source Projects</TabBtn>
      </div>

      {/* Tab content */}
      {tab === 'cost-type' && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {ctLoading ? <Loading /> : !byCostType?.length ? (
            <Empty>
              {summary && summary.project_count > 0
                ? `${summary.project_count} project${summary.project_count === 1 ? '' : 's'} match your filters, but no Vista phase code data is linked to them.`
                : 'No projects match your filters.'}
            </Empty>
          ) : (() => {
            const ctTotal = byCostType.reduce((s, r) => s + r.projected_cost, 0);
            return (
              <table style={tableStyle}>
                <thead><tr style={theadRow}>
                  <Th align="left">Cost Type</Th>
                  <Th>Projects</Th><Th>Phases</Th>
                  <Th>Avg Est Cost</Th><Th>Avg JTD Cost</Th>
                  <Th>Avg Committed</Th><Th>Avg Projected</Th>
                  <Th>Avg Est Hrs</Th><Th>Avg JTD Hrs</Th>
                  <Th>Variance %</Th>
                  <Th>% of Total</Th>
                </tr></thead>
                <tbody>
                  {byCostType.map(r => {
                    const variancePct = r.est_cost > 0 ? (r.projected_cost - r.est_cost) / r.est_cost : null;
                    const pct = ctTotal > 0 ? r.projected_cost / ctTotal : 0;
                    return (
                      <tr key={r.cost_type} style={tbodyRow}
                        onClick={() => { setFilter('cost_type', r.cost_type); setTab('phase'); }}>
                        <Td style={{ fontWeight: 600 }}>{COST_TYPE_LABELS[r.cost_type] || `Type ${r.cost_type}`}</Td>
                        <Td align="right">{fmtNum(r.project_count)}</Td>
                        <Td align="right">{fmtNum(r.phase_count)}</Td>
                        <Td align="right">{fmt(safeAvg(r.est_cost, r.project_count))}</Td>
                        <Td align="right">{fmt(safeAvg(r.jtd_cost, r.project_count))}</Td>
                        <Td align="right">{fmt(safeAvg(r.committed_cost, r.project_count))}</Td>
                        <Td align="right">{fmt(safeAvg(r.projected_cost, r.project_count))}</Td>
                        <Td align="right">{fmtNum(safeAvg(r.est_hours, r.project_count))}</Td>
                        <Td align="right">{fmtNum(safeAvg(r.jtd_hours, r.project_count))}</Td>
                        <Td align="right" style={{ color: variancePct == null ? undefined : variancePct > 0.05 ? '#ef4444' : variancePct < -0.05 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                          {variancePct == null ? '-' : `${(variancePct * 100).toFixed(1)}%`}
                        </Td>
                        <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>{(pct * 100).toFixed(1)}%</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {/* Source projects under the cost-type table — exclude checkboxes feed back into all aggregations */}
      {tab === 'cost-type' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0 0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Source Projects</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Uncheck any project to exclude it from the aggregations above.
                {excluded.size > 0 && <> <span style={{ color: '#ef4444', fontWeight: 600 }}>{excluded.size} excluded</span></>}
              </div>
            </div>
            {excluded.size > 0 && (
              <button onClick={() => setExcluded(new Set())}
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }}>
                Re-include all
              </button>
            )}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <SourceProjectsTable
              projects={projects || []}
              excluded={excluded}
              onToggle={toggleExcluded}
              loading={projLoading}
            />
          </div>
        </>
      )}

      {tab === 'phase' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Search phase or description..."
              value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: '300px' }} />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cost Type:</span>
            <Chip active={!filters.cost_type} onClick={() => setFilter('cost_type', undefined)}>All</Chip>
            {[1, 2, 3, 4, 5, 6].map(ct => (
              <Chip key={ct} active={filters.cost_type === ct} onClick={() => setFilter('cost_type', ct)}>
                {COST_TYPE_LABELS[ct]}
              </Chip>
            ))}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            {phaseLoading ? <Loading /> : !filteredPhases.length ? (
              <Empty>
                {summary && summary.project_count > 0
                  ? `${summary.project_count} project${summary.project_count === 1 ? '' : 's'} match your filters, but no Vista phase code data is linked to them.`
                  : 'No phase codes match your filters.'}
              </Empty>
            ) : (
              <table style={tableStyle}>
                <thead><tr style={theadRow}>
                  <SortHeader k="phase" sort={phaseSort} onSort={togglePhaseSort} align="left">Phase</SortHeader>
                  <SortHeader k="phase_description" sort={phaseSort} onSort={togglePhaseSort} align="left">Description</SortHeader>
                  <SortHeader k="cost_type" sort={phaseSort} onSort={togglePhaseSort}>Cost Type</SortHeader>
                  <SortHeader k="project_count" sort={phaseSort} onSort={togglePhaseSort}>Projects</SortHeader>
                  <SortHeader k="avg_est_cost" sort={phaseSort} onSort={togglePhaseSort}>Avg Est Cost</SortHeader>
                  <SortHeader k="avg_jtd_cost" sort={phaseSort} onSort={togglePhaseSort}>Avg JTD Cost</SortHeader>
                  <SortHeader k="avg_committed_cost" sort={phaseSort} onSort={togglePhaseSort}>Avg Committed</SortHeader>
                  <SortHeader k="avg_projected_cost" sort={phaseSort} onSort={togglePhaseSort}>Avg Projected</SortHeader>
                  <SortHeader k="avg_est_hours" sort={phaseSort} onSort={togglePhaseSort}>Avg Est Hrs</SortHeader>
                  <SortHeader k="avg_jtd_hours" sort={phaseSort} onSort={togglePhaseSort}>Avg JTD Hrs</SortHeader>
                  <SortHeader k="avg_percent_complete" sort={phaseSort} onSort={togglePhaseSort}>Avg %</SortHeader>
                  <SortHeader k="pct_of_total" sort={phaseSort} onSort={togglePhaseSort}>% of Total</SortHeader>
                </tr></thead>
                <tbody>
                  {filteredPhases.map(r => (
                    <tr key={`${r.phase}-${r.cost_type}`} style={tbodyRow}
                      onClick={() => setDrillPhase({ phase: r.phase, cost_type: r.cost_type })}>
                      <Td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.phase}</Td>
                      <Td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.phase_description || '-'}
                      </Td>
                      <Td align="right">{COST_TYPE_LABELS[r.cost_type] || r.cost_type}</Td>
                      <Td align="right">{fmtNum(r.project_count)}</Td>
                      <Td align="right">{fmt(r.avg_est_cost)}</Td>
                      <Td align="right">{fmt(r.avg_jtd_cost)}</Td>
                      <Td align="right">{fmt(r.avg_committed_cost)}</Td>
                      <Td align="right">{fmt(r.avg_projected_cost)}</Td>
                      <Td align="right">{fmtNum(r.avg_est_hours)}</Td>
                      <Td align="right">{fmtNum(r.avg_jtd_hours)}</Td>
                      <Td align="right">{fmtPct(r.avg_percent_complete)}</Td>
                      <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>{(r.pct_of_total * 100).toFixed(1)}%</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'projects' && (
        <>
          {excluded.size > 0 && (
            <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem', color: '#64748b' }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{excluded.size} excluded</span>
              <button onClick={() => setExcluded(new Set())}
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }}>
                Re-include all
              </button>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <SourceProjectsTable
              projects={projects || []}
              excluded={excluded}
              onToggle={toggleExcluded}
              loading={projLoading}
            />
          </div>
        </>
      )}

      {/* Drill-in modal: phase → projects */}
      {drillPhase && (

        <div onClick={() => setDrillPhase(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '8px', maxWidth: '1200px', width: '100%',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Phase {drillPhase.phase} · {COST_TYPE_LABELS[drillPhase.cost_type]}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                  Per-Project Breakdown
                </div>
              </div>
              <button onClick={() => setDrillPhase(null)} style={{
                background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b',
              }}>×</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {drillLoading ? <Loading /> : !drillRows?.length ? <Empty>No project data for this phase.</Empty> : (
                <table style={tableStyle}>
                  <thead><tr style={theadRow}>
                    <Th align="left">Number</Th><Th align="left">Project</Th>
                    <Th align="left">Status</Th><Th align="left">Dept</Th><Th align="left">Market</Th>
                    <Th>Contract</Th><Th>Est Cost</Th><Th>JTD Cost</Th>
                    <Th>Committed</Th><Th>Projected</Th>
                    <Th>Est Hrs</Th><Th>JTD Hrs</Th><Th>% Comp</Th>
                    <Th>% of Phase</Th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const drillTotal = drillRows.reduce((s, r) => s + r.projected_cost, 0);
                      return drillRows.map(r => {
                        const pct = drillTotal > 0 ? r.projected_cost / drillTotal : 0;
                        return (
                          <tr key={r.project_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <Td><Link to={`/projects/${r.project_id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>{r.number}</Link></Td>
                            <Td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</Td>
                            <Td>{r.status}</Td>
                            <Td>{r.department_number || '-'}</Td>
                            <Td>{r.market || '-'}</Td>
                            <Td align="right">{fmt(r.contract_value)}</Td>
                            <Td align="right">{fmt(r.est_cost)}</Td>
                            <Td align="right">{fmt(r.jtd_cost)}</Td>
                            <Td align="right">{fmt(r.committed_cost)}</Td>
                            <Td align="right">{fmt(r.projected_cost)}</Td>
                            <Td align="right">{fmtNum(r.est_hours)}</Td>
                            <Td align="right">{fmtNum(r.jtd_hours)}</Td>
                            <Td align="right">{fmtPct(r.percent_complete)}</Td>
                            <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>{(pct * 100).toFixed(1)}%</Td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* ============== Estimates view ============== */}
      {dataSource === 'estimates' && (<>

      {/* Estimates filters panel */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Filters {estActiveFilterCount > 0 && <span style={{ marginLeft: '0.4rem', background: '#3b82f6', color: '#fff', padding: '0.05rem 0.4rem', borderRadius: '8px', fontSize: '0.7rem' }}>{estActiveFilterCount}</span>}
          </div>
          {estActiveFilterCount > 0 && (
            <button onClick={clearEstFilters} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }}>
              Clear all
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.75rem 1rem' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Label>Status</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {estOpts?.statuses.map(s => (
                <Chip key={s} active={estFilters.status?.includes(s) ?? false}
                  onClick={() => toggleEstListFilter('status', s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Label>Estimator</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {(estOpts?.estimators || []).map(e => (
                <Chip key={e.id} active={estFilters.estimator_id?.includes(e.id) ?? false}
                  onClick={() => {
                    const cur = estFilters.estimator_id || [];
                    const next = cur.includes(e.id) ? cur.filter(v => v !== e.id) : [...cur, e.id];
                    setEstFilter('estimator_id', next.length ? next : undefined);
                  }}>
                  {e.name}
                </Chip>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Label>Market</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {(estOpts?.markets || []).map(m => (
                <Chip key={m} active={estFilters.market?.includes(m) ?? false}
                  onClick={() => toggleEstListFilter('market', m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </div>
          <div style={{ flex: '0 0 260px' }}>
            <Label>Bid Date Range</Label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <input type="date" value={estFilters.date_from || ''}
                onChange={e => setEstFilter('date_from', e.target.value || undefined)}
                style={inputStyle} />
              <input type="date" value={estFilters.date_to || ''}
                onChange={e => setEstFilter('date_to', e.target.value || undefined)}
                style={inputStyle} />
            </div>
            {estOpts?.dateRange.minDate && estOpts?.dateRange.maxDate && (() => {
              const minMs = new Date(estOpts.dateRange.minDate!).getTime();
              const maxMs = new Date(estOpts.dateRange.maxDate!).getTime();
              const lowMs = estFilters.date_from ? new Date(estFilters.date_from).getTime() : minMs;
              const highMs = estFilters.date_to ? new Date(estFilters.date_to).getTime() : maxMs;
              return (
                <DualRangeSlider
                  min={minMs} max={maxMs} step={86_400_000}
                  low={lowMs} high={highMs}
                  onChange={(lo, hi) => setEstFilters(prev => ({
                    ...prev,
                    date_from: lo === minMs ? undefined : new Date(lo).toISOString().slice(0, 10),
                    date_to: hi === maxMs ? undefined : new Date(hi).toISOString().slice(0, 10),
                  }))}
                  formatValue={ms => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                />
              );
            })()}
          </div>
          <div style={{ flex: '0 0 260px' }}>
            <Label>Bid Value</Label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <CurrencyInput placeholder="Min" value={estFilters.value_min}
                onChange={v => setEstFilter('value_min', v)} style={inputStyle} />
              <CurrencyInput placeholder="Max" value={estFilters.value_max}
                onChange={v => setEstFilter('value_max', v)} style={inputStyle} />
            </div>
            {estOpts?.valueRange.min != null && estOpts?.valueRange.max != null && estOpts.valueRange.max > estOpts.valueRange.min && (() => {
              const minV = Math.floor(estOpts.valueRange.min!);
              const maxV = Math.ceil(estOpts.valueRange.max!);
              const lowV = estFilters.value_min != null ? estFilters.value_min : minV;
              const highV = estFilters.value_max != null ? estFilters.value_max : maxV;
              const step = Math.max(1000, Math.round((maxV - minV) / 1000));
              return (
                <DualRangeSlider
                  min={minV} max={maxV} step={step}
                  low={lowV} high={highV}
                  onChange={(lo, hi) => setEstFilters(prev => ({
                    ...prev,
                    value_min: lo === minV ? null : lo,
                    value_max: hi === maxV ? null : hi,
                  }))}
                  formatValue={v => fmt(v)}
                />
              );
            })()}
          </div>
        </div>
      </div>

      {/* Estimates summary cards */}
      {(() => {
        const cnt = estSummary?.estimate_count || 0;
        const avg = (v: number) => cnt > 0 ? v / cnt : 0;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <Card label="Estimates" value={String(cnt)} color="#3b82f6" />
            <Card label="Avg Bid Value" value={fmt(avg(estSummary?.total_cost_sum || 0))} color="#0ea5e9" />
            <Card label="Avg Labor" value={fmt(avg(estSummary?.labor_cost || 0))} color="#8b5cf6" />
            <Card label="Avg Material" value={fmt(avg(estSummary?.material_cost || 0))} color="#f59e0b" />
            <Card label="Avg Subcontracts" value={fmt(avg(estSummary?.subcontractor_cost || 0))} color="#6366f1" />
            <Card label="Avg Equipment" value={fmt(avg(estSummary?.equipment_cost || 0))} color="#10b981" />
            <Card label="Avg Rentals" value={fmt(avg(estSummary?.rental_cost || 0))} color="#14b8a6" />
            <Card label="Avg Est Hours" value={fmtNum(avg(estSummary?.est_hours || 0))} color="#64748b" />
          </div>
        );
      })()}

      {/* Estimates tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem' }}>
        <TabBtn active={estTab === 'cost-type'} onClick={() => setEstTab('cost-type')}>By Cost Type</TabBtn>
        <TabBtn active={estTab === 'section'} onClick={() => setEstTab('section')}>By Section</TabBtn>
        <TabBtn active={estTab === 'list'} onClick={() => setEstTab('list')}>Source Estimates</TabBtn>
      </div>

      {/* By Cost Type */}
      {estTab === 'cost-type' && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {estCtLoading ? <Loading /> : !estByCostType?.length ? (
            <Empty>No estimate cost data matches your filters.</Empty>
          ) : (() => {
            const total = estByCostType.reduce((s, r) => s + r.est_cost, 0);
            return (
              <table style={tableStyle}>
                <thead><tr style={theadRow}>
                  <Th align="left">Cost Type</Th>
                  <Th>Estimates</Th>
                  <Th>Avg Est Cost</Th>
                  <Th>Avg Est Hrs</Th>
                  <Th>% of Total</Th>
                </tr></thead>
                <tbody>
                  {estByCostType.map(r => {
                    const pct = total > 0 ? r.est_cost / total : 0;
                    return (
                      <tr key={r.cost_type} style={{ ...tbodyRow, cursor: 'default' }}>
                        <Td style={{ fontWeight: 600 }}>{COST_TYPE_LABELS[r.cost_type] || `Type ${r.cost_type}`}</Td>
                        <Td align="right">{fmtNum(r.estimate_count)}</Td>
                        <Td align="right">{fmt(r.estimate_count > 0 ? r.est_cost / r.estimate_count : 0)}</Td>
                        <Td align="right">{r.est_hours > 0 ? fmtNum(r.estimate_count > 0 ? r.est_hours / r.estimate_count : 0) : '-'}</Td>
                        <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>{(pct * 100).toFixed(1)}%</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {/* By Section */}
      {estTab === 'section' && (
        <>
          <div style={{ marginBottom: '0.6rem' }}>
            <input type="text" placeholder="Search section name..."
              value={estSearch} onChange={e => setEstSearch(e.target.value)} style={{ ...inputStyle, maxWidth: '300px' }} />
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            {estSectionLoading ? <Loading /> : !filteredEstSections.length ? (
              <Empty>No sections match your filters.</Empty>
            ) : (() => {
              const total = filteredEstSections.reduce((s, r) => s + r.est_cost, 0);
              return (
                <table style={tableStyle}>
                  <thead><tr style={theadRow}>
                    <Th align="left">Section</Th>
                    <Th>Estimates</Th>
                    <Th>Avg Labor</Th>
                    <Th>Avg Material</Th>
                    <Th>Avg Subcontracts</Th>
                    <Th>Avg Equipment</Th>
                    <Th>Avg Rentals</Th>
                    <Th>Avg Total</Th>
                    <Th>% of Total</Th>
                  </tr></thead>
                  <tbody>
                    {filteredEstSections.map(r => {
                      const pct = total > 0 ? r.est_cost / total : 0;
                      const a = (v: number) => r.estimate_count > 0 ? v / r.estimate_count : 0;
                      return (
                        <tr key={r.section_name} style={{ ...tbodyRow, cursor: 'default' }}>
                          <Td style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {r.section_name}
                          </Td>
                          <Td align="right">{fmtNum(r.estimate_count)}</Td>
                          <Td align="right">{r.labor_cost > 0 ? fmt(a(r.labor_cost)) : '-'}</Td>
                          <Td align="right">{r.material_cost > 0 ? fmt(a(r.material_cost)) : '-'}</Td>
                          <Td align="right">{r.subcontractor_cost > 0 ? fmt(a(r.subcontractor_cost)) : '-'}</Td>
                          <Td align="right">{r.equipment_cost > 0 ? fmt(a(r.equipment_cost)) : '-'}</Td>
                          <Td align="right">{r.rental_cost > 0 ? fmt(a(r.rental_cost)) : '-'}</Td>
                          <Td align="right" style={{ fontWeight: 600 }}>{fmt(a(r.est_cost))}</Td>
                          <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>{(pct * 100).toFixed(1)}%</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}

      {/* Source Estimates */}
      {estTab === 'list' && (
        <>
          <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Search estimates..."
              value={estSearch} onChange={e => setEstSearch(e.target.value)} style={{ ...inputStyle, maxWidth: '260px' }} />
            {estExcluded.size > 0 && (
              <>
                <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>{estExcluded.size} excluded</span>
                <button onClick={() => setEstExcluded(new Set())}
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer', color: '#64748b' }}>
                  Re-include all
                </button>
              </>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.4rem' }}>
            Uncheck any estimate to exclude it from the aggregations above.
          </div>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            {estListLoading ? <Loading /> : !filteredEstList.length ? (
              <Empty>No estimates match your filters.</Empty>
            ) : (() => {
              const includedTotal = filteredEstList.reduce((s, r) => (estExcluded.has(r.id) ? s : s + r.total_cost), 0);
              return (
                <table style={tableStyle}>
                  <thead><tr style={theadRow}>
                    <Th align="left">Incl.</Th>
                    <Th align="left">Number</Th>
                    <Th align="left">Project</Th>
                    <Th align="left">Customer</Th>
                    <Th align="left">Status</Th>
                    <Th align="left">Bid Date</Th>
                    <Th align="left">Estimator</Th>
                    <Th>Labor</Th>
                    <Th>Material</Th>
                    <Th>Subcontracts</Th>
                    <Th>Equipment</Th>
                    <Th>Rentals</Th>
                    <Th>Bid Value</Th>
                    <Th>% of Total</Th>
                  </tr></thead>
                  <tbody>
                    {filteredEstList.map(r => {
                      const isExcluded = estExcluded.has(r.id);
                      const pct = includedTotal > 0 && !isExcluded ? r.total_cost / includedTotal : 0;
                      return (
                        <tr key={r.id} style={{
                          borderBottom: '1px solid #f1f5f9',
                          opacity: isExcluded ? 0.45 : 1,
                          background: isExcluded ? '#fef2f2' : undefined,
                        }}>
                          <Td align="left" style={{ width: '40px' }}>
                            <input type="checkbox" checked={!isExcluded} onChange={() => toggleEstExcluded(r.id)} />
                          </Td>
                          <Td><Link to={`/estimating/${r.id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>{r.estimate_number}</Link></Td>
                          <Td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.project_name}</Td>
                          <Td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer_name || '-'}</Td>
                          <Td>{r.status}</Td>
                          <Td>{r.bid_date ? new Date(r.bid_date).toLocaleDateString() : '-'}</Td>
                          <Td>{r.estimator_name || '-'}</Td>
                          <Td align="right">{r.labor_cost > 0 ? fmt(r.labor_cost) : '-'}</Td>
                          <Td align="right">{r.material_cost > 0 ? fmt(r.material_cost) : '-'}</Td>
                          <Td align="right">{r.subcontractor_cost > 0 ? fmt(r.subcontractor_cost) : '-'}</Td>
                          <Td align="right">{r.equipment_cost > 0 ? fmt(r.equipment_cost) : '-'}</Td>
                          <Td align="right">{r.rental_cost > 0 ? fmt(r.rental_cost) : '-'}</Td>
                          <Td align="right" style={{ fontWeight: 600 }}>{fmt(r.total_cost)}</Td>
                          <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>
                            {isExcluded ? '—' : `${(pct * 100).toFixed(1)}%`}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </>
      )}

      </>)}
    </div>
  );
};

// ============== UI helpers ==============

const inputStyle: React.CSSProperties = {
  width: '100%', height: '30px', padding: '0 0.5rem', fontSize: '0.78rem',
  border: '1px solid #e2e8f0', borderRadius: '4px', outline: 'none', background: '#fff',
  fontFamily: 'inherit', color: '#1e293b', lineHeight: 1.4,
  boxSizing: 'border-box',
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem',
};

const theadRow: React.CSSProperties = {
  backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0',
};

const tbodyRow: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
    {children}
  </div>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '4px',
    border: active ? '2px solid #3b82f6' : '1px solid #cbd5e1',
    background: active ? '#eff6ff' : '#fff',
    color: active ? '#1e40af' : '#475569',
    cursor: 'pointer', fontWeight: active ? 600 : 500,
  }}>
    {children}
  </button>
);

const Card: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div className="card" style={{ padding: '0.5rem 0.75rem' }}>
    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.1rem' }}>{label}</div>
    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: color || '#1e293b' }}>{value}</div>
  </div>
);

const SourceBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, borderRadius: '4px',
    border: 'none', cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1e293b' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
  }}>
    {children}
  </button>
);

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: active ? '#3b82f6' : '#64748b',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    marginBottom: '-1px',
  }}>
    {children}
  </button>
);

const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' }> = ({ children, align = 'right' }) => (
  <th style={{
    textAlign: align, padding: '0.5rem 0.5rem', fontSize: '0.65rem',
    fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap',
  }}>{children}</th>
);

const Td: React.FC<{ children?: React.ReactNode; align?: 'left' | 'right'; style?: React.CSSProperties }> = ({ children, align = 'left', style }) => (
  <td style={{ textAlign: align, padding: '0.4rem 0.5rem', ...style }}>{children ?? '-'}</td>
);

function SortHeader<K extends keyof PhaseRowEnriched>({
  k, sort, onSort, children, align = 'right',
}: {
  k: K;
  sort: { key: keyof PhaseRowEnriched; dir: 'asc' | 'desc' };
  onSort: (k: keyof PhaseRowEnriched) => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const active = sort.key === k;
  return (
    <th onClick={() => onSort(k)} style={{
      textAlign: align, padding: '0.5rem 0.5rem', fontSize: '0.65rem',
      fontWeight: 700, color: active ? '#1e293b' : '#475569', textTransform: 'uppercase',
      whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    }}>
      {children}
      <span style={{ marginLeft: '0.25rem', opacity: active ? 1 : 0.3 }}>
        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}
      </span>
    </th>
  );
}

const Loading: React.FC = () => (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Loading...</div>
);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{children}</div>
);

// Currency input — displays "$1,234,567" but stores a plain number.
const CurrencyInput: React.FC<{
  value: number | null | undefined;
  onChange: (next: number | null) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}> = ({ value, onChange, placeholder, style }) => {
  const display = value == null || value === undefined || isNaN(Number(value))
    ? ''
    : `$${Number(value).toLocaleString('en-US')}`;
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={e => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        onChange(digits === '' ? null : parseInt(digits, 10));
      }}
      style={style}
    />
  );
};

// Source-projects table with per-row exclude checkboxes.
// Rendered both below the cost-type table and inside the Source Projects tab.
const SourceProjectsTable: React.FC<{
  projects: ProjectRow[];
  excluded: Set<number>;
  onToggle: (id: number) => void;
  loading: boolean;
}> = ({ projects, excluded, onToggle, loading }) => {
  if (loading) return <Loading />;
  if (!projects.length) return <Empty>No projects match your filters.</Empty>;
  const includedTotal = projects.reduce((s, p) => (excluded.has(p.id) ? s : s + p.phase_jtd_cost), 0);
  return (
    <table style={tableStyle}>
      <thead><tr style={theadRow}>
        <Th align="left">Incl.</Th>
        <Th align="left">Number</Th><Th align="left">Name</Th>
        <Th align="left">Status</Th><Th align="left">Dept</Th><Th align="left">Market</Th>
        <Th align="left">Start</Th><Th align="left">End</Th>
        <Th>Contract</Th><Th>Phase Est</Th><Th>Phase JTD</Th>
        <Th>% of Total</Th>
      </tr></thead>
      <tbody>
        {projects.map(p => {
          const isExcluded = excluded.has(p.id);
          const pct = includedTotal > 0 && !isExcluded ? p.phase_jtd_cost / includedTotal : 0;
          return (
            <tr key={p.id} style={{
              borderBottom: '1px solid #f1f5f9',
              opacity: isExcluded ? 0.45 : 1,
              background: isExcluded ? '#fef2f2' : undefined,
            }}>
              <Td align="left" style={{ width: '40px' }}>
                <input type="checkbox" checked={!isExcluded}
                  onChange={() => onToggle(p.id)}
                  title={isExcluded ? 'Include in reporting' : 'Exclude from reporting'} />
              </Td>
              <Td><Link to={`/projects/${p.id}`} style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>{p.number}</Link></Td>
              <Td>{p.name}</Td>
              <Td>{p.status}</Td>
              <Td>{p.department_number || '-'}</Td>
              <Td>{p.market || '-'}</Td>
              <Td>{p.start_date ? new Date(p.start_date).toLocaleDateString() : '-'}</Td>
              <Td>{p.end_date ? new Date(p.end_date).toLocaleDateString() : '-'}</Td>
              <Td align="right">{fmt(p.contract_value)}</Td>
              <Td align="right">{fmt(p.phase_est_cost)}</Td>
              <Td align="right">{fmt(p.phase_jtd_cost)}</Td>
              <Td align="right" style={{ fontWeight: 600, color: '#3b82f6' }}>
                {isExcluded ? '—' : `${(pct * 100).toFixed(1)}%`}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// Dual-thumb range slider built from two overlaid range inputs.
const DualRangeSlider: React.FC<{
  min: number;
  max: number;
  step?: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  formatValue: (n: number) => string;
}> = ({ min, max, step = 1, low, high, onChange, formatValue }) => {
  const clampedLow = Math.max(min, Math.min(low, max));
  const clampedHigh = Math.max(min, Math.min(high, max));
  const range = max - min;
  const lowPct = range > 0 ? ((clampedLow - min) / range) * 100 : 0;
  const highPct = range > 0 ? ((clampedHigh - min) / range) * 100 : 100;

  return (
    <div style={{ marginTop: '0.4rem', padding: '0 7px' }}>
      <div style={{ position: 'relative', height: '14px' }}>
        {/* Inputs first, with transparent tracks — only the thumbs are visible. */}
        <input type="range" min={min} max={max} step={step} value={clampedLow}
          onChange={e => onChange(Math.min(parseFloat(e.target.value), clampedHigh), clampedHigh)}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '14px',
            background: 'transparent', appearance: 'none', WebkitAppearance: 'none',
            pointerEvents: 'none', margin: 0, padding: 0, border: 'none',
            zIndex: 3,
          }}
          className="cd-range-slider" />
        <input type="range" min={min} max={max} step={step} value={clampedHigh}
          onChange={e => onChange(clampedLow, Math.max(parseFloat(e.target.value), clampedLow))}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '14px',
            background: 'transparent', appearance: 'none', WebkitAppearance: 'none',
            pointerEvents: 'none', margin: 0, padding: 0, border: 'none',
            zIndex: 3,
          }}
          className="cd-range-slider" />
        {/* Custom track and fill — pointer-events: none so they don't block thumb dragging. */}
        <div style={{
          position: 'absolute', top: '6px', left: 0, right: 0, height: '2px',
          background: '#e2e8f0', borderRadius: '2px',
          pointerEvents: 'none', zIndex: 1,
        }} />
        <div style={{
          position: 'absolute', top: '6px', left: `${lowPct}%`, width: `${Math.max(0, highPct - lowPct)}%`,
          height: '2px', background: '#3b82f6', borderRadius: '2px',
          pointerEvents: 'none', zIndex: 2,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
        <span>{formatValue(clampedLow)}</span>
        <span>{formatValue(clampedHigh)}</span>
      </div>
    </div>
  );
};

// Multi-select dropdown — menu is portaled to body so it escapes stacking contexts.
const MultiSelect: React.FC<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}> = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 2, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  };
  const label = selected.length === 0 ? placeholder :
    selected.length === 1 ? options.find(o => o.value === selected[0])?.label || selected[0] :
    `${selected.length} selected`;

  return (
    <>
      <button ref={btnRef} onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.78rem',
        border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff',
        textAlign: 'left', cursor: 'pointer',
        color: selected.length === 0 ? '#94a3b8' : '#1e293b',
      }}>
        {label}
      </button>
      {open && pos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 9999,
            maxHeight: '240px', overflow: 'auto',
          }}>
            {options.length === 0 ? (
              <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>No options</div>
            ) : options.map(o => (
              <label key={o.value} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.5rem', fontSize: '0.78rem', cursor: 'pointer',
                background: selected.includes(o.value) ? '#eff6ff' : 'transparent',
              }}>
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default CostDatabase;
