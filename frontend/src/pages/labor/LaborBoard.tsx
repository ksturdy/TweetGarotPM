import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  laborApi,
  BoardFilters,
  LaborBoardRow,
  ASSIGNMENT_TRADES,
  ASSIGNMENT_ROLES,
} from '../../services/labor';
import { employeesApi } from '../../services/employees';
import AssignDialog from '../../components/labor/AssignDialog';
import PillFilter from '../../components/labor/PillFilter';
import '../../styles/SalesPipeline.css';

const avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const colorFor = (id: number) => avatarColors[id % avatarColors.length];

type ColumnKey =
  | 'name' | 'title' | 'phone' | 'availability'
  | 'current_project' | 'next_project'
  | 'profile_type' | 'employee_group' | 'trade';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: number;
  sortable: boolean;
  editable?: 'select-title' | 'select-trade' | 'text-group' | 'text-phone' | 'select-profile';
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', width: 220, sortable: true },
  { key: 'title', label: 'Title', width: 130, sortable: true, editable: 'select-title' },
  { key: 'phone', label: 'Phone', width: 140, sortable: true, editable: 'text-phone' },
  { key: 'availability', label: 'Availability', width: 180, sortable: true },
  { key: 'current_project', label: 'Current Project', width: 230, sortable: true },
  { key: 'next_project', label: 'Next Project', width: 230, sortable: true },
  { key: 'trade', label: 'Trade', width: 120, sortable: true, editable: 'select-trade' },
  { key: 'employee_group', label: 'Group', width: 100, sortable: true, editable: 'text-group' },
  { key: 'profile_type', label: 'Profile Type', width: 120, sortable: true, editable: 'select-profile' },
];

const COLUMN_PREFS_KEY = 'labor-board-columns-v1';
const SORT_PREFS_KEY = 'labor-board-sort-v1';

const PROFILE_TYPES = ['Hourly', 'Salary'] as const;

const loadColumnPrefs = (): ColumnDef[] => {
  try {
    const raw = localStorage.getItem(COLUMN_PREFS_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const saved = JSON.parse(raw) as { key: ColumnKey; width: number }[];
    return DEFAULT_COLUMNS.map((c) => {
      const found = saved.find((s) => s.key === c.key);
      return found ? { ...c, width: found.width } : c;
    });
  } catch {
    return DEFAULT_COLUMNS;
  }
};

const LaborBoard: React.FC = () => {
  const [filters, setFilters] = useState<BoardFilters>({});
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnDef[]>(loadColumnPrefs);
  const [sort, setSort] = useState<{ key: ColumnKey; dir: 'asc' | 'desc' } | null>(() => {
    try {
      const raw = localStorage.getItem(SORT_PREFS_KEY);
      return raw ? JSON.parse(raw) : { key: 'name', dir: 'asc' };
    } catch { return { key: 'name', dir: 'asc' }; }
  });

  const qc = useQueryClient();

  const { data: rows, isLoading, isFetching } = useQuery({
    queryKey: ['labor-board', filters, search],
    queryFn: () => laborApi.getBoard({ ...filters, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const { data: allRows } = useQuery({
    queryKey: ['labor-board', {}, ''],
    queryFn: () => laborApi.getBoard(),
    staleTime: 5 * 60_000,
  });

  const { titles, trades, groups, profiles } = useMemo(() => {
    const t = new Set<string>(); const tr = new Set<string>(ASSIGNMENT_TRADES); const g = new Set<string>(); const p = new Set<string>(PROFILE_TYPES);
    (allRows || rows || []).forEach((r) => {
      if (r.title) t.add(r.title);
      if (r.trade) tr.add(r.trade);
      if (r.employee_group) g.add(r.employee_group);
      if (r.profile_type) p.add(r.profile_type);
    });
    // Pre-seed titles with canonical assignment roles so the inline picker is useful before Vista data lands.
    ASSIGNMENT_ROLES.forEach((r) => t.add(r));
    return {
      titles: [...t].sort(),
      trades: [...tr].sort(),
      groups: [...g].sort(),
      profiles: [...p].sort(),
    };
  }, [allRows, rows]);

  // Persist column widths + sort state to localStorage on change.
  useEffect(() => {
    try {
      localStorage.setItem(
        COLUMN_PREFS_KEY,
        JSON.stringify(columns.map((c) => ({ key: c.key, width: c.width })))
      );
    } catch { /* quota exceeded — ignore */ }
  }, [columns]);

  useEffect(() => {
    try { localStorage.setItem(SORT_PREFS_KEY, JSON.stringify(sort)); } catch { /* ignore */ }
  }, [sort]);

  const setF = (k: keyof BoardFilters, v: string | undefined) =>
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));

  const clearFilters = () => { setFilters({}); setSearch(''); };

  const handleSort = (key: ColumnKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const handleResize = (key: ColumnKey, newWidth: number) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, width: Math.max(60, newWidth) } : c)));
  };

  const patchEmployee = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) =>
      employeesApi.patchLaborFields(id, patch).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labor-board'] });
    },
  });

  const sortedRows = useMemo(() => {
    if (!rows) return [] as LaborBoardRow[];
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = sort.key;
    const getVal = (r: LaborBoardRow): string | number => {
      switch (key) {
        case 'name': return `${r.last_name || ''} ${r.first_name || ''}`.toLowerCase();
        case 'title': return (r.title || r.job_title || '').toLowerCase();
        case 'phone': return (r.mobile_phone || r.phone || '').toLowerCase();
        case 'availability': return r.availability;
        case 'current_project': return (r.current_project_name || '').toLowerCase();
        case 'next_project': return (r.next_project_name || '').toLowerCase();
        case 'trade': return (r.trade || '').toLowerCase();
        case 'employee_group': return (r.employee_group || '').toLowerCase();
        case 'profile_type': return (r.profile_type || '').toLowerCase();
      }
    };
    return [...rows].sort((a, b) => {
      const av = getVal(a); const bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sort]);

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>👷 Labor Board</h1>
            <div className="sales-subtitle">
              Where every craft employee is assigned today, next, and beyond
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            onClick={() => setAssignOpen(true)}
            style={{ background: '#002356', color: 'white', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            + Assign Crew
          </button>
        </div>
      </div>

      {/* KPI cards omitted from this re-render for brevity; preserved below */}
      <div className="sales-kpi-grid">
        <Kpi tone="blue" label="Total Active Employees" loader={() => laborApi.getSummary().then(s => s.total_employees)} />
        <Kpi tone="green" label="Currently Assigned" loader={() => laborApi.getSummary().then(s => s.currently_assigned)} />
        <Kpi tone="amber" label="Upcoming Assignments" loader={() => laborApi.getSummary().then(s => s.upcoming_assignments)} />
        <Kpi tone="purple" label="Ending in 2 Weeks" loader={() => laborApi.getSummary().then(s => s.ending_within_two_weeks)} />
      </div>

      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">
            All Employees ({sortedRows.length})
            {isFetching && !isLoading ? (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 8 }}>updating...</span>
            ) : null}
          </div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {(filters.title || filters.trade || filters.group || filters.profile_type || search) && (
              <button onClick={clearFilters} className="sales-filter-btn" style={{ color: '#dc2626' }}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.5rem 1rem 0.75rem' }}>
          <PillFilter label="Title" value={filters.title} options={titles} onChange={(v) => setF('title', v)} />
          <PillFilter label="Group" value={filters.group} options={groups} onChange={(v) => setF('group', v)} />
          <PillFilter label="Trade" value={filters.trade} options={trades} onChange={(v) => setF('trade', v)} />
          <PillFilter label="Profile" value={filters.profile_type} options={profiles} onChange={(v) => setF('profile_type', v)} />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : sortedRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No employees match these filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed', width: 'auto' }}>
              <colgroup>
                {columns.map((c) => (<col key={c.key} style={{ width: c.width }} />))}
              </colgroup>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {columns.map((c) => (
                    <HeaderCell
                      key={c.key}
                      column={c}
                      sortDir={sort?.key === c.key ? sort.dir : null}
                      onSort={() => c.sortable && handleSort(c.key)}
                      onResize={(w) => handleResize(c.key, w)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <BoardRow
                    key={r.id}
                    row={r}
                    columns={columns}
                    titles={titles}
                    trades={trades}
                    profiles={profiles}
                    onPatch={(patch) => patchEmployee.mutate({ id: r.id, patch })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        invalidateKeys={[['labor-board'], ['labor-summary']]}
      />
    </div>
  );
};

// ─── KPI card (kept as a tiny component so the page render stays clean) ──
const Kpi: React.FC<{ tone: 'blue' | 'green' | 'amber' | 'purple'; label: string; loader: () => Promise<string> }> = ({ tone, label }) => {
  const { data: summary } = useQuery({ queryKey: ['labor-summary'], queryFn: () => laborApi.getSummary() });
  const value = summary
    ? (label.includes('Total') ? summary.total_employees
      : label.includes('Currently') ? summary.currently_assigned
      : label.includes('Upcoming') ? summary.upcoming_assignments
      : summary.ending_within_two_weeks)
    : '—';
  return (
    <div className={`sales-kpi-card ${tone}`}>
      <div className="sales-kpi-label">{label}</div>
      <div className="sales-kpi-value">{value}</div>
    </div>
  );
};

// ─── HeaderCell with sort indicator + right-edge resize handle ─────────
const HeaderCell: React.FC<{
  column: ColumnDef;
  sortDir: 'asc' | 'desc' | null;
  onSort: () => void;
  onResize: (newWidth: number) => void;
}> = ({ column, sortDir, onSort, onResize }) => {
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = column.width;

    const onMove = (ev: MouseEvent) => {
      onResize(startW.current + (ev.clientX - startX.current));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <th
      style={{
        padding: '0.6rem 0.75rem',
        textAlign: 'left',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        color: '#475569',
        fontWeight: 600,
        letterSpacing: 0.5,
        cursor: column.sortable ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
        whiteSpace: 'nowrap',
      }}
      onClick={(e) => {
        // Don't sort when clicking the resize handle.
        if ((e.target as HTMLElement).dataset.resizeHandle) return;
        onSort();
      }}
    >
      {column.label}
      {sortDir && (
        <span style={{ marginLeft: 4, color: '#002356' }}>
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
      <span
        data-resize-handle="1"
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          background: 'transparent',
        }}
      />
    </th>
  );
};

// ─── Row + Editable cells ──────────────────────────────────────────────
const BoardRow: React.FC<{
  row: LaborBoardRow;
  columns: ColumnDef[];
  titles: string[];
  trades: string[];
  profiles: string[];
  onPatch: (patch: Partial<{ trade: string | null; employee_group: string | null; title: string | null; profile_type: string | null; phone: string | null }>) => void;
}> = ({ row, columns, titles, trades, profiles, onPatch }) => {
  const initials = `${row.first_name?.[0] || ''}${row.last_name?.[0] || ''}`.toUpperCase();

  const renderCell = (c: ColumnDef) => {
    switch (c.key) {
      case 'name':
        return (
          <Link
            to={`/labor/employee/${row.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: colorFor(row.id), color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
            }}>{initials}</div>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.first_name} {row.last_name}
            </span>
          </Link>
        );
      case 'availability':
        return row.availability === 'available' ? (
          <span style={{ ...pill, background: '#dcfce7', color: '#15803d' }}>Available</span>
        ) : (
          <span style={{ ...pill, background: '#dbeafe', color: '#1d4ed8' }}>
            Assigned{row.current_end_date ? ` · until ${fmtDate(row.current_end_date)}` : ''}
          </span>
        );
      case 'current_project':
        return row.current_project_id ? (
          <Link to={`/projects/${row.current_project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
            {row.current_project_name}
          </Link>
        ) : <span style={{ color: '#cbd5e1' }}>—</span>;
      case 'next_project':
        return row.next_project_id ? (
          <Link to={`/projects/${row.next_project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
            {row.next_project_name}
            {row.next_start_date && (
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Starts {fmtDate(row.next_start_date)}</div>
            )}
          </Link>
        ) : <span style={{ color: '#cbd5e1' }}>—</span>;
      case 'title':
        return (
          <EditableCell
            value={row.title || row.job_title || ''}
            options={titles}
            allowFreeText={false}
            placeholder="set title"
            onSave={(v) => onPatch({ title: v || null })}
          />
        );
      case 'trade':
        return (
          <EditableCell
            value={row.trade || ''}
            options={trades}
            allowFreeText={false}
            placeholder="set trade"
            onSave={(v) => onPatch({ trade: v || null })}
          />
        );
      case 'employee_group':
        return (
          <EditableCell
            value={row.employee_group || ''}
            options={[]}
            allowFreeText
            placeholder="set group"
            onSave={(v) => onPatch({ employee_group: v || null })}
          />
        );
      case 'profile_type':
        return (
          <EditableCell
            value={row.profile_type || ''}
            options={profiles}
            allowFreeText={false}
            placeholder="set type"
            onSave={(v) => onPatch({ profile_type: v || null })}
          />
        );
      case 'phone':
        return (
          <EditableCell
            value={row.mobile_phone || row.phone || ''}
            options={[]}
            allowFreeText
            placeholder="set phone"
            displayFormat={fmtPhone}
            onSave={(v) => onPatch({ phone: v || null })}
            type="tel"
          />
        );
    }
  };

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      {columns.map((c) => (
        <td
          key={c.key}
          style={{
            padding: '0.6rem 0.75rem',
            verticalAlign: 'middle',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {renderCell(c)}
        </td>
      ))}
    </tr>
  );
};

const EditableCell: React.FC<{
  value: string;
  options: string[];
  allowFreeText: boolean;
  placeholder: string;
  type?: string;
  displayFormat?: (raw: string) => string;
  onSave: (next: string) => void;
}> = ({ value, options, allowFreeText, placeholder, type, displayFormat, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{
          cursor: 'pointer',
          display: 'block',
          color: value ? '#1e293b' : '#cbd5e1',
          fontStyle: value ? 'normal' : 'italic',
          padding: '2px 4px',
          margin: '-2px -4px',
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Click to edit"
      >
        {value ? (displayFormat ? displayFormat(value) : value) : placeholder}
      </span>
    );
  }

  if (options.length > 0 && !allowFreeText) {
    return (
      <select
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        style={inputStyle}
      >
        <option value="">—</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={type || 'text'}
      value={draft}
      list={options.length > 0 ? `opts-${placeholder}` : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtPhone = (raw: string): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw;
};

const pill: React.CSSProperties = { display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '2px 4px', fontSize: '0.85rem',
  border: '1px solid #002356', borderRadius: 4, background: 'white', boxSizing: 'border-box',
};

export default LaborBoard;
