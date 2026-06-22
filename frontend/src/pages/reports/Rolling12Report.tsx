import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  rolling12ReportApi,
  Rolling12Data,
  Rolling12Team,
  SecuredProject,
  AwardedProject,
  PursuitProject,
} from '../../services/rolling12Report';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(v));

const fmtK = (v: number) => {
  if (v === 0) return '$0';
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return fmt(v);
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSummaryRows(data: Rolling12Data) {
  const secured = data.columns.map(c => data.secured[c.key] || 0);
  const awarded = data.columns.map(c => data.awarded[c.key] || 0);
  const total = data.columns.map((_, i) => secured[i] + awarded[i]);
  const pursuits = data.columns.map(c => data.pursuits[c.key] || 0);
  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  return {
    secured, awarded, total, pursuits,
    securedTotal: sum(secured),
    awardedTotal: sum(awarded),
    combinedTotal: sum(total),
    pursuitsTotal: sum(pursuits),
  };
}

// ── Main component ────────────────────────────────────────────────────────────

const Rolling12Report: React.FC = () => {
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<number[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: filtersData } = useQuery({
    queryKey: ['rolling12Filters'],
    queryFn: () => rolling12ReportApi.getFilters().then(r => r.data),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['rolling12Report', deptFilter, teamFilter],
    queryFn: () => rolling12ReportApi.get(deptFilter, teamFilter).then(r => r.data),
  });

  const rows = useMemo(() => (data ? buildSummaryRows(data) : null), [data]);
  const labels = data?.columns.map(c => c.label) ?? [];

  // Client-side filter for detail tables — secured filters by department_code;
  // awarded/pursuits have no department field so they always show everything.
  const filteredSecured = useMemo(() => {
    if (!data) return [];
    if (deptFilter.length === 0) return data.secured_projects;
    return data.secured_projects.filter(p => deptFilter.includes(p.department_code));
  }, [data, deptFilter]);

  const deptFilterActive = deptFilter.length > 0;
  const teamFilterActive = teamFilter.length > 0;

  const chartData = rows
    ? {
        labels,
        datasets: [
          {
            label: 'Secured Revenue',
            data: rows.secured,
            backgroundColor: '#2563EB',
            stack: 'committed',
          },
          {
            label: 'Awarded',
            data: rows.awarded,
            backgroundColor: '#10B981',
            stack: 'committed',
          },
          {
            label: 'Weighted Pursuits',
            data: rows.pursuits,
            backgroundColor: '#F59E0B',
            stack: 'pursuits',
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: false,
        ticks: { callback: (v: any) => fmtK(v) },
        grid: { color: '#F1F5F9' },
      },
    },
  };

  const handleExcel = async () => {
    setExportError(null);
    setExcelLoading(true);
    try { await rolling12ReportApi.downloadExcel(deptFilter, teamFilter); }
    catch (e: any) { setExportError(e?.response?.data?.error || e?.message || 'Export failed'); }
    finally { setExcelLoading(false); }
  };

  const handlePdf = async () => {
    setExportError(null);
    setPdfLoading(true);
    try { await rolling12ReportApi.downloadPdf(deptFilter, teamFilter); }
    catch (e: any) { setExportError(e?.response?.data?.error || e?.message || 'PDF failed'); }
    finally { setPdfLoading(false); }
  };

  const toggleDept = (code: string) =>
    setDeptFilter(prev =>
      prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code]
    );

  const toggleTeam = (id: number) =>
    setTeamFilter(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );

  return (
    <div style={{ padding: '1rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem' }}>
        <div>
          <Link to="/reports" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
            &larr; Reports
          </Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', color: '#1e293b' }}>
            Rolling 12-Month Revenue Forecast
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Secured (Vista), awarded, and weighted pursuit revenue for the next 12 months.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handlePdf} disabled={pdfLoading || isLoading} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {pdfLoading ? 'Generating PDF…' : 'Export PDF'}
            </button>
            <button onClick={handleExcel} disabled={excelLoading || isLoading} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              {excelLoading ? 'Exporting…' : 'Export Excel'}
            </button>
          </div>
          {exportError && (
            <div style={{ fontSize: '0.7rem', color: '#b91c1c', maxWidth: '260px', textAlign: 'right' }}>{exportError}</div>
          )}
        </div>
      </div>

      {/* Filters */}
      {filtersData && (filtersData.departments.length > 0 || (filtersData.teams?.length ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {filtersData.departments.length > 0 && (
            <FilterDropdown
              label="Department"
              selected={deptFilter}
              options={filtersData.departments.map(d => ({ key: d, label: d }))}
              onToggle={key => toggleDept(key)}
              onClear={() => setDeptFilter([])}
            />
          )}
          {(filtersData.teams?.length ?? 0) > 0 && (
            <FilterDropdown
              label="Team"
              selected={teamFilter.map(String)}
              options={(filtersData.teams ?? []).map((t: Rolling12Team) => ({ key: String(t.id), label: t.name, color: t.color }))}
              onToggle={key => toggleTeam(Number(key))}
              onClear={() => setTeamFilter([])}
            />
          )}
        </div>
      )}

      {isLoading && <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>}
      {error && <div className="card" style={{ padding: '1.5rem', color: '#b91c1c' }}>Failed to load report data.</div>}

      {data && rows && (
        <>
          {/* KPI strip */}
          <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <Kpi label="12-Mo Secured" value={fmt(rows.securedTotal)} color="#2563EB" />
            <Kpi label="12-Mo Awarded" value={fmt(rows.awardedTotal)} color="#10B981" />
            <Kpi label="Total (Secured + Awarded)" value={fmt(rows.combinedTotal)} color="#1E293B" bold />
            <Kpi label="Weighted Pursuits" value={fmt(rows.pursuitsTotal)} color="#B45309" />
            <Kpi label="Secured Projects" value={String(data.secured_projects.length)} color="#475569" />
            <Kpi label="Awarded Opps" value={String(data.awarded_projects.length)} color="#475569" />
            <Kpi label="Active Pursuits" value={String(data.pursuit_projects.length)} color="#475569" />
          </div>

          {/* Chart */}
          <div className="card" style={{ padding: '1rem', marginBottom: '0.85rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Revenue by Month
            </div>
            <div style={{ height: 300 }}>
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.4rem' }}>
              Secured and Awarded are stacked. Pursuits are probability-weighted and shown separately.
            </div>
          </div>

          {/* Summary table */}
          <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: '1.25rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#1E3A5F' }}>
                  <th style={{ ...th, textAlign: 'left', color: '#fff', minWidth: 220 }}>Revenue Category</th>
                  {data.columns.map(c => <th key={c.key} style={{ ...th, color: '#fff' }}>{c.label}</th>)}
                  <th style={{ ...th, color: '#fff', borderLeft: '2px solid #334155' }}>12-Mo Total</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow label="Secured Revenue" values={rows.secured} total={rows.securedTotal} bg="#EFF6FF" color="#1D4ED8" />
                <SummaryRow label="Awarded" values={rows.awarded} total={rows.awardedTotal} bg="#ECFDF5" color="#065F46" />
                <SummaryRow label="Total  (Secured + Awarded)" values={rows.total} total={rows.combinedTotal} bg="#1E293B" color="#FFFFFF" bold />
                <tr><td colSpan={data.columns.length + 2} style={{ height: 6 }} /></tr>
                <SummaryRow label="Weighted Pursuits" values={rows.pursuits} total={rows.pursuitsTotal} bg="#FFFBEB" color="#92400E" />
              </tbody>
            </table>
          </div>

          {/* ── Secured detail ───────────────────────────────────────────── */}
          <DetailSection
            title={`Secured Revenue — Projects (${filteredSecured.length}${deptFilterActive && filteredSecured.length !== data.secured_projects.length ? ` of ${data.secured_projects.length}` : ''})`}
            accentColor="#1E3A5F"
            textColor="#1D4ED8"
            bgAlt="#EFF6FF"
          >
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#1E3A5F' }}>
                    {['Contract #', 'Description', 'PM', 'Dept', 'Backlog', '%'].map((h, i) => (
                      <th key={h} style={{ ...dth, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
                    ))}
                    {data.columns.map(c => <th key={c.key} style={dth}>{c.label}</th>)}
                    <th style={{ ...dth, borderLeft: '2px solid #334155' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSecured.map((p, i) => (
                    <SecuredRow key={p.contract_number} p={p} columns={data.columns} idx={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          {/* ── Awarded detail ───────────────────────────────────────────── */}
          <DetailSection
            title={`Awarded Opportunities (${data.awarded_projects.length})${deptFilterActive && !teamFilterActive ? ' — dept filter n/a' : ''}`}
            accentColor="#065F46"
            textColor="#065F46"
            bgAlt="#ECFDF5"
          >
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#065F46' }}>
                    {['Opportunity', 'Client', 'Full Value'].map((h, i) => (
                      <th key={h} style={{ ...dth, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                    ))}
                    {data.columns.map(c => <th key={c.key} style={dth}>{c.label}</th>)}
                    <th style={{ ...dth, borderLeft: '2px solid #134e4a' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.awarded_projects.map((p, i) => (
                    <AwardedRow key={i} p={p} columns={data.columns} idx={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          {/* ── Pursuits detail ──────────────────────────────────────────── */}
          <DetailSection
            title={`Weighted Pursuits (${data.pursuit_projects.length})${deptFilterActive && !teamFilterActive ? ' — dept filter n/a' : ''}`}
            accentColor="#92400E"
            textColor="#92400E"
            bgAlt="#FFFBEB"
          >
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: '#92400E' }}>
                    {['Opportunity', 'Client', 'Stage', 'Prob%', 'Full Value', 'Weighted'].map((h, i) => (
                      <th key={h} style={{ ...dth, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                    ))}
                    {data.columns.map(c => <th key={c.key} style={dth}>{c.label}</th>)}
                    <th style={{ ...dth, borderLeft: '2px solid #78350f' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pursuit_projects.map((p, i) => (
                    <PursuitRow key={i} p={p} columns={data.columns} idx={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>

          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            Generated {new Date(data.generated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.
            Secured revenue uses Vista backlog with project contours. Awarded and pursuits use linear distribution over estimated duration.
          </div>
        </>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const FilterDropdown: React.FC<{
  label: string;
  selected: string[];
  options: { key: string; label: string; color?: string }[];
  onToggle: (key: string) => void;
  onClear: () => void;
}> = ({ label, selected, options, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const triggerLabel = selected.length === 0
    ? label
    : `${label}: ${selected.map(k => options.find(o => o.key === k)?.label ?? k).join(', ')}`;

  const isActive = selected.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: '0.78rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '6px',
          border: isActive ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          background: isActive ? '#eff6ff' : '#fff',
          color: isActive ? '#1e40af' : '#475569',
          cursor: 'pointer',
          fontWeight: isActive ? 600 : 400,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          maxWidth: 260,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerLabel}</span>
        <span style={{ fontSize: '0.55rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 200,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: 170,
          maxHeight: 260,
          overflowY: 'auto',
          padding: '0.25rem 0',
        }}>
          <button onClick={() => { onClear(); setOpen(false); }} style={ddItemStyle(selected.length === 0)}>
            All
          </button>
          {options.map(opt => (
            <button key={opt.key} onClick={() => onToggle(opt.key)} style={ddItemStyle(selected.includes(opt.key))}>
              {opt.color && (
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
              )}
              <span style={{ flex: 1 }}>{opt.label}</span>
              {selected.includes(opt.key) && <span style={{ color: '#2563eb', fontSize: '0.75rem' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ddItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  width: '100%',
  padding: '0.38rem 0.75rem',
  border: 'none',
  background: active ? '#eff6ff' : 'transparent',
  color: active ? '#1e40af' : '#374151',
  fontSize: '0.78rem',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  textAlign: 'left',
});

const Kpi: React.FC<{ label: string; value: string; color: string; bold?: boolean }> = ({ label, value, color, bold }) => (
  <div>
    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</div>
    <div style={{ fontSize: '1.05rem', fontWeight: bold ? 800 : 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const DetailSection: React.FC<{ title: string; accentColor: string; textColor: string; bgAlt: string; children: React.ReactNode }> = ({
  title, accentColor, children,
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="card" style={{ padding: 0, marginBottom: '0.85rem', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.65rem 0.85rem', background: '#f8fafc', border: 'none', borderBottom: open ? `2px solid ${accentColor}` : 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: accentColor }}>{title}</span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && <div style={{ padding: '0 0 0.5rem 0' }}>{children}</div>}
    </div>
  );
};

const th: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontWeight: 700,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  textAlign: 'right',
  borderBottom: '2px solid #334155',
  whiteSpace: 'nowrap',
};

const dth: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  fontWeight: 700,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  textAlign: 'right',
  color: '#fff',
  borderBottom: '2px solid rgba(255,255,255,0.2)',
  whiteSpace: 'nowrap',
};

const dtd: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  fontSize: '0.76rem',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
};

interface ColDef { key: string; label: string }

const SecuredRow: React.FC<{ p: SecuredProject; columns: ColDef[]; idx: number }> = ({ p, columns, idx }) => {
  const bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
  return (
    <tr style={{ background: bg }}>
      <td style={{ ...dtd, textAlign: 'left', fontWeight: 600, color: '#1e3a5f' }}>{p.contract_number}</td>
      <td style={{ ...dtd, textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</td>
      <td style={{ ...dtd, textAlign: 'left' }}>{p.project_manager_name}</td>
      <td style={{ ...dtd, textAlign: 'center' }}>{p.department_code}</td>
      <td style={{ ...dtd, fontWeight: 600 }}>{fmt(p.backlog)}</td>
      <td style={{ ...dtd, textAlign: 'center' }}>{p.pct_complete}%</td>
      {columns.map(c => <td key={c.key} style={dtd}>{fmt(Math.round(p.monthly[c.key] || 0))}</td>)}
      <td style={{ ...dtd, fontWeight: 700, borderLeft: '2px solid #cbd5e1' }}>{fmt(Math.round(p.total))}</td>
    </tr>
  );
};

const AwardedRow: React.FC<{ p: AwardedProject; columns: ColDef[]; idx: number }> = ({ p, columns, idx }) => {
  const bg = idx % 2 === 0 ? '#fff' : '#f0fdf4';
  return (
    <tr style={{ background: bg }}>
      <td style={{ ...dtd, textAlign: 'left', fontWeight: 600, color: '#065f46', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</td>
      <td style={{ ...dtd, textAlign: 'left' }}>{p.client}</td>
      <td style={{ ...dtd, fontWeight: 600 }}>{fmt(p.estimated_value)}</td>
      {columns.map(c => <td key={c.key} style={dtd}>{fmt(Math.round(p.monthly[c.key] || 0))}</td>)}
      <td style={{ ...dtd, fontWeight: 700, borderLeft: '2px solid #cbd5e1' }}>{fmt(Math.round(p.total))}</td>
    </tr>
  );
};

const PursuitRow: React.FC<{ p: PursuitProject; columns: ColDef[]; idx: number }> = ({ p, columns, idx }) => {
  const bg = idx % 2 === 0 ? '#fff' : '#fffbeb';
  return (
    <tr style={{ background: bg }}>
      <td style={{ ...dtd, textAlign: 'left', fontWeight: 600, color: '#78350f', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</td>
      <td style={{ ...dtd, textAlign: 'left' }}>{p.client}</td>
      <td style={{ ...dtd, textAlign: 'left' }}>{p.stage_name}</td>
      <td style={{ ...dtd, textAlign: 'center' }}>{p.probability_pct}%</td>
      <td style={dtd}>{fmt(p.estimated_value)}</td>
      <td style={{ ...dtd, fontWeight: 600 }}>{fmt(p.weighted_value)}</td>
      {columns.map(c => <td key={c.key} style={dtd}>{fmt(Math.round(p.monthly[c.key] || 0))}</td>)}
      <td style={{ ...dtd, fontWeight: 700, borderLeft: '2px solid #cbd5e1' }}>{fmt(Math.round(p.total))}</td>
    </tr>
  );
};

const SummaryRow: React.FC<{ label: string; values: number[]; total: number; bg: string; color: string; bold?: boolean }> = ({
  label, values, total, bg, color, bold,
}) => (
  <tr style={{ background: bg }}>
    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: bold ? 700 : 600, color, borderBottom: '1px solid #E2E8F0', paddingLeft: '0.85rem' }}>{label}</td>
    {values.map((v, i) => (
      <td key={i} style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color, fontWeight: bold ? 700 : 400, borderBottom: '1px solid #E2E8F0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmt(Math.round(v))}
      </td>
    ))}
    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'right', color, fontWeight: 700, borderBottom: '1px solid #E2E8F0', borderLeft: '2px solid #CBD5E1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {fmt(Math.round(total))}
    </td>
  </tr>
);

export default Rolling12Report;
