import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { laborApi, BoardFilters, LaborBoardRow } from '../../services/labor';
import AssignDialog from '../../components/labor/AssignDialog';
import '../../styles/SalesPipeline.css';

const avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const colorFor = (id: number) => avatarColors[id % avatarColors.length];

const LaborBoard: React.FC = () => {
  const [filters, setFilters] = useState<BoardFilters>({});
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const { data: rows, isLoading, isFetching } = useQuery({
    queryKey: ['labor-board', filters, search],
    queryFn: () => laborApi.getBoard({ ...filters, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const { data: summary } = useQuery({
    queryKey: ['labor-summary'],
    queryFn: () => laborApi.getSummary(),
  });

  const { titles, trades, groups, profiles } = useMemo(() => {
    const t = new Set<string>(); const tr = new Set<string>(); const g = new Set<string>(); const p = new Set<string>();
    (rows || []).forEach((r) => {
      if (r.title) t.add(r.title);
      if (r.trade) tr.add(r.trade);
      if (r.employee_group) g.add(r.employee_group);
      if (r.profile_type) p.add(r.profile_type);
    });
    return {
      titles: [...t].sort(),
      trades: [...tr].sort(),
      groups: [...g].sort(),
      profiles: [...p].sort(),
    };
  }, [rows]);

  const setF = (k: keyof BoardFilters, v: string | undefined) =>
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));

  const clearFilters = () => {
    setFilters({});
    setSearch('');
  };

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
            style={{
              background: '#002356', color: 'white', border: 'none',
              padding: '0.6rem 1.1rem', borderRadius: 8, fontWeight: 600,
              cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            + Assign Crew
          </button>
        </div>
      </div>

      <div className="sales-kpi-grid">
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Active Employees</div>
          <div className="sales-kpi-value">{summary?.total_employees ?? '—'}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Currently Assigned</div>
          <div className="sales-kpi-value">{summary?.currently_assigned ?? '—'}</div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Upcoming Assignments</div>
          <div className="sales-kpi-value">{summary?.upcoming_assignments ?? '—'}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Ending in 2 Weeks</div>
          <div className="sales-kpi-value">{summary?.ending_within_two_weeks ?? '—'}</div>
        </div>
      </div>

      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">
            All Employees ({rows?.length || 0})
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
            <select className="sales-filter-btn" value={filters.title || ''} onChange={(e) => setF('title', e.target.value)}>
              <option value="">All Titles</option>
              {titles.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <select className="sales-filter-btn" value={filters.trade || ''} onChange={(e) => setF('trade', e.target.value)}>
              <option value="">All Trades</option>
              {trades.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <select className="sales-filter-btn" value={filters.group || ''} onChange={(e) => setF('group', e.target.value)}>
              <option value="">All Groups</option>
              {groups.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
            <select className="sales-filter-btn" value={filters.profile_type || ''} onChange={(e) => setF('profile_type', e.target.value)}>
              <option value="">All Profile Types</option>
              {profiles.map((p) => (<option key={p} value={p}>{p}</option>))}
            </select>
            {(filters.title || filters.trade || filters.group || filters.profile_type || search) && (
              <button onClick={clearFilters} className="sales-filter-btn" style={{ color: '#dc2626' }}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : !rows || rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No employees match these filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Title</th>
                  <th style={th}>Availability</th>
                  <th style={th}>Current Project</th>
                  <th style={th}>Next Project</th>
                  <th style={th}>Profile Type</th>
                  <th style={th}>Group</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (<BoardRow key={r.id} row={r} />))}
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

const BoardRow: React.FC<{ row: LaborBoardRow }> = ({ row }) => {
  const initials = `${row.first_name?.[0] || ''}${row.last_name?.[0] || ''}`;
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={td}>
        <Link
          to={`/labor/employee/${row.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: colorFor(row.id), color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
          }}>
            {initials.toUpperCase()}
          </div>
          <span style={{ fontWeight: 500 }}>{row.first_name} {row.last_name}</span>
        </Link>
      </td>
      <td style={td}>{row.title || row.job_title || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
      <td style={td}>
        {row.availability === 'available' ? (
          <span style={{ ...pill, background: '#dcfce7', color: '#15803d' }}>Available</span>
        ) : (
          <span style={{ ...pill, background: '#dbeafe', color: '#1d4ed8' }}>
            Assigned{row.current_end_date ? ` · until ${formatDate(row.current_end_date)}` : ''}
          </span>
        )}
      </td>
      <td style={td}>
        {row.current_project_id ? (
          <Link to={`/projects/${row.current_project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
            {row.current_project_name}
          </Link>
        ) : (
          <span style={{ color: '#cbd5e1' }}>—</span>
        )}
      </td>
      <td style={td}>
        {row.next_project_id ? (
          <Link to={`/projects/${row.next_project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
            {row.next_project_name}
            {row.next_start_date && (
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Starts {formatDate(row.next_start_date)}</div>
            )}
          </Link>
        ) : (
          <span style={{ color: '#cbd5e1' }}>—</span>
        )}
      </td>
      <td style={td}>{row.profile_type || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
      <td style={td}>{row.employee_group || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
    </tr>
  );
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const th: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
  textTransform: 'uppercase', color: '#475569', fontWeight: 600, letterSpacing: 0.5,
};
const td: React.CSSProperties = { padding: '0.6rem 0.75rem', verticalAlign: 'middle' };
const pill: React.CSSProperties = {
  display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 999,
  fontSize: '0.7rem', fontWeight: 600,
};

export default LaborBoard;
