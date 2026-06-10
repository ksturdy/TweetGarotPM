import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { laborApi, AssignmentRecord, ASSIGNMENT_STATUSES, ASSIGNMENT_TRADES } from '../../services/labor';
import AssignDialog from '../../components/labor/AssignDialog';
import NotifyDialog from '../../components/labor/NotifyDialog';
import PillFilter from '../../components/labor/PillFilter';
import '../../styles/SalesPipeline.css';

const isoMinusDays = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const isoPlusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const LaborAssignments: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(isoPlusDays(180));
  const [trade, setTrade] = useState<string | undefined>();
  const [group, setGroup] = useState<string | undefined>();
  const [editing, setEditing] = useState<AssignmentRecord | null>(null);
  const [notifyAssignment, setNotifyAssignment] = useState<AssignmentRecord | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['labor-assignments-list', { statusFilter, search, from, to, trade, group }],
    queryFn: () => laborApi.getAssignmentsList({
      status: statusFilter || undefined,
      search: search || undefined,
      from, to, trade, group,
    }),
    placeholderData: keepPreviousData,
  });

  // Unfiltered board for pill options
  const { data: allRows } = useQuery({
    queryKey: ['labor-board', {}, ''],
    queryFn: () => laborApi.getBoard(),
    staleTime: 5 * 60_000,
  });

  const { trades, groups } = useMemo(() => {
    const tr = new Set<string>(ASSIGNMENT_TRADES); const g = new Set<string>();
    (allRows || []).forEach((r) => {
      if (r.trade) tr.add(r.trade);
      if (r.employee_group) g.add(r.employee_group);
    });
    return { trades: [...tr].sort(), groups: [...g].sort() };
  }, [allRows]);

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>← Back to Labor Board</Link>
            <h1>📋 All Assignments</h1>
            <div className="sales-subtitle">Flat list of every crew assignment, filterable.</div>
          </div>
        </div>
      </div>

      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">Assignments ({rows?.length || 0})</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search employee, project, role..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select className="sales-filter-btn" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {ASSIGNMENT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
            <input type="date" className="sales-filter-btn" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="sales-filter-btn" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.5rem 1rem 0.75rem' }}>
          <PillFilter label="Group" value={group} options={groups} onChange={setGroup} />
          <PillFilter label="Trade" value={trade} options={trades} onChange={setTrade} />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : !rows || rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No assignments in this range.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Employee</th>
                  <th style={th}>Project</th>
                  <th style={th}>Role</th>
                  <th style={th}>Start</th>
                  <th style={th}>End</th>
                  <th style={th}>Shift</th>
                  <th style={th}>Status</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}>
                      <Link to={`/labor/employee/${a.employee_id}`} style={{ color: '#002356', textDecoration: 'none', fontWeight: 500 }}>
                        {a.first_name} {a.last_name}
                      </Link>
                    </td>
                    <td style={td}>
                      <Link to={`/projects/${a.project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
                        {a.project_name}
                      </Link>
                      {a.project_number && (<div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>#{a.project_number}</div>)}
                    </td>
                    <td style={td}>{a.role || '—'}{a.trade ? <span style={{ color: '#94a3b8' }}> · {a.trade}</span> : null}</td>
                    <td style={td}>
                      {renderDateCell(a.start_date, a.start_date_overridden)}
                      {a.project_start_date && <div style={projectDateStyle}>proj: {formatDate(a.project_start_date)}</div>}
                    </td>
                    <td style={td}>
                      {renderDateCell(a.end_date, a.end_date_overridden)}
                      {a.project_end_date && <div style={projectDateStyle}>proj: {formatDate(a.project_end_date)}</div>}
                    </td>
                    <td style={td}>{[a.shift_pattern, a.shift_start_time].filter(Boolean).join(' ')}</td>
                    <td style={td}><StatusBadge status={a.status} /></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setNotifyAssignment(a)} style={iconBtn}>📤</button>
                      <button onClick={() => setEditing(a)} style={iconBtn}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <AssignDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          editing={editing}
          invalidateKeys={[['labor-assignments-list'], ['labor-board'], ['labor-summary']]}
        />
      )}

      {notifyAssignment && (
        <NotifyDialog
          open={!!notifyAssignment}
          onClose={() => setNotifyAssignment(null)}
          assignment={notifyAssignment}
        />
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string | null }> = ({ status }) => {
  if (!status) return <span style={{ color: '#cbd5e1' }}>—</span>;
  const colors: Record<string, [string, string]> = {
    planned: ['#ffedd5', '#7c2d12'],
    active: ['#dbeafe', '#1e3a8a'],
    completed: ['#e2e8f0', '#475569'],
    cancelled: ['#fee2e2', '#991b1b'],
  };
  const [bg, color] = colors[status] || ['#e2e8f0', '#475569'];
  return (
    <span style={{ background: bg, color, padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 }}>
      {status}
    </span>
  );
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const renderDateCell = (d: string | null, overridden?: boolean) => {
  if (!d) return <span style={{ color: '#cbd5e1' }}>—</span>;
  if (overridden) {
    return (
      <span title="User override" style={{ color: '#15803d', fontWeight: 600, background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
        {formatDate(d)}
      </span>
    );
  }
  return (
    <span title="Project default" style={{ color: '#64748b', fontStyle: 'italic' }}>
      {formatDate(d)}
    </span>
  );
};

const projectDateStyle: React.CSSProperties = {
  fontSize: '0.68rem', color: '#94a3b8', marginTop: 2, fontStyle: 'italic',
};
const th: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem',
  textTransform: 'uppercase', color: '#475569', fontWeight: 600, letterSpacing: 0.4,
};
const td: React.CSSProperties = { padding: '0.55rem 0.75rem', verticalAlign: 'middle' };
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: '0.25rem 0.4rem', fontSize: '0.8rem', color: '#475569', marginLeft: 4,
};

export default LaborAssignments;
