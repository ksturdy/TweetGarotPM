import React, { useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  gcSchedulesApi,
  GCScheduleVersion,
  GCScheduleActivity,
  ActivityFilters,
} from '../../services/gcSchedules';
import { projectsApi } from '../../services/projects';
import '../../styles/SalesPipeline.css';

const fmtDate = (s: string | null): string => {
  if (!s) return '-';
  // API returns dates either as bare YYYY-MM-DD or as full ISO timestamps
  // (Postgres DATE columns serialize as ISO via JSON). Normalize to a local
  // calendar date so a 2026-03-11 row doesn't drift to 2026-03-10 in CT.
  const isoDate = s.length >= 10 ? s.slice(0, 10) : s;
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'MMM d, yyyy');
};

const daysBetween = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const da = new Date(a.slice(0, 10) + 'T00:00:00').getTime();
  const db = new Date(b.slice(0, 10) + 'T00:00:00').getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
};

// Renders the "What changed" cell as a verdict-first list:
//   "Finish Date  Delayed by 7 days     (Mar 26, 2026 → Apr 2, 2026)"
// The verdict is bold and colored; the values are muted context. Reads the
// delta metadata the backend attaches to each diff so we don't have to
// re-compute days/points on the client.
const renderChangeLines = (diffs: Record<string, any>): React.ReactNode => {
  const order = ['start', 'finish', 'duration', 'percent', 'name'];
  const keys = Object.keys(diffs).sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const days = (n: number) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;

  const row = (label: string, verdict: string, color: string, context: React.ReactNode) => (
    <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', columnGap: 10, alignItems: 'baseline', padding: '1px 0' }}>
      <strong style={{ color: '#374151' }}>{label}</strong>
      <span>
        <span style={{ color, fontWeight: 600 }}>{verdict}</span>
        <span style={{ color: '#9ca3af', marginLeft: 8 }}>{context}</span>
      </span>
    </div>
  );

  const dateRow = (label: string, v: any) => {
    const d: number | null = v.deltaDays;
    let verdict = '—'; let color = '#6b7280';
    if (d != null) {
      if (d > 0) { verdict = `Delayed by ${days(d)}`; color = '#dc2626'; }
      else if (d < 0) { verdict = `Earlier by ${days(d)}`; color = '#16a34a'; }
      else verdict = 'No change';
    } else if (!v.from && v.to) { verdict = 'Date set'; color = '#16a34a'; }
    else if (v.from && !v.to) { verdict = 'Date cleared'; color = '#dc2626'; }
    return row(label, verdict, color, <>({fmtDate(v.from)} → {fmtDate(v.to)})</>);
  };

  const durRow = (v: any) => {
    const d: number | null = v.deltaDays;
    let verdict = '—'; let color = '#6b7280';
    if (d != null) {
      if (d > 0) { verdict = `Increased by ${days(d)}`; color = '#dc2626'; }
      else if (d < 0) { verdict = `Decreased by ${days(d)}`; color = '#16a34a'; }
      else verdict = 'No change';
    } else if (v.from == null && v.to != null) verdict = 'Set';
    else if (v.from != null && v.to == null) verdict = 'Cleared';
    return row('Duration', verdict, color, <>({v.from ?? '-'} → {v.to ?? '-'} days)</>);
  };

  const pctRow = (v: any) => {
    const d: number | null = v.deltaPoints;
    let verdict = '—'; let color = '#6b7280';
    if (d != null) {
      if (d > 0) { verdict = `Increased by ${Math.abs(d)} pts`; color = '#16a34a'; }
      else if (d < 0) { verdict = `Decreased by ${Math.abs(d)} pts`; color = '#dc2626'; }
      else verdict = 'No change';
    }
    return row('% Complete', verdict, color, <>({v.from ?? '-'}% → {v.to ?? '-'}%)</>);
  };

  return keys.map((k) => {
    const v = diffs[k];
    if (k === 'start') return dateRow('Start Date', v);
    if (k === 'finish') return dateRow('Finish Date', v);
    if (k === 'duration') return durRow(v);
    if (k === 'percent') return pctRow(v);
    if (k === 'name') return row('Name', 'Renamed', '#6b7280', <>("{String(v.from ?? '')}" → "{String(v.to ?? '')}")</>);
    return null;
  });
};

const fmtTimestamp = (s: string | null | undefined): string => {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'MMM d, yyyy h:mm a');
};

const formatLabel: Record<string, string> = {
  xlsx: 'Excel',
  csv: 'CSV',
  xer: 'Primavera XER',
  pdf: 'PDF',
  mspxml: 'MS Project XML',
};

// Match the Titan/Stratus table density: 13px font, 6px/10px cell padding.
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'white' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' };

const GCScheduleView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const queryClient = useQueryClient();

  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapsed = (displayOrder: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(displayOrder)) next.delete(displayOrder);
      else next.add(displayOrder);
      return next;
    });
  };
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [filters, setFilters] = useState<ActivityFilters>({ mechanicalOnly: false, hideSummary: false });
  const [searchInput, setSearchInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffA, setDiffA] = useState<number | null>(null);
  const [diffB, setDiffB] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getById(pid).then((r) => r.data),
  });

  const versionsQuery = useQuery({
    queryKey: ['gc-schedule-versions', pid],
    queryFn: () => gcSchedulesApi.listVersions(pid).then((r) => r.data),
  });

  const versions = versionsQuery.data || [];

  // Auto-select latest version
  const effectiveVersionId = useMemo(() => {
    if (selectedVersionId) return selectedVersionId;
    if (versions.length) return versions[0].id;
    return null;
  }, [selectedVersionId, versions]);

  const activitiesQuery = useQuery({
    queryKey: ['gc-schedule-activities', effectiveVersionId, filters],
    queryFn: () =>
      gcSchedulesApi.getActivities(effectiveVersionId!, filters).then((r) => r.data),
    enabled: !!effectiveVersionId,
  });

  const diffQuery = useQuery({
    queryKey: ['gc-schedule-diff', pid, diffA, diffB],
    queryFn: () => gcSchedulesApi.diff(pid, diffA!, diffB!).then((r) => r.data),
    enabled: diffOpen && !!diffA && !!diffB && diffA !== diffB,
  });

  const toggleMech = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) =>
      gcSchedulesApi.toggleMechanical(id, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-activities'] });
    },
  });

  const bulkMech = useMutation({
    mutationFn: ({ ids, on }: { ids: number[]; on: boolean }) =>
      gcSchedulesApi.bulkSetMechanical(ids, on),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-activities'] });
    },
  });

  const deleteVersion = useMutation({
    mutationFn: (id: number) => gcSchedulesApi.deleteVersion(id),
    onSuccess: () => {
      setSelectedVersionId(null);
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-versions', pid] });
    },
  });

  const activities = activitiesQuery.data?.activities || [];
  const currentVersion = activitiesQuery.data?.version;

  const stats = useMemo(() => {
    const total = activities.length;
    const mech = activities.filter((a) => a.is_mechanical).length;
    const milestones = activities.filter((a) => a.is_milestone).length;
    const earliest = activities.reduce<string | null>((min, a) => {
      if (!a.start_date) return min;
      if (!min || a.start_date < min) return a.start_date;
      return min;
    }, null);
    const latest = activities.reduce<string | null>((max, a) => {
      if (!a.finish_date) return max;
      if (!max || a.finish_date > max) return a.finish_date;
      return max;
    }, null);
    return { total, mech, milestones, earliest, latest };
  }, [activities]);

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link
              to={`/projects/${pid}`}
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; Back to Project
            </Link>
            <h1>📋 GC Schedule</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - GC Schedule Versions</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to={`/projects/${pid}/schedule`} className="btn btn-secondary">
            Internal Schedule
          </Link>
          <button
            className="btn btn-secondary"
            disabled={versions.length < 2}
            onClick={() => {
              setDiffOpen((v) => !v);
              if (!diffOpen && versions.length >= 2) {
                setDiffA(versions[1].id);
                setDiffB(versions[0].id);
              }
            }}
          >
            Compare Versions
          </button>
          <button className="btn btn-primary" onClick={() => setUploadOpen((v) => !v)}>
            {uploadOpen ? 'Cancel Upload' : 'Upload Schedule'}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Parser warnings</h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {warnings.map((w, i) => <li key={i} style={{ fontSize: '0.875rem' }}>{w}</li>)}
          </ul>
          <button className="btn btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setWarnings([])}>Dismiss</button>
        </div>
      )}

      {uploadOpen && (
        <UploadCard
          projectId={pid}
          onUploaded={(warns) => {
            setWarnings(warns || []);
            setUploadOpen(false);
            queryClient.invalidateQueries({ queryKey: ['gc-schedule-versions', pid] });
          }}
        />
      )}

      {versions.length > 0 ? (
        <div className="card" style={{ marginBottom: '0.75rem', padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                Version
              </label>
              <select
                value={effectiveVersionId || ''}
                onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                style={{ minWidth: 280, padding: '4px 6px', fontSize: 13 }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {versionDisplay(v)}
                  </option>
                ))}
              </select>
            </div>
            {currentVersion && (
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <Stat label="Format" value={formatLabel[currentVersion.source_format] || currentVersion.source_format} />
                <Stat label="Activities" value={currentVersion.activity_count.toString()} />
                <Stat label="Mechanical" value={stats.mech.toString()} />
                <Stat label="Date Range" value={
                  stats.earliest && stats.latest ? `${fmtDate(stats.earliest)} → ${fmtDate(stats.latest)}` : '-'
                } />
                <Stat label="Uploaded" value={fmtTimestamp(currentVersion.uploaded_at)} />
                <Stat label="By" value={currentVersion.uploaded_by_name || '-'} />
              </div>
            )}
            {currentVersion && (
              <button
                className="btn btn-danger btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  if (window.confirm(`Delete this version (${currentVersion.activity_count} activities)?`)) {
                    deleteVersion.mutate(currentVersion.id);
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : !versionsQuery.isLoading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary)' }}>
          <h3>No schedules uploaded yet</h3>
          <p>Upload a GC schedule (Excel, CSV, Primavera XER, or PDF) to get started.</p>
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
            Upload Your First Schedule
          </button>
        </div>
      )}

      {diffOpen && versions.length >= 2 && (
        <DiffCard
          projectId={pid}
          versions={versions}
          a={diffA}
          b={diffB}
          onChangeA={setDiffA}
          onChangeB={setDiffB}
          data={diffQuery.data}
          loading={diffQuery.isLoading}
        />
      )}

      {effectiveVersionId && !diffOpen && (
        <>
          <div className="card" style={{ marginBottom: '0.75rem', padding: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input
                type="text"
                placeholder="Search activities, IDs, WBS, responsible..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setFilters((f) => ({ ...f, search: searchInput }));
                }}
                style={{ flex: 1, minWidth: 220, padding: '4px 8px', fontSize: 13 }}
              />
              <button
                className="btn btn-sm"
                onClick={() => setFilters((f) => ({ ...f, search: searchInput }))}
              >
                Search
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={!!filters.mechanicalOnly}
                  onChange={(e) => setFilters((f) => ({ ...f, mechanicalOnly: e.target.checked }))}
                />
                Mechanical only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={!!filters.hideSummary}
                  onChange={(e) => setFilters((f) => ({ ...f, hideSummary: e.target.checked }))}
                />
                Hide summary rows
              </label>
              <select
                value={filters.trade || ''}
                onChange={(e) => setFilters((f) => ({ ...f, trade: e.target.value || undefined }))}
                style={{ padding: '4px 6px', fontSize: 13 }}
              >
                <option value="">All trades</option>
                <option value="mechanical">Mechanical</option>
                <option value="electrical">Electrical</option>
                <option value="plumbing">Plumbing</option>
                <option value="sprinkler">Sprinkler</option>
                <option value="controls">Controls</option>
              </select>
            </div>
          </div>

          <div className="card" style={{ overflow: 'auto', padding: 0, maxHeight: 'calc(100vh - 320px)' }}>
            {selectedIds.size > 0 && (
              <div style={{
                display: 'flex', gap: 8, padding: '8px 12px',
                background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
                fontSize: 13, alignItems: 'center', position: 'sticky', top: 0, zIndex: 2,
              }}>
                <strong style={{ color: '#1e40af' }}>{selectedIds.size} selected</strong>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={bulkMech.isPending}
                  onClick={() => bulkMech.mutate({ ids: Array.from(selectedIds), on: true })}
                >
                  Mark Mechanical
                </button>
                <button
                  className="btn btn-sm"
                  disabled={bulkMech.isPending}
                  onClick={() => bulkMech.mutate({ ids: Array.from(selectedIds), on: false })}
                >
                  Mark Not Mechanical
                </button>
                <button className="btn btn-sm" onClick={() => setSelectedIds(new Set())}>
                  Clear selection
                </button>
              </div>
            )}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32, textAlign: 'center', padding: '4px 6px' }} title="Expand / collapse all">
                    <button
                      onClick={() => {
                        const allSummaries = activities.filter((a) => a.is_summary).map((a) => a.display_order);
                        const anyExpanded = allSummaries.some((d) => !collapsed.has(d));
                        setCollapsed(anyExpanded ? new Set(allSummaries) : new Set());
                      }}
                      style={{
                        background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 3,
                        padding: '0 6px', height: 18, cursor: 'pointer', fontSize: 11, color: '#475569',
                      }}
                      title="Toggle expand / collapse all sections"
                    >
                      {(() => {
                        const allSummaries = activities.filter((a) => a.is_summary).map((a) => a.display_order);
                        const anyExpanded = allSummaries.some((d) => !collapsed.has(d));
                        return anyExpanded ? '−' : '+';
                      })()}
                    </button>
                  </th>
                  <th style={{ ...thStyle, width: 28, textAlign: 'center', padding: '4px 6px' }}>
                    <input
                      type="checkbox"
                      checked={
                        activities.filter((a) => !a.is_summary).length > 0 &&
                        activities.filter((a) => !a.is_summary).every((a) => selectedIds.has(a.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(activities.filter((a) => !a.is_summary).map((a) => a.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      title="Select all visible tasks"
                    />
                  </th>
                  <th style={thStyle}>Activity ID</th>
                  <th style={thStyle}>Activity Name</th>
                  <th style={thStyle}>Start</th>
                  <th style={thStyle}>Finish</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Dur</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>% Comp</th>
                  <th style={thStyle}>Responsible</th>
                </tr>
              </thead>
              <tbody>
                {activitiesQuery.isLoading && (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '1.5rem' }}>Loading…</td></tr>
                )}
                {!activitiesQuery.isLoading && activities.length === 0 && (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No activities match the filters.</td></tr>
                )}
                {renderTreeRows({
                  activities,
                  collapsed,
                  selectedIds,
                  onToggleCollapsed: toggleCollapsed,
                  onToggleSelected: toggleSelected,
                  onToggleMech: (id, on) => toggleMech.mutate({ id, on }),
                  onSelectChildren: (parentOrder, on) => {
                    const childIds = activities
                      .filter((a) => !a.is_summary && a.parent_summary_order === parentOrder)
                      .map((a) => a.id);
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (on) childIds.forEach((id) => next.add(id));
                      else childIds.forEach((id) => next.delete(id));
                      return next;
                    });
                  },
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const versionDisplay = (v: GCScheduleVersion): string => {
  const label = v.version_label || v.source_filename || `Version ${v.id}`;
  const date = v.schedule_date
    ? ` (${fmtDate(v.schedule_date)})`
    : ` (uploaded ${format(new Date(v.uploaded_at), 'M/d/yy')})`;
  return `${label}${date} — ${v.activity_count} activities`;
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</div>
  </div>
);

// Render the activity list as a 2-level tree. Summary rows are clickable
// chevron headers; tasks under a collapsed header are skipped. Empty
// summaries (no children visible after filter) are also skipped so the
// table doesn't have orphaned headers.
const renderTreeRows = ({
  activities,
  collapsed,
  selectedIds,
  onToggleCollapsed,
  onToggleSelected,
  onToggleMech,
  onSelectChildren,
}: {
  activities: GCScheduleActivity[];
  collapsed: Set<number>;
  selectedIds: Set<number>;
  onToggleCollapsed: (displayOrder: number) => void;
  onToggleSelected: (id: number) => void;
  onToggleMech: (activityId: number, on: boolean) => void;
  onSelectChildren: (parentOrder: number, on: boolean) => void;
}): React.ReactNode => {
  // Pre-count visible children per summary so we can hide empty headers
  // and tell whether the section's children are all/some/none selected.
  const childrenBySummary = new Map<number, GCScheduleActivity[]>();
  for (const a of activities) {
    if (a.is_summary) continue;
    if (a.parent_summary_order != null) {
      const list = childrenBySummary.get(a.parent_summary_order) || [];
      list.push(a);
      childrenBySummary.set(a.parent_summary_order, list);
    }
  }

  const out: React.ReactNode[] = [];
  for (const a of activities) {
    if (a.is_summary) {
      const children = childrenBySummary.get(a.display_order) || [];
      if (children.length === 0) continue;
      const isCollapsed = collapsed.has(a.display_order);
      const allChildrenSelected = children.every((c) => selectedIds.has(c.id));
      const someChildrenSelected = !allChildrenSelected && children.some((c) => selectedIds.has(c.id));
      out.push(
        <SummaryRow
          key={a.id}
          a={a}
          childCount={children.length}
          isCollapsed={isCollapsed}
          allChildrenSelected={allChildrenSelected}
          someChildrenSelected={someChildrenSelected}
          onClick={() => onToggleCollapsed(a.display_order)}
          onSelectChildren={(on) => onSelectChildren(a.display_order, on)}
        />
      );
    } else {
      const parentOrder = a.parent_summary_order;
      if (parentOrder != null && collapsed.has(parentOrder)) continue;
      out.push(
        <TaskRow
          key={a.id}
          a={a}
          isSelected={selectedIds.has(a.id)}
          onToggleSelected={() => onToggleSelected(a.id)}
          onToggleMech={(on) => onToggleMech(a.id, on)}
        />
      );
    }
  }
  return out;
};

const SummaryRow: React.FC<{
  a: GCScheduleActivity;
  childCount: number;
  isCollapsed: boolean;
  allChildrenSelected: boolean;
  someChildrenSelected: boolean;
  onClick: () => void;
  onSelectChildren: (on: boolean) => void;
}> = ({ a, childCount, isCollapsed, allChildrenSelected, someChildrenSelected, onClick, onSelectChildren }) => {
  const checkboxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someChildrenSelected;
  }, [someChildrenSelected]);
  return (
    <tr
      style={{
        background: '#f1f5f9',
        borderTop: '1px solid #e2e8f0',
        fontWeight: 600,
      }}
    >
      <td
        onClick={onClick}
        style={{ ...tdStyle, textAlign: 'center', color: '#475569', userSelect: 'none', padding: '6px 4px', cursor: 'pointer' }}
      >
        {isCollapsed ? '▶' : '▼'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }} onClick={(e) => e.stopPropagation()}>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allChildrenSelected}
          onChange={(e) => onSelectChildren(e.target.checked)}
          title={`Select all ${childCount} task${childCount === 1 ? '' : 's'} in this section`}
        />
      </td>
      <td style={tdStyle} onClick={onClick}></td>
      <td style={{ ...tdStyle, color: '#0f172a', cursor: 'pointer' }} onClick={onClick}>
        {a.activity_name}
        <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 400, fontSize: 11 }}>
          ({childCount} task{childCount === 1 ? '' : 's'})
        </span>
      </td>
      <td style={{ ...tdStyle, color: '#475569', cursor: 'pointer' }} onClick={onClick}>{fmtDate(a.start_date)}</td>
      <td style={{ ...tdStyle, color: '#475569', cursor: 'pointer' }} onClick={onClick}>{fmtDate(a.finish_date)}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: '#475569', cursor: 'pointer' }} onClick={onClick}>
        {a.duration_days ?? daysBetween(a.start_date, a.finish_date) ?? '-'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', color: '#475569', cursor: 'pointer' }} onClick={onClick}>
        {a.percent_complete != null ? `${a.percent_complete}%` : '-'}
      </td>
      <td style={tdStyle} onClick={onClick}></td>
    </tr>
  );
};

const TaskRow: React.FC<{
  a: GCScheduleActivity;
  isSelected: boolean;
  onToggleSelected: () => void;
  onToggleMech: (on: boolean) => void;
}> = ({ a, isSelected, onToggleSelected, onToggleMech }) => {
  const rowBg = isSelected ? '#dbeafe' : a.is_mechanical ? '#ecfdf5' : undefined;
  return (
    <tr style={{ background: rowBg }}>
      <td style={{ ...tdStyle, padding: '4px 6px' }}></td>
      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelected}
        />
      </td>
      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{a.activity_id || '-'}</td>
      <td style={{ ...tdStyle, paddingLeft: 24 }}>
        {a.is_mechanical && (
          <span
            onClick={() => onToggleMech(false)}
            title={a.mechanical_override ? 'Manually set mechanical — click to unmark' : 'Auto-detected mechanical — click to unmark'}
            style={{
              display: 'inline-block', background: '#10b981', color: 'white',
              borderRadius: 3, padding: '0 5px', fontSize: 10, marginRight: 6, cursor: 'pointer',
              border: a.mechanical_override ? '1px solid #b45309' : 'none',
            }}
          >
            MECH
          </span>
        )}
        {a.is_milestone ? '🏁 ' : ''}
        {a.activity_name}
      </td>
      <td style={tdStyle}>{fmtDate(a.start_date)}</td>
      <td style={tdStyle}>{fmtDate(a.finish_date)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{a.duration_days ?? daysBetween(a.start_date, a.finish_date) ?? '-'}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>{a.percent_complete != null ? `${a.percent_complete}%` : '-'}</td>
      <td style={tdStyle}>{a.responsible || '-'}</td>
    </tr>
  );
};

const UploadCard: React.FC<{ projectId: number; onUploaded: (warnings?: string[]) => void }> = ({ projectId, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: () => gcSchedulesApi.upload(projectId, file!, { versionLabel, scheduleDate, notes }),
    onSuccess: (res) => onUploaded(res.data.warnings),
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Upload failed'),
  });

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Upload GC Schedule</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            File (.xlsx, .csv, .xer, .pdf)
          </label>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv,.xer,.pdf,.xml"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Version Label (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Rev 3, Baseline, 3-26-26"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            style={{ width: '100%', padding: '0.4rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Schedule Date (optional)
          </label>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            style={{ padding: '0.4rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', padding: '0.4rem' }}
          />
        </div>
      </div>
      {error && <div style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          disabled={!file || upload.isPending}
          onClick={() => { setError(null); upload.mutate(); }}
        >
          {upload.isPending ? 'Uploading…' : 'Upload & Parse'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.75rem' }}>
        Excel, CSV, and Primavera XER imports are reliable. PDF parsing is best-effort — review rows
        afterward and ask the GC for a structured export when possible.
      </p>
    </div>
  );
};

const DiffCard: React.FC<{
  projectId: number;
  versions: GCScheduleVersion[];
  a: number | null;
  b: number | null;
  onChangeA: (id: number) => void;
  onChangeB: (id: number) => void;
  data: any;
  loading: boolean;
}> = ({ versions, a, b, onChangeA, onChangeB, data, loading }) => {
  const [mechanicalOnly, setMechanicalOnly] = useState(false);
  const [trade, setTrade] = useState<string>('');
  const [search, setSearch] = useState('');

  const matchesFilter = (row: any): boolean => {
    if (mechanicalOnly && !row.is_mechanical) return false;
    if (trade && row.trade !== trade) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        row.activity_id, row.name, row.activity_name,
        row.wbs_code, row.responsible,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filtered = data ? {
    added: (data.diff.added as any[]).filter(matchesFilter),
    removed: (data.diff.removed as any[]).filter(matchesFilter),
    changed: (data.diff.changed as any[]).filter(matchesFilter),
  } : null;

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Compare Versions</h3>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>From (older)</label>
          <select value={a || ''} onChange={(e) => onChangeA(Number(e.target.value))} style={{ minWidth: 250, padding: '4px 6px', fontSize: 13 }}>
            {versions.map((v) => <option key={v.id} value={v.id}>{versionDisplay(v)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>To (newer)</label>
          <select value={b || ''} onChange={(e) => onChangeB(Number(e.target.value))} style={{ minWidth: 250, padding: '4px 6px', fontSize: 13 }}>
            {versions.map((v) => <option key={v.id} value={v.id}>{versionDisplay(v)}</option>)}
          </select>
        </div>
      </div>

      {data && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13, padding: 10, background: '#f9fafb', borderRadius: 6 }}>
          <input
            type="text"
            placeholder="Search activity name, ID, WBS, responsible..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '4px 8px', fontSize: 13 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={mechanicalOnly} onChange={(e) => setMechanicalOnly(e.target.checked)} />
            Mechanical only
          </label>
          <select value={trade} onChange={(e) => setTrade(e.target.value)} style={{ padding: '4px 6px', fontSize: 13 }}>
            <option value="">All trades</option>
            <option value="mechanical">Mechanical</option>
            <option value="electrical">Electrical</option>
            <option value="plumbing">Plumbing</option>
            <option value="sprinkler">Sprinkler</option>
            <option value="controls">Controls</option>
          </select>
          {(mechanicalOnly || trade || search) && (
            <button className="btn btn-sm" onClick={() => { setMechanicalOnly(false); setTrade(''); setSearch(''); }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && <div>Loading diff…</div>}
      {filtered && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
            <Stat label="Added" value={`${filtered.added.length}${filtered.added.length !== data.diff.added.length ? ` of ${data.diff.added.length}` : ''}`} />
            <Stat label="Removed" value={`${filtered.removed.length}${filtered.removed.length !== data.diff.removed.length ? ` of ${data.diff.removed.length}` : ''}`} />
            <Stat label="Changed" value={`${filtered.changed.length}${filtered.changed.length !== data.diff.changed.length ? ` of ${data.diff.changed.length}` : ''}`} />
          </div>
          <DiffSection title="Changed" rows={filtered.changed} kind="changed" />
          <DiffSection title="Added (only in newer)" rows={filtered.added} kind="added" />
          <DiffSection title="Removed (only in older)" rows={filtered.removed} kind="removed" />
          {filtered.changed.length === 0 && filtered.added.length === 0 && filtered.removed.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              No differences match the current filters.
            </div>
          )}
        </>
      )}
    </div>
  );
};

const DiffSection: React.FC<{ title: string; rows: any[]; kind: 'added' | 'removed' | 'changed' }> = ({ title, rows, kind }) => {
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h4 style={{ marginBottom: '0.4rem', fontSize: 13 }}>{title} ({rows.length})</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Activity ID</th>
            <th style={thStyle}>Name</th>
            {kind === 'changed' ? <th style={thStyle}>What changed</th> : <><th style={thStyle}>Start</th><th style={thStyle}>Finish</th></>}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={i} style={{ background: kind === 'added' ? '#ecfdf5' : kind === 'removed' ? '#fef2f2' : '#fffbeb' }}>
              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{r.activity_id || '-'}</td>
              <td style={tdStyle}>{r.name || r.activity_name}{r.is_mechanical ? ' ⚙' : ''}</td>
              {kind === 'changed' ? (
                <td style={{ ...tdStyle, fontSize: 12, whiteSpace: 'normal' }}>
                  {renderChangeLines(r.diffs)}
                </td>
              ) : (
                <>
                  <td style={tdStyle}>{fmtDate(r.start_date)}</td>
                  <td style={tdStyle}>{fmtDate(r.finish_date)}</td>
                </>
              )}
            </tr>
          ))}
          {rows.length > 200 && (
            <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>Showing first 200 of {rows.length}.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GCScheduleView;
