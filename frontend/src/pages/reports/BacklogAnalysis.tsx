import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { backlogAnalysisApi, BacklogAnalysisData } from '../../services/backlogAnalysis';
import { teamsApi, Team } from '../../services/teams';

// ─── Formatting helpers ─────────────────────────────────────────────────────

function fmtDollars(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtCompact(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '$0';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function fmtPct(num: number, den: number): string {
  if (!den) return '—';
  return ((num / den) * 100).toFixed(1) + '%';
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface MetricRowProps {
  rowNum?: number | string;
  category: 'Backlog' | 'Calculated' | 'Pipeline';
  label: string;
  value: React.ReactNode;
  description: string;
  isCalculated?: boolean;
}

const CAT_COLORS: Record<string, { fg: string; bg: string; border: string }> = {
  Backlog:    { fg: '#1a2b4a', bg: '#e8edf5', border: '#1a2b4a' },
  Calculated: { fg: '#4b5563', bg: '#f1f5f9', border: '#94a3b8' },
  Pipeline:   { fg: '#c2410c', bg: '#fff7ed', border: '#f97316' },
};

function MetricRow({ rowNum, category, label, value, description, isCalculated }: MetricRowProps) {
  const c = CAT_COLORS[category];
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb', background: isCalculated ? '#f8fafc' : undefined }}>
      <td style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center', width: 36 }}>
        {rowNum}
      </td>
      <td style={{ padding: '0.45rem 0.75rem', width: 110 }}>
        <span style={{
          display: 'inline-block',
          padding: '0.15rem 0.45rem',
          borderRadius: 3,
          fontSize: '0.65rem',
          fontWeight: 700,
          color: c.fg,
          background: c.bg,
          border: `1px solid ${c.border}22`,
          letterSpacing: '0.02em',
        }}>
          {category}
        </span>
      </td>
      <td style={{
        padding: '0.45rem 0.75rem',
        fontSize: '0.82rem',
        color: '#1f2937',
        fontWeight: isCalculated ? 600 : 400,
      }}>
        {label}
      </td>
      <td style={{
        padding: '0.45rem 1rem 0.45rem 0.75rem',
        fontSize: '0.85rem',
        fontWeight: isCalculated ? 700 : 600,
        color: isCalculated ? '#1a2b4a' : '#374151',
        textAlign: 'right',
        whiteSpace: 'nowrap',
        width: 160,
      }}>
        {value}
      </td>
      <td style={{ padding: '0.45rem 0.75rem', fontSize: '0.72rem', color: '#6b7280' }}>
        {description}
      </td>
    </tr>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={5} style={{
        padding: '0.4rem 0.75rem',
        fontSize: '0.68rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        background: '#1a2b4a',
      }}>
        {title}
      </td>
    </tr>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────


export default function BacklogAnalysis() {
  const queryClient = useQueryClient();

  const [divisionFilter, setDivisionFilter] = useState('all');
  const [teamFilter, setTeamFilter]         = useState('all');
  const [pdfLoading, setPdfLoading]         = useState(false);
  const [excelLoading, setExcelLoading]     = useState(false);
  const [showSettings, setShowSettings]     = useState(false);
  const [sgaMode, setSgaMode]               = useState<'dollar' | 'percent'>('dollar');
  const [sgaInput, setSgaInput]             = useState('');
  const [scenario, setScenario]             = useState<'conservative' | 'actual' | 'aggressive'>('actual');
  const [conservativePct, setConservativePct] = useState('10');
  const [aggressivePct, setAggressivePct]   = useState('10');
  const [sgaSaving, setSgaSaving]           = useState(false);
  const [sortCol, setSortCol]               = useState<string>('totalBacklog');
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('desc');

  // Fetch settings once
  const { data: settings } = useQuery({
    queryKey: ['backlog-analysis-settings'],
    queryFn:  backlogAnalysisApi.getSettings,
  });

  useEffect(() => {
    if (!settings) return;
    setSgaMode(settings.sgaMode || 'dollar');
    if (settings.sgaMode === 'percent') {
      setSgaInput(settings.sgaPct != null ? String(settings.sgaPct) : '');
    } else {
      setSgaInput(settings.monthlySgAndA != null ? String(Math.round(settings.monthlySgAndA)) : '');
    }
    setScenario(settings.scenario || 'actual');
    setConservativePct(settings.conservativePct != null ? String(settings.conservativePct) : '10');
    setAggressivePct(settings.aggressivePct   != null ? String(settings.aggressivePct)   : '10');
  }, [settings]);

  // Teams for dropdown
  const { data: teamsRaw } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await teamsApi.getAll();
      return res.data.data || [];
    },
  });
  const teams: Team[] = Array.isArray(teamsRaw) ? teamsRaw : [];

  // Fetch report data
  const { data, isLoading, error } = useQuery({
    queryKey: ['backlog-analysis', divisionFilter, teamFilter],
    queryFn:  () => backlogAnalysisApi.getData(divisionFilter, teamFilter),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const saveSgaMutation = useMutation({
    mutationFn: (val: any) =>
      backlogAnalysisApi.saveSettings(val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlog-analysis'] });
      queryClient.invalidateQueries({ queryKey: ['backlog-analysis-settings'] });
      setShowSettings(false);
    },
  });

  const handleSaveSga = useCallback(async () => {
    setSgaSaving(true);
    const parsedSga  = parseFloat(sgaInput.replace(/[^0-9.]/g, ''));
    const parsedConv = parseFloat(conservativePct.replace(/[^0-9.]/g, ''));
    const parsedAgg  = parseFloat(aggressivePct.replace(/[^0-9.]/g, ''));
    await saveSgaMutation.mutateAsync({
      monthlySgAndA:   sgaMode === 'dollar' ? (isNaN(parsedSga) ? null : parsedSga) : null,
      sgaMode,
      sgaPct:          sgaMode === 'percent' ? (isNaN(parsedSga) ? null : parsedSga) : null,
      scenario,
      conservativePct: isNaN(parsedConv) ? 10 : parsedConv,
      aggressivePct:   isNaN(parsedAgg)  ? 10 : parsedAgg,
    } as any);
    setSgaSaving(false);
  }, [sgaInput, sgaMode, scenario, conservativePct, aggressivePct, saveSgaMutation]);

  const handlePdf = useCallback(async () => {
    setPdfLoading(true);
    try {
      await backlogAnalysisApi.downloadPdf(divisionFilter, teamFilter);
    } finally {
      setPdfLoading(false);
    }
  }, [divisionFilter, teamFilter]);

  const handleExcel = useCallback(async () => {
    setExcelLoading(true);
    try {
      await backlogAnalysisApi.downloadExcel(divisionFilter, teamFilter);
    } finally {
      setExcelLoading(false);
    }
  }, [divisionFilter, teamFilter]);

  const handleSort = useCallback((col: string) => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return col; }
      setSortDir('desc');
      return col;
    });
  }, []);

  const d = data as BacklogAnalysisData | undefined;

  const sortedContracts = useMemo(() => {
    if (!d?.contractDetails) return [];
    return [...d.contractDetails].sort((a, b) => {
      const aVal = (a as any)[sortCol] ?? '';
      const bVal = (b as any)[sortCol] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [d?.contractDetails, sortCol, sortDir]);

  const sgaMonthsDisplay = d?.sgaMonthsCovered != null
    ? d.sgaMonthsCovered.toFixed(1) + ' months'
    : '— (configure SG&A)';

  const blendedGmPct = d && d.totalBacklogRevenue > 0
    ? ((d.totalBacklogGM / d.totalBacklogRevenue) * 100).toFixed(1) + '%'
    : null;

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.75rem',
    fontSize: '0.78rem',
    background: active ? '#1a2b4a' : '#f1f5f9',
    color: active ? '#fff' : '#374151',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <Link to="/reports" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>
            &larr; Reports
          </Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', color: '#1a2b4a' }}>
            Backlog Analysis
          </h2>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            Fiscal Year burn, gross margin coverage &amp; pipeline summary · Fiscal Year {d?.currentFY ?? new Date().getFullYear()} (Jan 1 – Dec 31)
            {d?.scenario && d.scenario !== 'actual' && (
              <span style={{
                padding: '0.1rem 0.5rem',
                borderRadius: 3,
                fontSize: '0.68rem',
                fontWeight: 700,
                background: d.scenario === 'conservative' ? '#fef2f2' : '#f0fdf4',
                color: d.scenario === 'conservative' ? '#dc2626' : '#16a34a',
                border: `1px solid ${d.scenario === 'conservative' ? '#fecaca' : '#bbf7d0'}`,
              }}>
                {d.scenario === 'conservative'
                  ? `Conservative −${d.conservativePct}%`
                  : `Aggressive +${d.aggressivePct}%`}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ ...btnStyle(), borderColor: showSettings ? '#f97316' : undefined }}
          >
            ⚙ Settings
          </button>
          <button
            onClick={handlePdf}
            disabled={pdfLoading || isLoading}
            style={{
              padding: '0.4rem 0.8rem', fontSize: '0.78rem',
              background: pdfLoading ? '#93c5fd' : '#3b82f6',
              color: '#fff', border: 'none', borderRadius: 4,
              cursor: pdfLoading ? 'wait' : 'pointer',
            }}
          >
            {pdfLoading ? 'Generating…' : '⬇ PDF'}
          </button>
          <button
            onClick={handleExcel}
            disabled={excelLoading || isLoading}
            style={{
              padding: '0.4rem 0.8rem', fontSize: '0.78rem',
              background: excelLoading ? '#86efac' : '#16a34a',
              color: '#fff', border: 'none', borderRadius: 4,
              cursor: excelLoading ? 'wait' : 'pointer',
            }}
          >
            {excelLoading ? 'Generating…' : '⬇ Excel'}
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '1.1rem 1.25rem',
          marginBottom: '1rem',
          borderLeft: '3px solid #f97316',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '1rem', color: '#1a2b4a' }}>
            Report Settings
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* ── SG&A ── */}
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Monthly SG&amp;A
              </div>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: '0.5rem' }}>
                {(['dollar', 'percent'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setSgaMode(mode); setSgaInput(''); }}
                    style={{
                      padding: '0.3rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: sgaMode === mode ? 700 : 400,
                      background: sgaMode === mode ? '#1a2b4a' : '#f1f5f9',
                      color: sgaMode === mode ? '#fff' : '#374151',
                      border: '1px solid #e2e8f0',
                      borderRadius: mode === 'dollar' ? '4px 0 0 4px' : '0 4px 4px 0',
                      cursor: 'pointer',
                      borderRight: mode === 'dollar' ? 'none' : undefined,
                    }}
                  >
                    {mode === 'dollar' ? '$ Amount' : '% of Revenue'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
                  {sgaMode === 'dollar' ? '$' : ''}
                </span>
                <input
                  type="text"
                  value={sgaInput}
                  onChange={e => setSgaInput(e.target.value)}
                  placeholder={sgaMode === 'dollar' ? 'e.g. 250000' : 'e.g. 8'}
                  style={{
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.85rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    width: 130,
                  }}
                />
                {sgaMode === 'percent' && (
                  <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>%</span>
                )}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                {sgaMode === 'dollar'
                  ? 'Fixed monthly SG&A dollar amount.'
                  : 'Annual SG&A as % of total backlog revenue (annualized ÷ 12).'}
              </div>
            </div>

            {/* ── Scenario ── */}
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Scenario
              </div>
              <div style={{ display: 'flex', gap: 0, marginBottom: '0.75rem' }}>
                {([
                  { key: 'conservative', label: 'Conservative' },
                  { key: 'actual',       label: 'Actual'       },
                  { key: 'aggressive',   label: 'Aggressive'   },
                ] as const).map((s, i) => (
                  <button
                    key={s.key}
                    onClick={() => setScenario(s.key)}
                    style={{
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.75rem',
                      fontWeight: scenario === s.key ? 700 : 400,
                      background: scenario === s.key
                        ? (s.key === 'conservative' ? '#dc2626' : s.key === 'aggressive' ? '#16a34a' : '#1a2b4a')
                        : '#f1f5f9',
                      color: scenario === s.key ? '#fff' : '#374151',
                      border: '1px solid #e2e8f0',
                      borderRadius: i === 0 ? '4px 0 0 4px' : i === 2 ? '0 4px 4px 0' : 0,
                      borderRight: i < 2 ? 'none' : undefined,
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {scenario !== 'actual' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#374151' }}>
                    {scenario === 'conservative' ? 'Reduce by' : 'Increase by'}
                  </label>
                  <input
                    type="text"
                    value={scenario === 'conservative' ? conservativePct : aggressivePct}
                    onChange={e => scenario === 'conservative'
                      ? setConservativePct(e.target.value)
                      : setAggressivePct(e.target.value)
                    }
                    style={{
                      padding: '0.3rem 0.5rem',
                      fontSize: '0.82rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: 4,
                      width: 60,
                    }}
                  />
                  <span style={{ fontSize: '0.82rem', color: '#374151' }}>%</span>
                  <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                    {scenario === 'conservative'
                      ? 'Applied as a haircut to all revenue & GM figures.'
                      : 'Applied as an uplift to all revenue & GM figures.'}
                  </span>
                </div>
              )}
              {scenario === 'actual' && (
                <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>No adjustment — raw Vista data.</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleSaveSga}
              disabled={sgaSaving}
              style={{
                padding: '0.4rem 1.25rem', fontSize: '0.78rem',
                background: '#1a2b4a', color: '#fff',
                border: 'none', borderRadius: 4,
                cursor: sgaSaving ? 'wait' : 'pointer',
                fontWeight: 600,
              }}
            >
              {sgaSaving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        gap: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Department
          </label>
          <select
            value={divisionFilter}
            onChange={e => setDivisionFilter(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff' }}
          >
            <option value="all">All Departments</option>
            {(d?.availableDivisions || []).map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Team
          </label>
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: 4, background: '#fff', minWidth: 200 }}
          >
            <option value="all">All Teams</option>
            {teams.map(t => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
        </div>
        {(divisionFilter !== 'all' || teamFilter !== 'all') && (
          <button
            onClick={() => { setDivisionFilter('all'); setTeamFilter('all'); }}
            style={{ ...btnStyle(), fontSize: '0.72rem', padding: '0.25rem 0.6rem', alignSelf: 'flex-end' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary cards */}
      {d && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="card" style={{ padding: '0.85rem', borderLeft: '3px solid #3b82f6' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Total Booked Backlog
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a2b4a' }}>
              {fmtCompact(d.totalBacklogRevenue)}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>
              Current Fiscal Year: {fmtCompact(d.currentFYRevenue)}
            </div>
          </div>
          <div className="card" style={{ padding: '0.85rem', borderLeft: '3px solid #16a34a' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Total Backlog GM
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a2b4a' }}>
              {fmtCompact(d.totalBacklogGM)}
            </div>
            {blendedGmPct && (
              <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                {blendedGmPct} blended GM
              </div>
            )}
          </div>
          <div className="card" style={{ padding: '0.85rem', borderLeft: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              SG&amp;A Months Covered
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: d.sgaMonthsCovered ? '#1a2b4a' : '#9ca3af' }}>
              {d.sgaMonthsCovered != null ? d.sgaMonthsCovered.toFixed(1) : '—'}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>
              {d.monthlySgAndA ? (
                <>
                  {`Monthly SG&A: ${fmtCompact(d.monthlySgAndA)}`}
                  {d.totalBacklogRevenue > 0 && (
                    <span style={{ marginLeft: '0.3rem', color: '#a78bfa' }}>
                      ({((d.monthlySgAndA * 12) / d.totalBacklogRevenue * 100).toFixed(1)}% of rev)
                    </span>
                  )}
                </>
              ) : 'Configure in Settings'}
            </div>
          </div>
          <div className="card" style={{ padding: '0.85rem', borderLeft: '3px solid #f97316' }}>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Pipeline (Sold + Hi-Prob)
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1a2b4a' }}>
              {fmtCompact(d.backlogSoldNotContracted + d.highPotentialBacklog)}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>
              Sold: {fmtCompact(d.backlogSoldNotContracted)} · Hi-Prob: {fmtCompact(d.highPotentialBacklog)}
            </div>
          </div>
        </div>
      )}

      {/* Metrics table */}
      {isLoading && (
        <div className="loading" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Loading backlog data…
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 8 }}>
          Failed to load backlog analysis data.
        </div>
      )}

      {d && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', textAlign: 'center', width: 36 }}>#</th>
                <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: 110 }}>Category</th>
                <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>Metric</th>
                <th style={{ padding: '0.5rem 1rem 0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', textAlign: 'right', width: 160 }}>Value</th>
                <th style={{ padding: '0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              <SectionHeader title="Backlog Burn by Fiscal Year" />
              <MetricRow
                rowNum={31}
                category="Backlog"
                label={`Remaining Backlog to Burn in the Current Fiscal Year ($)`}
                value={fmtDollars(d.currentFYRevenue)}
                description={`Remaining backlog that will burn in ${d.currentFY}.`}
              />
              <MetricRow
                rowNum={32}
                category="Backlog"
                label="Backlog to Burn in Future Fiscal Years ($)"
                value={fmtDollars(d.futureFYRevenue)}
                description={`Backlog that will burn after Dec 31, ${d.currentFY}.`}
              />
              <MetricRow
                category="Calculated"
                label="Total Booked Backlog Revenue ($)"
                value={fmtDollars(d.totalBacklogRevenue)}
                description="Sum of current fiscal year + future fiscal year backlog."
                isCalculated
              />

              <SectionHeader title="Gross Margin on Backlog" />
              <MetricRow
                rowNum={33}
                category="Backlog"
                label={`Gross Margin on Backlog that will Burn in the Current Fiscal Year ($)`}
                value={fmtDollars(d.currentFYGM)}
                description={`Gross margin on backlog burning in ${d.currentFY}.`}
              />
              <MetricRow
                rowNum={34}
                category="Backlog"
                label="Gross Margin on Backlog that will Burn in Future Fiscal Years ($)"
                value={fmtDollars(d.futureFYGM)}
                description="Gross margin expected on backlog burning in future fiscal years."
              />
              <MetricRow
                category="Calculated"
                label="Total Booked Backlog Gross Margin ($)"
                value={fmtDollars(d.totalBacklogGM)}
                description="Total GM across all booked backlog."
                isCalculated
              />
              <MetricRow
                category="Calculated"
                label="Number of Months SG&A Covered by Gross Margin on Backlog"
                value={sgaMonthsDisplay}
                description={
                  d.monthlySgAndA
                    ? `Based on monthly SG&A of ${fmtDollars(d.monthlySgAndA)}.`
                    : 'Set monthly SG&A in ⚙ Settings above to enable this metric.'
                }
                isCalculated
              />

              <SectionHeader title="Pipeline Backlog" />
              <MetricRow
                rowNum={35}
                category="Pipeline"
                label="Backlog Sold (Not Yet Contracted) ($)"
                value={fmtDollars(d.backlogSoldNotContracted)}
                description="Awarded opportunities not yet entered in Vista."
              />
              <MetricRow
                rowNum={36}
                category="Pipeline"
                label="High Potential Backlog ($)"
                value={fmtDollars(d.highPotentialBacklog)}
                description="Opportunities marked High probability of award."
              />
            </tbody>
          </table>
        </div>
      )}

      {/* ── Contract detail breakdown ── */}
      {d && d.contractDetails && d.contractDetails.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a2b4a', margin: '0 0 0.5rem 0' }}>
            Booked Backlog — Contract Detail
            <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({d.contractDetails.length} contracts)
            </span>
          </h3>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#1a2b4a' }}>
                  {([
                    { label: 'Contract',        key: 'contractNumber',   right: false },
                    { label: 'Description',     key: 'description',      right: false },
                    { label: 'Customer',        key: 'customerName',     right: false },
                    { label: 'PM',              key: 'pmName',           right: false },
                    { label: '% Done',          key: 'pctComplete',      right: true  },
                    { label: 'Total Backlog',   key: 'totalBacklog',     right: true  },
                    { label: 'GM %',            key: 'gmPct',            right: true  },
                    { label: 'Curr Fiscal Year Rev',   key: 'currentFYRevenue', right: true  },
                    { label: 'Curr Fiscal Year GM',    key: 'currentFYGM',      right: true  },
                    { label: 'Future Fiscal Year Rev', key: 'futureFYRevenue',  right: true  },
                    { label: 'Future Fiscal Year GM',  key: 'futureFYGM',       right: true  },
                    { label: 'Total GM',        key: 'totalGM',          right: true  },
                  ] as { label: string; key: string; right: boolean }[]).map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.65rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: '#fff', textAlign: col.right ? 'center' : 'left',
                        whiteSpace: 'normal', cursor: 'pointer',
                        userSelect: 'none', verticalAlign: 'bottom',
                        lineHeight: 1.2,
                        background: sortCol === col.key ? '#2d4a7a' : undefined,
                      }}
                    >
                      {col.label}
                      <span style={{ marginLeft: '0.25rem', opacity: sortCol === col.key ? 1 : 0.35 }}>
                        {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedContracts.map((c, i) => (
                  <tr key={c.contractNumber || i} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={{ padding: '0.4rem 0.65rem', fontWeight: 600, color: '#1a2b4a', whiteSpace: 'nowrap' }}>{c.contractNumber}</td>
                    <td style={{ padding: '0.4rem 0.65rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.description}>{c.description}</td>
                    <td style={{ padding: '0.4rem 0.65rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }} title={c.customerName}>{c.customerName}</td>
                    <td style={{ padding: '0.4rem 0.65rem', whiteSpace: 'nowrap', color: '#374151' }}>{c.pmName}</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#6b7280' }}>{c.pctComplete}%</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', fontWeight: 600 }}>{fmtCompact(c.totalBacklog)}</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: c.gmPct >= 20 ? '#16a34a' : c.gmPct >= 10 ? '#ca8a04' : '#dc2626', fontWeight: 600 }}>
                      {c.gmPct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#2563eb' }}>{fmtCompact(c.currentFYRevenue)}</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#16a34a' }}>{fmtCompact(c.currentFYGM)}</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#6b7280' }}>{fmtCompact(c.futureFYRevenue)}</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#6b7280' }}>{fmtCompact(c.futureFYGM)}</td>
                    <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{fmtCompact(c.totalGM)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '0.45rem 0.65rem', fontSize: '0.78rem', color: '#374151' }}>
                    Totals — {d.contractDetails.length} contracts
                  </td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right' }}>{fmtCompact(d.totalBacklogRevenue)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right' }}>
                    {d.totalBacklogRevenue > 0 ? ((d.totalBacklogGM / d.totalBacklogRevenue) * 100).toFixed(1) + '%' : '—'}
                  </td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', color: '#2563eb' }}>{fmtCompact(d.currentFYRevenue)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', color: '#16a34a' }}>{fmtCompact(d.currentFYGM)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', color: '#6b7280' }}>{fmtCompact(d.futureFYRevenue)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', color: '#6b7280' }}>{fmtCompact(d.futureFYGM)}</td>
                  <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', color: '#16a34a' }}>{fmtCompact(d.totalBacklogGM)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Pipeline detail ── */}
      {d && (d.awardedNotInVistaOpps?.length > 0 || d.highPotentialOpps?.length > 0) && (
        <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

          {/* Awarded Not in Vista */}
          {d.awardedNotInVistaOpps?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c2410c', margin: '0 0 0.5rem 0' }}>
                Backlog Sold — Not Yet Contracted
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                  ({d.awardedNotInVistaOpps.length})
                </span>
              </h3>
              <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#fff7ed', borderBottom: '2px solid #fed7aa' }}>
                      {['Opportunity', 'Customer', 'Assigned To', 'Est. Value'].map(h => (
                        <th key={h} style={{ padding: '0.4rem 0.65rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c2410c', textAlign: h === 'Est. Value' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.awardedNotInVistaOpps.map((o, i) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#fffbf8' }}>
                        <td style={{ padding: '0.4rem 0.65rem', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.title}>{o.title}</td>
                        <td style={{ padding: '0.4rem 0.65rem', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.customerName}>{o.customerName}</td>
                        <td style={{ padding: '0.4rem 0.65rem', color: '#374151', whiteSpace: 'nowrap' }}>{o.assignedTo}</td>
                        <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', fontWeight: 600, color: '#c2410c' }}>{fmtCompact(o.estValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fff7ed', borderTop: '2px solid #fed7aa', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', color: '#374151' }}>Total</td>
                      <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#c2410c' }}>{fmtCompact(d.backlogSoldNotContracted)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* High Potential */}
          {d.highPotentialOpps?.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a2b4a', margin: '0 0 0.5rem 0' }}>
                High Potential Backlog
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                  ({d.highPotentialOpps.length})
                </span>
              </h3>
              <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f0f4ff', borderBottom: '2px solid #c7d7f5' }}>
                      {['Opportunity', 'Customer', 'Stage', 'Est. Value'].map(h => (
                        <th key={h} style={{ padding: '0.4rem 0.65rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1a2b4a', textAlign: h === 'Est. Value' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.highPotentialOpps.map((o, i) => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#f8faff' }}>
                        <td style={{ padding: '0.4rem 0.65rem', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.title}>{o.title}</td>
                        <td style={{ padding: '0.4rem 0.65rem', color: '#6b7280', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.customerName}>{o.customerName}</td>
                        <td style={{ padding: '0.4rem 0.65rem', color: '#374151' }}>
                          <span style={{ padding: '0.1rem 0.4rem', borderRadius: 3, fontSize: '0.65rem', fontWeight: 600, background: '#e8edf5', color: '#1a2b4a' }}>
                            {o.stageName}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', fontWeight: 600, color: '#1a2b4a' }}>{fmtCompact(o.estValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f0f4ff', borderTop: '2px solid #c7d7f5', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', color: '#374151' }}>Total</td>
                      <td style={{ padding: '0.4rem 0.65rem', textAlign: 'right', color: '#1a2b4a' }}>{fmtCompact(d.highPotentialBacklog)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FY note */}
      <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: '#9ca3af' }}>
        Burn timing derived from Vista contract backlog distributed via project revenue schedule contours.
        Fiscal Year: Jan 1 – Dec 31. GM from Vista <code>gross_profit_percent</code> applied proportionally to each fiscal year bucket.
      </div>
    </div>
  );
}
