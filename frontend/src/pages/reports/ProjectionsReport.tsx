import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  projectionsReportApi,
  ProjectionProjectSection,
  ProjectionRollupRow,
  ProjectionDeltas,
} from '../../services/projectionsReport';
import { teamsApi } from '../../services/teams';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';

const fmt = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const fmtSigned = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n) || n === 0) return '-';
  const f = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n));
  return n > 0 ? `+${f}` : `(${f})`;
};

const fmtPct = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return `${(n * 100).toFixed(1)}%`;
};

const fmtPctSigned = (v: number | null | undefined): string => {
  if (v === null || v === undefined || v === 0) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(2)}%`;
};

const fmtNum = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};

const fmtNumSigned = (v: number | null | undefined): string => {
  if (v === null || v === undefined || v === 0) return '-';
  const f = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(v));
  return v > 0 ? `+${f}` : `-${f}`;
};

// For most fields, positive change is good (revenue up, margin up, etc.).
// For COST fields, positive change is bad. This helper returns colors for the
// "good is green" interpretation.
const goodColor = (v: number | null | undefined): string | undefined => {
  if (!v) return undefined;
  return v > 0 ? '#10b981' : '#ef4444';
};

// For cost fields: bad is positive (cost went up), good is negative
const costColor = (v: number | null | undefined): string | undefined => {
  if (!v) return undefined;
  return v > 0 ? '#ef4444' : '#10b981';
};

const ProjectionsReport: React.FC = () => {
  const [pmFilter, setPmFilter] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const [teamFilter, setTeamFilter] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [view, setView] = useState<'projects' | 'pm' | 'department'>('projects');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const teamFilterArr = useMemo(() => Array.from(teamFilter), [teamFilter]);

  const { data: filters } = useQuery({
    queryKey: ['projectionsReportFilters', teamFilterArr],
    queryFn: () => projectionsReportApi.getFilters(teamFilterArr).then(r => r.data),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll().then(r => r.data.data.filter(t => t.is_active)),
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['projectionsReport', Array.from(pmFilter), Array.from(deptFilter), Array.from(teamFilter), startDate, endDate],
    queryFn: () => projectionsReportApi.get({
      pm_employee_no: Array.from(pmFilter),
      department_code: Array.from(deptFilter),
      team_id: Array.from(teamFilter),
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }).then(r => r.data),
  });

  // When the team filter changes, any PM/Dept selections that no longer
  // appear in the team-filtered option list should be pruned so the visible
  // filter state matches the actual query.
  useEffect(() => {
    if (!filters) return;
    const pmSet = new Set(filters.pms.map(pm => pm.employee_no));
    setPmFilter(prev => {
      const next = new Set(Array.from(prev).filter(no => pmSet.has(no)));
      return next.size === prev.size ? prev : next;
    });
    const deptSet = new Set(filters.departments.map(d => d.code));
    setDeptFilter(prev => {
      const next = new Set(Array.from(prev).filter(code => deptSet.has(code)));
      return next.size === prev.size ? prev : next;
    });
  }, [filters]);

  const teamOptions = useMemo(
    () => teams.map(t => ({ value: t.id, label: t.name })),
    [teams]
  );
  const pmOptions = useMemo(
    () => (filters?.pms ?? []).map(pm => ({
      value: pm.employee_no,
      label: pm.name || pm.employee_no,
    })),
    [filters]
  );
  const deptOptions = useMemo(
    () => (filters?.departments ?? []).map(d => ({
      value: d.code,
      label: d.name || d.code,
    })),
    [filters]
  );

  // Aggregate totals shown in the header
  const totals = useMemo(() => {
    if (!report) return null;
    let revDelta = 0, costDelta = 0, gpDelta = 0, openTasks = 0, netGF = 0, unrecGF = 0;
    for (const p of report.projects) {
      if (p.deltas) {
        revDelta += p.deltas.projected_revenue;
        costDelta += p.deltas.projected_cost;
        gpDelta += p.deltas.gross_profit_dollars;
      }
      openTasks += p.open_tasks;
      netGF += p.gain_fade.totals.net;
      unrecGF += p.gain_fade.totals.unrecognized;
    }
    return { revDelta, costDelta, gpDelta, openTasks, netGF, unrecGF, projectCount: report.projects.length };
  }, [report]);

  return (
    <div style={{ padding: '1rem 1.5rem' }}>
      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <Link to="/reports" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>&larr; Reports</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', color: '#1e293b' }}>Monthly Projections Report</h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Snapshot-to-snapshot deltas, notes, tasks, and gain/fade tracking per project.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
          <button
            onClick={async () => {
              setPdfError(null);
              setPdfLoading(true);
              try {
                await projectionsReportApi.downloadPdf({
                  pm_employee_no: Array.from(pmFilter),
                  department_code: Array.from(deptFilter),
                  team_id: Array.from(teamFilter),
                  start_date: startDate || undefined,
                  end_date: endDate || undefined,
                });
              } catch (e: any) {
                setPdfError(e?.response?.data?.error || e?.message || 'PDF export failed');
              } finally {
                setPdfLoading(false);
              }
            }}
            className="btn btn-primary"
            disabled={pdfLoading}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {pdfLoading ? 'Generating PDF…' : 'Export PDF'}
          </button>
          {pdfError && <div style={{ fontSize: '0.7rem', color: '#b91c1c', maxWidth: '260px', textAlign: 'right' }}>{pdfError}</div>}
        </div>
      </div>

      {/* FILTERS */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div>
            <div style={filterLabel}>Teams</div>
            <MultiSearchableSelect
              options={teamOptions}
              value={Array.from(teamFilter).map(String)}
              onChange={(vals) => setTeamFilter(new Set(vals.map(Number)))}
              placeholder={teams.length ? 'All teams' : 'No teams defined'}
              disabled={!teams.length}
            />
          </div>
          <div>
            <div style={filterLabel}>Project Managers</div>
            <MultiSearchableSelect
              options={pmOptions}
              value={Array.from(pmFilter)}
              onChange={(vals) => setPmFilter(new Set(vals))}
              placeholder={pmOptions.length ? 'All PMs' : 'No PMs in snapshots yet'}
              disabled={!pmOptions.length}
            />
          </div>
          <div>
            <div style={filterLabel}>Departments</div>
            <MultiSearchableSelect
              options={deptOptions}
              value={Array.from(deptFilter)}
              onChange={(vals) => setDeptFilter(new Set(vals))}
              placeholder={deptOptions.length ? 'All departments' : 'No departments in snapshots yet'}
              disabled={!deptOptions.length}
            />
          </div>
          <div>
            <div style={filterLabel}>Compare Snapshots</div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={dateInputStyle} title="Prior — snaps to nearest snapshot" />
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={dateInputStyle} title="Current — snaps to nearest snapshot" />
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
              Dates snap to the nearest snapshot per project.
            </div>
          </div>
        </div>
      </div>

      {/* PORTFOLIO HEADER */}
      {totals && (
        <div className="card" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <Kpi label="Projects" value={String(totals.projectCount)} />
            <Kpi label="Revenue Δ" value={fmtSigned(totals.revDelta)} color={goodColor(totals.revDelta)} />
            <Kpi label="Proj Cost Δ" value={fmtSigned(totals.costDelta)} color={costColor(totals.costDelta)} />
            <Kpi label="Gross Profit Δ" value={fmtSigned(totals.gpDelta)} color={goodColor(totals.gpDelta)} />
            <Kpi label="Open Tasks" value={String(totals.openTasks)} color={totals.openTasks > 0 ? '#b45309' : undefined} />
            <Kpi label="Net Gain/Fade" value={fmtSigned(totals.netGF)} color={goodColor(totals.netGF)} />
            <Kpi label="Unrecognized G/F" value={fmtSigned(totals.unrecGF)} color={totals.unrecGF !== 0 ? '#b45309' : undefined} />
          </div>
        </div>
      )}

      {/* VIEW SWITCH */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem' }}>
        {(['projects', 'pm', 'department'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={pillStyle(view === v)}>
            {v === 'projects' ? 'By Project' : v === 'pm' ? 'Roll-up by PM' : 'Roll-up by Department'}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}

      {report && !isLoading && view === 'projects' && (
        report.projects.length === 0 ? (
          <EmptyReport />
        ) : (
          report.projects.map(p => <ProjectSection key={p.project_id} project={p} />)
        )
      )}

      {report && !isLoading && view === 'pm' && (
        <RollupTable rows={report.rollup_by_pm} headerLabel="Project Manager" />
      )}

      {report && !isLoading && view === 'department' && (
        <RollupTable rows={report.rollup_by_department} headerLabel="Department" />
      )}
    </div>
  );
};

const pillStyle = (on: boolean): React.CSSProperties => ({
  fontSize: '0.7rem', padding: '0.25rem 0.55rem', borderRadius: '999px',
  border: on ? '2px solid #2563eb' : '1px solid #cbd5e1',
  background: on ? '#eff6ff' : '#fff',
  color: on ? '#1e40af' : '#475569',
  cursor: 'pointer', fontWeight: on ? 600 : 400,
});

const dateInputStyle: React.CSSProperties = {
  fontSize: '0.8rem', padding: '0.25rem 0.4rem',
  border: '1px solid #cbd5e1', borderRadius: '4px',
};

const filterLabel: React.CSSProperties = {
  fontSize: '0.7rem', fontWeight: 700, color: '#475569',
  textTransform: 'uppercase', marginBottom: '0.3rem',
};

const Kpi: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '1rem', fontWeight: 700, color: color || '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const EmptyReport: React.FC = () => (
  <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
    No snapshots in the selected range. Capture snapshots on the project financials page to populate this report.
  </div>
);

const numv = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

const ALL_METRICS: { label: string; key: keyof typeof EMPTY_DELTAS; kind: 'money' | 'pct' | 'num'; costSign?: boolean }[] = [
  { label: 'Contract Amount', key: 'contract_amount', kind: 'money' },
  { label: 'Approved Changes', key: 'approved_changes', kind: 'money' },
  { label: 'Pending Change Orders', key: 'pending_change_orders', kind: 'money' },
  { label: 'Projected Revenue', key: 'projected_revenue', kind: 'money' },
  { label: 'Earned Revenue', key: 'earned_revenue', kind: 'money' },
  { label: 'Backlog', key: 'backlog', kind: 'money' },
  { label: '% Complete', key: 'percent_complete', kind: 'pct' },
  { label: 'Projected Cost @ Completion', key: 'projected_cost', kind: 'money', costSign: true },
  { label: 'Current Est Cost', key: 'current_est_cost', kind: 'money', costSign: true },
  { label: 'Gross Profit $', key: 'gross_profit_dollars', kind: 'money' },
  { label: 'Gross Profit %', key: 'gross_profit_percent', kind: 'pct' },
  { label: 'Billed', key: 'billed_amount', kind: 'money' },
  { label: 'Open Receivables', key: 'open_receivables', kind: 'money' },
  { label: 'Cash Flow', key: 'cash_flow', kind: 'money' },
  { label: 'Total Hours JTD', key: 'total_hours_jtd', kind: 'num' },
  { label: 'Total Hours Projected', key: 'total_hours_projected', kind: 'num', costSign: true },
  { label: 'Actual Labor Rate', key: 'actual_labor_rate', kind: 'money', costSign: true },
];

const EMPTY_DELTAS = {
  orig_contract_amount: 0, contract_amount: 0, approved_changes: 0,
  pending_change_orders: 0, projected_revenue: 0, earned_revenue: 0,
  backlog: 0, percent_complete: 0, gross_profit_dollars: 0,
  gross_profit_percent: 0, billed_amount: 0, received_amount: 0,
  open_receivables: 0, cash_flow: 0, projected_cost: 0,
  current_est_cost: 0, actual_cost: 0, total_hours_jtd: 0,
  total_hours_projected: 0, actual_labor_rate: 0,
};

const ProjectSection: React.FC<{ project: ProjectionProjectSection }> = ({ project: p }) => {
  const cur = p.current_snapshot;
  const prior = p.prior_snapshot;
  const d = p.deltas;
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  const visibleMetrics = useMemo(() => {
    return ALL_METRICS.filter(m => {
      if (showAllMetrics) return true;
      const curV = numv(cur[m.key as keyof typeof cur]);
      const priorV = prior ? numv(prior[m.key as keyof typeof prior]) : 0;
      const dV = d ? d[m.key] : 0;
      // Hide if delta is zero AND both prior and current are zero/null.
      // Without a prior snapshot, show any non-zero current value.
      if (dV !== 0) return true;
      if (curV !== 0 || priorV !== 0) return !prior;
      return false;
    });
  }, [cur, prior, d, showAllMetrics]);

  const hiddenCount = ALL_METRICS.length - visibleMetrics.length;
  const hasAnyNotes = p.notes.length > 0 || p.tasks.length > 0 || p.gain_fade.items.length > 0;

  return (
    <div className="card" style={{ padding: '0.85rem', marginBottom: '0.75rem' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.6rem' }}>
        <Link to={`/projects/${p.project_id}/financials`}
          style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', textDecoration: 'none' }}>
          {p.project_number} — {p.project_name}
        </Link>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
          <strong>PM:</strong> {p.pm_name || '—'}{' '}
          {p.department_name && <> · <strong>Dept:</strong> {p.department_name}</>}
        </div>
        {!prior && (
          <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '0.2rem' }}>
            No prior snapshot — first projection for this project.
          </div>
        )}
      </div>

      {/* Financials Delta Table */}
      {visibleMetrics.length > 0 ? (
        <div style={{ overflowX: 'auto', marginBottom: '0.4rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...th, textAlign: 'left' }}>Metric</th>
                <th style={th}>
                  Prior
                  <div style={dateSubhead}>
                    {prior ? format(new Date(prior.snapshot_date), 'MMM d, yyyy') : '—'}
                  </div>
                </th>
                <th style={th}>
                  Current
                  <div style={dateSubhead}>
                    {format(new Date(cur.snapshot_date), 'MMM d, yyyy')}
                  </div>
                </th>
                <th style={th}>Change</th>
              </tr>
            </thead>
            <tbody>
              {visibleMetrics.map(m => (
                <MetricRow
                  key={m.key}
                  label={m.label}
                  cur={cur[m.key as keyof typeof cur] as any}
                  prior={prior ? prior[m.key as keyof typeof prior] as any : undefined}
                  d={d ? d[m.key] : null}
                  kind={m.kind}
                  costSign={m.costSign}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !hasAnyNotes && (
          <div style={{ padding: '0.5rem 0', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
            No financial changes in this projection cycle.
          </div>
        )
      )}

      {/* Show-all toggle / hidden count */}
      {hiddenCount > 0 && (
        <div style={{ marginBottom: '0.6rem' }}>
          <button
            onClick={() => setShowAllMetrics(!showAllMetrics)}
            style={{
              fontSize: '0.7rem', color: '#3b82f6', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, textDecoration: 'underline',
            }}
          >
            {showAllMetrics
              ? `Hide unchanged metrics`
              : `Show ${hiddenCount} unchanged metric${hiddenCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {/* Three-column body: Notes / Tasks / Gain-Fade */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem' }}>
        <SubCard title="Notes" count={p.notes.length}>
          {p.notes.length === 0 ? <Empty /> : p.notes.map(n => (
            <div key={n.id} style={noteRow}>
              {n.category && <Pill text={n.category} color="#0369a1" bg="#e0f2fe" border="#bae6fd" />}
              <div style={{ fontSize: '0.78rem', color: '#1e293b', whiteSpace: 'pre-wrap', marginTop: '0.15rem' }}>{n.body}</div>
              <div style={metaText}>{n.created_by_name} · {format(new Date(n.created_at), 'MMM d')}</div>
            </div>
          ))}
        </SubCard>

        <SubCard title={`Tasks (${p.tasks.filter(t => t.status === 'open').length} open)`} count={p.tasks.length}>
          {p.tasks.length === 0 ? <Empty /> : p.tasks.map(t => {
            const done = t.status === 'done';
            return (
              <div key={t.id} style={noteRow}>
                <div style={{
                  fontSize: '0.78rem', color: '#1e293b', whiteSpace: 'pre-wrap',
                  textDecoration: done ? 'line-through' : 'none',
                  opacity: done ? 0.55 : 1,
                }}>
                  {done && <Pill text="Done" color="#15803d" bg="#dcfce7" border="#86efac" />}
                  {!done && <Pill text="Open" color="#b45309" bg="#fef3c7" border="#fde68a" />}{' '}
                  {t.body}
                </div>
                <div style={metaText}>
                  {t.assigned_to_name && <>👤 {t.assigned_to_name} · </>}
                  {t.due_date && <>📅 {format(new Date(t.due_date), 'MMM d')} · </>}
                  {t.created_by_name}
                </div>
              </div>
            );
          })}
        </SubCard>

        <SubCard title="Gain / Fade" count={p.gain_fade.items.length}>
          {p.gain_fade.items.length === 0 ? <Empty /> : (
            <>
              {p.gain_fade.items.map(g => {
                const v = typeof g.amount === 'string' ? parseFloat(g.amount) : (g.amount || 0);
                return (
                  <div key={g.id} style={noteRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ flex: 1, fontSize: '0.78rem', color: '#1e293b' }}>{g.body}</div>
                      <div style={{ fontWeight: 600, color: v >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtSigned(v)}
                      </div>
                    </div>
                    <div style={metaText}>
                      {g.groups_affected && g.groups_affected.length > 0 && (
                        <span>{g.groups_affected.join(', ')} · </span>
                      )}
                      {g.recognized_in_financials ? <span style={{ color: '#15803d' }}>Recognized</span> : <span style={{ color: '#b45309' }}>Unrecognized</span>}
                    </div>
                  </div>
                );
              })}
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                <TotalLine label="Gain" value={p.gain_fade.totals.gain} positive />
                <TotalLine label="Fade" value={p.gain_fade.totals.fade} />
                <TotalLine label="Net" value={p.gain_fade.totals.net} bold />
                <TotalLine label="Unrecognized" value={p.gain_fade.totals.unrecognized} muted />
              </div>
            </>
          )}
        </SubCard>
      </div>
    </div>
  );
};

const MetricRow: React.FC<{
  label: string;
  cur: number | string | null | undefined;
  prior: number | string | null | undefined;
  d: number | undefined | null;
  kind: 'money' | 'pct' | 'num';
  costSign?: boolean;
}> = ({ label, cur, prior, d, kind, costSign }) => {
  const fmtVal = (v: any) => kind === 'money' ? fmt(v) : kind === 'pct' ? fmtPct(v) : fmtNum(v);
  const fmtD = (v: any) => kind === 'money' ? fmtSigned(v) : kind === 'pct' ? fmtPctSigned(v) : fmtNumSigned(v);
  const color = costSign ? costColor(d || 0) : goodColor(d || 0);
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ ...td, textAlign: 'left', color: '#475569' }}>{label}</td>
      <td style={td}>{fmtVal(prior)}</td>
      <td style={{ ...td, fontWeight: 600 }}>{fmtVal(cur)}</td>
      <td style={{ ...td, color, fontWeight: 600 }}>{d != null ? fmtD(d) : '-'}</td>
    </tr>
  );
};

const SubCard: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <div style={{ background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 0.6rem' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
      {title}{count !== undefined && <span style={{ color: '#94a3b8' }}> ({count})</span>}
    </div>
    {children}
  </div>
);

const Pill: React.FC<{ text: string; color: string; bg: string; border: string }> = ({ text, color, bg, border }) => (
  <span style={{
    fontSize: '0.65rem', color, background: bg, border: `1px solid ${border}`,
    borderRadius: '999px', padding: '0.05rem 0.5rem',
  }}>{text}</span>
);

const TotalLine: React.FC<{ label: string; value: number; bold?: boolean; positive?: boolean; muted?: boolean }> = ({ label, value, bold, muted }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    fontSize: '0.75rem', padding: '0.1rem 0',
    fontWeight: bold ? 700 : 500,
    color: muted ? '#b45309' : (value >= 0 ? '#10b981' : '#ef4444'),
  }}>
    <span style={{ color: muted ? '#b45309' : '#64748b', fontStyle: muted ? 'italic' : 'normal' }}>{label}</span>
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(value)}</span>
  </div>
);

const Empty: React.FC = () => <div style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic' }}>None</div>;

const RollupTable: React.FC<{ rows: ProjectionRollupRow[]; headerLabel: string }> = ({ rows, headerLabel }) => (
  <div className="card" style={{ padding: 0, overflow: 'auto' }}>
    {rows.length === 0 ? (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No data.</div>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ ...th, textAlign: 'left' }}>{headerLabel}</th>
            <th style={th}>Projects</th>
            <th style={th}>Revenue Δ</th>
            <th style={th}>Proj Cost Δ</th>
            <th style={th}>Gross Profit Δ</th>
            <th style={th}>Open Tasks</th>
            <th style={th}>Net Gain/Fade</th>
            <th style={th}>Unrecognized G/F</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{r.name}</td>
              <td style={td}>{r.project_count}</td>
              <td style={{ ...td, color: goodColor(r.revenue_delta) }}>{fmtSigned(r.revenue_delta)}</td>
              <td style={{ ...td, color: costColor(r.projected_cost_delta) }}>{fmtSigned(r.projected_cost_delta)}</td>
              <td style={{ ...td, color: goodColor(r.gross_profit_delta) }}>{fmtSigned(r.gross_profit_delta)}</td>
              <td style={{ ...td, color: r.open_tasks > 0 ? '#b45309' : undefined }}>{r.open_tasks}</td>
              <td style={{ ...td, color: goodColor(r.net_gain_fade) }}>{fmtSigned(r.net_gain_fade)}</td>
              <td style={{ ...td, color: r.unrecognized_gain_fade !== 0 ? '#b45309' : undefined }}>{fmtSigned(r.unrecognized_gain_fade)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const th: React.CSSProperties = {
  textAlign: 'right', padding: '0.4rem 0.6rem', fontSize: '0.7rem',
  fontWeight: 700, color: '#475569', textTransform: 'uppercase',
  borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  textAlign: 'right', padding: '0.4rem 0.6rem', fontSize: '0.78rem',
  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
};

const noteRow: React.CSSProperties = {
  padding: '0.35rem 0', borderBottom: '1px solid #f1f5f9',
};

const dateSubhead: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 500, color: '#475569',
  textTransform: 'none', marginTop: '0.15rem',
  letterSpacing: 'normal',
};

const metaText: React.CSSProperties = {
  fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem',
};

export default ProjectionsReport;
