import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  laborApi,
  UnfilledRole,
  RoleCandidate,
  UnfilledRolePayload,
  ASSIGNMENT_ROLES,
  ASSIGNMENT_TRADES,
  AssignmentStatus,
} from '../../services/labor';
import '../../styles/SalesPipeline.css';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const LaborUnfilledRoles: React.FC = () => {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [fillTarget, setFillTarget] = useState<UnfilledRole | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['unfilled-roles'],
    queryFn: () => laborApi.getUnfilledRoles(),
  });

  const { data: summary } = useQuery({
    queryKey: ['labor-summary'],
    queryFn: () => laborApi.getSummary(),
  });

  const cancelRole = useMutation({
    mutationFn: (id: number) => laborApi.cancelAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['unfilled-roles'] }),
  });

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              ← Back to Labor Board
            </Link>
            <h1>🔓 Unfilled Roles</h1>
            <div className="sales-subtitle">
              Open crew slots that need to be filled
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            onClick={() => setAddOpen(true)}
            style={{ background: '#002356', color: 'white', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            + Add Unfilled Role
          </button>
        </div>
      </div>

      {summary && (
        <div className="sales-kpi-grid">
          <div className="sales-kpi-card amber">
            <div className="sales-kpi-label">Open Roles</div>
            <div className="sales-kpi-value">{summary.unfilled_roles}</div>
          </div>
          <div className="sales-kpi-card blue">
            <div className="sales-kpi-label">Currently Assigned</div>
            <div className="sales-kpi-value">{summary.currently_assigned}</div>
          </div>
          <div className="sales-kpi-card green">
            <div className="sales-kpi-label">Total Active Employees</div>
            <div className="sales-kpi-value">{summary.total_employees}</div>
          </div>
        </div>
      )}

      <div className="sales-table-section">
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : roles.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No unfilled roles. Add one when you know a project needs someone but don't have a person yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Project / Account', 'Trade', 'Role', 'Start', 'End', 'Notes', ''].map((h) => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569', fontWeight: 600, letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}>
                    {r.project_id ? (
                      <Link to={`/projects/${r.project_id}`} style={{ color: '#002356', textDecoration: 'none', fontWeight: 600 }}>
                        {r.project_name}
                        {r.project_number && <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>#{r.project_number}</span>}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 600 }}>
                        {r.labor_account_code && (
                          <span style={{ fontSize: '0.65rem', background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginRight: 4 }}>ACCT</span>
                        )}
                        {r.labor_account_name || r.project_name}
                      </span>
                    )}
                  </td>
                  <td style={td}>{r.trade || <span style={{ color: '#cbd5e1' }}>Any</span>}</td>
                  <td style={td}>{r.role || <span style={{ color: '#cbd5e1' }}>Any</span>}</td>
                  <td style={td}>{fmtDate(r.start_date)}</td>
                  <td style={td}>{fmtDate(r.end_date)}</td>
                  <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.fill_notes || <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setFillTarget(r)} style={actionBtn}>Fill Role</button>
                    <button
                      onClick={() => { if (window.confirm('Cancel this unfilled role?')) cancelRole.mutate(r.id); }}
                      style={{ ...actionBtn, color: '#dc2626' }}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <AddUnfilledRoleDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['unfilled-roles'] }); qc.invalidateQueries({ queryKey: ['labor-summary'] }); setAddOpen(false); }}
        />
      )}

      {fillTarget && (
        <FillRoleDialog
          role={fillTarget}
          onClose={() => setFillTarget(null)}
          onFilled={() => { qc.invalidateQueries({ queryKey: ['unfilled-roles'] }); qc.invalidateQueries({ queryKey: ['labor-summary'] }); qc.invalidateQueries({ queryKey: ['labor-board'] }); setFillTarget(null); }}
        />
      )}
    </div>
  );
};

// ── Add Unfilled Role Dialog ────────────────────────────────────────────
const AddUnfilledRoleDialog: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const { data: projects = [] } = useQuery({ queryKey: ['assign-projects-all'], queryFn: () => import('../../services/projects').then(m => m.projectsApi.getAll().then(r => r.data)) });
  const [projectId, setProjectId] = useState('');
  const [trade, setTrade] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fillNotes, setFillNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (!projectId) throw new Error('Project is required');
      return laborApi.createUnfilledRole({
        projectId: parseInt(projectId),
        trade: trade || undefined,
        role: role || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        fillNotes: fillNotes || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Failed to save'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 10, width: 500, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Add Unfilled Role</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.85rem' }}>{error}</div>}
          <div>
            <label style={lbl}>Project *</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inp}>
              <option value="">— select project —</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.number ? `${p.number} — ` : ''}{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Trade</label>
              <select value={trade} onChange={(e) => setTrade(e.target.value)} style={inp}>
                <option value="">Any trade</option>
                {ASSIGNMENT_TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={inp}>
                <option value="">Any role</option>
                {ASSIGNMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Notes (why this role is open, special requirements)</label>
            <textarea value={fillNotes} onChange={(e) => setFillNotes(e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="e.g. Need a Journeyman Pipefitter — OT required weeks 1-3" />
          </div>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} style={{ background: '#002356', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            {save.isPending ? 'Saving…' : 'Add Role'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Fill Role Dialog — candidate picker ────────────────────────────────
const FillRoleDialog: React.FC<{ role: UnfilledRole; onClose: () => void; onFilled: () => void }> = ({ role, onClose, onFilled }) => {
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTrade, setFilterTrade] = useState('');

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['role-candidates', role.id],
    queryFn: () => laborApi.getCandidates(role.id),
  });

  const fill = useMutation({
    mutationFn: (employeeId: number) => laborApi.fillRole(role.id, employeeId),
    onSuccess: onFilled,
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Failed to fill role'),
  });

  const filtered = useMemo(() => {
    if (!search && !filterTrade) return candidates;
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      const nameMatch = !search || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q);
      const tradeMatch = !filterTrade || (c.employee_trade || '') === filterTrade;
      return nameMatch && tradeMatch;
    });
  }, [candidates, search, filterTrade]);

  const available = filtered.filter((c) => c.is_available);
  const unavailable = filtered.filter((c) => !c.is_available);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 10, width: 560, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Fill Role</h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              {role.project_name} · {role.trade || 'Any trade'} {role.role ? `· ${role.role}` : ''}
              {role.start_date && ` · ${fmtDate(role.start_date)} → ${fmtDate(role.end_date)}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: 6 }}
            />
            <select
              value={filterTrade}
              onChange={(e) => setFilterTrade(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: 6, color: filterTrade ? '#1e293b' : '#94a3b8' }}
            >
              <option value="">All trades</option>
              {ASSIGNMENT_TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {isLoading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>Loading candidates…</div>
          ) : (
            <>
              {available.length > 0 && (
                <>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Available ({available.length})
                  </div>
                  {available.map((c) => (
                    <CandidateRow key={c.id} candidate={c} onFill={() => fill.mutate(c.id)} isPending={fill.isPending} />
                  ))}
                </>
              )}
              {unavailable.length > 0 && (
                <>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 8px' }}>
                    Currently Assigned ({unavailable.length})
                  </div>
                  {unavailable.map((c) => (
                    <CandidateRow key={c.id} candidate={c} onFill={() => fill.mutate(c.id)} isPending={fill.isPending} dimmed />
                  ))}
                </>
              )}
              {candidates.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No employees found.</div>
              )}
              {candidates.length > 0 && filtered.length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No employees match your search.</div>
              )}
            </>
          )}
        </div>
        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

const CandidateRow: React.FC<{
  candidate: RoleCandidate;
  onFill: () => void;
  isPending: boolean;
  dimmed?: boolean;
}> = ({ candidate, onFill, isPending, dimmed }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.5rem 0.75rem', marginBottom: 4,
    background: dimmed ? '#f8fafc' : '#f0fdf4',
    borderRadius: 6, opacity: dimmed ? 0.7 : 1,
    border: `1px solid ${dimmed ? '#e2e8f0' : '#bbf7d0'}`,
  }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
        {candidate.first_name} {candidate.last_name}
        {candidate.trade_match ? (
          <span style={{ marginLeft: 6, fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Trade Match</span>
        ) : null}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
        {candidate.employee_trade || 'No trade'} · {candidate.title || 'No title'}
        {dimmed ? ' · Currently assigned' : ' · Available'}
      </div>
    </div>
    <button
      onClick={onFill}
      disabled={isPending}
      style={{ background: '#002356', color: 'white', border: 'none', padding: '0.35rem 0.85rem', borderRadius: 6, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
    >
      Assign
    </button>
  </div>
);

const td: React.CSSProperties = { padding: '0.6rem 0.75rem', verticalAlign: 'middle' };
const actionBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#002356', fontWeight: 600, padding: '0 0.4rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.6rem', fontSize: '0.85rem', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', boxSizing: 'border-box' };

export default LaborUnfilledRoles;
