import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { laborApi, NominationRecord, ASSIGNMENT_TRADES } from '../../services/labor';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import PillFilter from '../../components/labor/PillFilter';
import api from '../../services/api';
import '../../styles/SalesPipeline.css';

interface EmpResult {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  title: string | null;
  trade: string | null;
}

const fmt = (d: string | null | undefined) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const LaborNominations: React.FC = () => {
  const { toast } = useTitanFeedback();
  const qc = useQueryClient();

  // ── filters ────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState<string | undefined>();

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => setProject(projectInput), 300);
    return () => clearTimeout(t);
  }, [projectInput]);

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: rows, isLoading } = useQuery({
    queryKey: ['labor-nominations', { search, project, trade }],
    queryFn: () => laborApi.getNominations({ search: search || undefined, project: project || undefined, trade }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['labor-nominations'] });

  // ── approve ───────────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: (id: number) => laborApi.approveNomination(id),
    onSuccess: () => { invalidate(); toast.success('Nomination approved — crew member is now active.'); },
    onError: () => toast.error('Could not approve nomination.'),
  });

  // ── decline ───────────────────────────────────────────────────────────────
  const [declineOpen, setDeclineOpen] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const declineMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => laborApi.declineNomination(id, reason || undefined),
    onSuccess: () => {
      invalidate();
      toast.success('Nomination declined.');
      setDeclineOpen(null);
      setDeclineReason('');
    },
    onError: () => toast.error('Could not decline nomination.'),
  });

  // ── reassign ──────────────────────────────────────────────────────────────
  const [reassignOpen, setReassignOpen] = useState<number | null>(null);
  const [reassignQuery, setReassignQuery] = useState('');
  const [reassignResults, setReassignResults] = useState<EmpResult[]>([]);
  const [reassignSelected, setReassignSelected] = useState<EmpResult | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reassignQuery.length < 2) { setReassignResults([]); setShowDrop(false); return; }
    api.get<EmpResult[]>(`/project-assignments/search-employees?q=${encodeURIComponent(reassignQuery)}`)
      .then((r) => { setReassignResults(r.data); setShowDrop(true); })
      .catch(() => {});
  }, [reassignQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openReassign = (id: number) => {
    setReassignOpen(id);
    setReassignQuery('');
    setReassignResults([]);
    setReassignSelected(null);
    setShowDrop(false);
    setDeclineOpen(null);
  };

  const openDecline = (id: number) => {
    setDeclineOpen(id);
    setDeclineReason('');
    setReassignOpen(null);
  };

  const reassignMut = useMutation({
    mutationFn: ({ id, employeeId }: { id: number; employeeId: number }) =>
      laborApi.reassignNomination(id, employeeId),
    onSuccess: () => {
      invalidate();
      toast.success('Nomination reassigned to new employee.');
      setReassignOpen(null);
      setReassignQuery('');
      setReassignSelected(null);
    },
    onError: () => toast.error('Could not reassign nomination.'),
  });

  const pendingCount = rows?.length ?? 0;

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              ← Back to Labor Board
            </Link>
            <h1>📋 Crew Nominations</h1>
            <div className="sales-subtitle">
              Review field crew nominations submitted by project teams.
              {pendingCount > 0 && (
                <span style={{ marginLeft: 8, background: '#f97316', color: 'white', borderRadius: 999, padding: '0.1rem 0.55rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {pendingCount} pending
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">Pending Nominations ({pendingCount})</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search by employee name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="sales-search-box">
              <span>🏗️</span>
              <input
                type="text"
                placeholder="Filter by project..."
                value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ padding: '0.5rem 1rem 0.75rem' }}>
          <PillFilter label="Trade" value={trade} options={[...ASSIGNMENT_TRADES]} onChange={setTrade} />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading nominations...</div>
        ) : !rows || rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No pending nominations</div>
            <div style={{ fontSize: '0.85rem' }}>All nominations have been reviewed.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Nominated Employee</th>
                  <th style={th}>Project</th>
                  <th style={th}>Role / Trade</th>
                  <th style={th}>Dates</th>
                  <th style={th}>PM Notes</th>
                  <th style={th}>Nominated By</th>
                  <th style={th}>Date</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((nom) => (
                  <NominationRow
                    key={nom.id}
                    nom={nom}
                    declineOpen={declineOpen}
                    declineReason={declineReason}
                    setDeclineReason={setDeclineReason}
                    onOpenDecline={() => openDecline(nom.id)}
                    onCancelDecline={() => setDeclineOpen(null)}
                    onConfirmDecline={() => declineMut.mutate({ id: nom.id, reason: declineReason })}
                    decliningId={declineMut.isPending ? declineMut.variables?.id : undefined}
                    reassignOpen={reassignOpen}
                    reassignQuery={reassignQuery}
                    setReassignQuery={setReassignQuery}
                    reassignResults={reassignResults}
                    reassignSelected={reassignSelected}
                    setReassignSelected={setReassignSelected}
                    showDrop={showDrop}
                    setShowDrop={setShowDrop}
                    dropRef={dropRef}
                    onOpenReassign={() => openReassign(nom.id)}
                    onCancelReassign={() => setReassignOpen(null)}
                    onConfirmReassign={() => reassignSelected && reassignMut.mutate({ id: nom.id, employeeId: reassignSelected.id })}
                    reassigningId={reassignMut.isPending ? reassignMut.variables?.id : undefined}
                    onApprove={() => approveMut.mutate(nom.id)}
                    approvingId={approveMut.isPending ? approveMut.variables : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Row component ─────────────────────────────────────────────────────────────
interface RowProps {
  nom: NominationRecord;
  declineOpen: number | null;
  declineReason: string;
  setDeclineReason: (v: string) => void;
  onOpenDecline: () => void;
  onCancelDecline: () => void;
  onConfirmDecline: () => void;
  decliningId?: number;
  reassignOpen: number | null;
  reassignQuery: string;
  setReassignQuery: (v: string) => void;
  reassignResults: EmpResult[];
  reassignSelected: EmpResult | null;
  setReassignSelected: (e: EmpResult | null) => void;
  showDrop: boolean;
  setShowDrop: (v: boolean) => void;
  dropRef: React.RefObject<HTMLDivElement>;
  onOpenReassign: () => void;
  onCancelReassign: () => void;
  onConfirmReassign: () => void;
  reassigningId?: number;
  onApprove: () => void;
  approvingId?: number;
}

const NominationRow: React.FC<RowProps> = ({
  nom, declineOpen, declineReason, setDeclineReason,
  onOpenDecline, onCancelDecline, onConfirmDecline, decliningId,
  reassignOpen, reassignQuery, setReassignQuery, reassignResults,
  reassignSelected, setReassignSelected, showDrop, setShowDrop, dropRef,
  onOpenReassign, onCancelReassign, onConfirmReassign, reassigningId,
  onApprove, approvingId,
}) => {
  const isDeclineOpen = declineOpen === nom.id;
  const isReassignOpen = reassignOpen === nom.id;
  const isApproving = approvingId === nom.id;
  const isDeclining = decliningId === nom.id;
  const isReassigning = reassigningId === nom.id;

  const nominatorName = [nom.nominator_first_name, nom.nominator_last_name].filter(Boolean).join(' ') || nom.nominator_email || '—';
  const startDate = nom.start_date ?? nom.project_start_date;
  const endDate = nom.end_date ?? nom.project_end_date;

  return (
    <>
      <tr style={{ borderBottom: isDeclineOpen || isReassignOpen ? 'none' : '1px solid #f1f5f9', verticalAlign: 'top' }}>
        {/* Employee */}
        <td style={td}>
          <Link to={`/labor/employee/${nom.employee_id}`} style={{ color: '#002356', textDecoration: 'none', fontWeight: 600 }}>
            {nom.first_name} {nom.last_name}
          </Link>
          {nom.employee_trade && (
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>{nom.employee_trade}</div>
          )}
        </td>

        {/* Project */}
        <td style={td}>
          {nom.project_id ? (
            <Link to={`/projects/${nom.project_id}`} style={{ color: '#002356', textDecoration: 'none', fontWeight: 500 }}>
              {nom.project_name ?? '—'}
            </Link>
          ) : <span>{nom.project_name ?? '—'}</span>}
          {nom.project_number && (
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>#{nom.project_number}</div>
          )}
        </td>

        {/* Role / Trade */}
        <td style={td}>
          <span style={{ fontWeight: 500 }}>{nom.role ?? '—'}</span>
          {nom.trade && <span style={{ color: '#64748b' }}> · {nom.trade}</span>}
        </td>

        {/* Dates */}
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <div>{fmt(startDate)}</div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→ {fmt(endDate)}</div>
        </td>

        {/* PM Notes */}
        <td style={{ ...td, maxWidth: 220 }}>
          {nom.notes ? (
            <span style={{ color: '#475569', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{nom.notes}</span>
          ) : (
            <span style={{ color: '#cbd5e1' }}>—</span>
          )}
        </td>

        {/* Nominated By */}
        <td style={td}>
          <span style={{ fontSize: '0.8rem' }}>{nominatorName}</span>
        </td>

        {/* Date */}
        <td style={{ ...td, whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#64748b' }}>
          {nom.assigned_at ? new Date(nom.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
        </td>

        {/* Actions */}
        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
          <button
            title="Approve"
            disabled={isApproving}
            onClick={onApprove}
            style={actionBtn('#16a34a', '#dcfce7')}
          >
            {isApproving ? '…' : '✓ Approve'}
          </button>
          <button
            title="Decline"
            onClick={isDeclineOpen ? onCancelDecline : onOpenDecline}
            style={actionBtn('#dc2626', '#fee2e2')}
          >
            {isDeclineOpen ? 'Cancel' : '✗ Decline'}
          </button>
          <button
            title="Reassign to someone else"
            onClick={isReassignOpen ? onCancelReassign : onOpenReassign}
            style={actionBtn('#2563eb', '#dbeafe')}
          >
            {isReassignOpen ? 'Cancel' : '⇄ Reassign'}
          </button>
        </td>
      </tr>

      {/* Inline decline panel */}
      {isDeclineOpen && (
        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td colSpan={8} style={{ padding: '0.75rem 1rem 1rem', background: '#fff7f7' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 540 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#991b1b' }}>
                Decline nomination for {nom.first_name} {nom.last_name}
              </div>
              <textarea
                rows={2}
                placeholder="Reason for declining (optional — visible in assignment notes)..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                style={inlineTextarea}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onConfirmDecline}
                  disabled={isDeclining}
                  style={{ ...actionBtn('#dc2626', '#fee2e2'), fontWeight: 700 }}
                >
                  {isDeclining ? 'Declining…' : 'Confirm Decline'}
                </button>
                <button onClick={onCancelDecline} style={actionBtn('#475569', '#f1f5f9')}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Inline reassign panel */}
      {isReassignOpen && (
        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td colSpan={8} style={{ padding: '0.75rem 1rem 1rem', background: '#f0f7ff' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e3a8a' }}>
                Assign a different employee for this role on {nom.project_name ?? 'this project'}
              </div>
              <div style={{ position: 'relative' }} ref={dropRef}>
                <input
                  type="text"
                  placeholder="Search by employee name..."
                  value={reassignSelected ? `${reassignSelected.first_name} ${reassignSelected.last_name}` : reassignQuery}
                  onChange={(e) => { setReassignQuery(e.target.value); setReassignSelected(null); }}
                  style={inlineInput}
                  autoComplete="off"
                />
                {showDrop && reassignResults.length > 0 && !reassignSelected && (
                  <div style={dropdownStyle}>
                    {reassignResults.map((e) => (
                      <button
                        key={e.id}
                        onMouseDown={() => { setReassignSelected(e); setReassignQuery(''); setShowDrop(false); }}
                        style={dropItem}
                      >
                        <span style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</span>
                        {(e.title || e.trade) && (
                          <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: '0.75rem' }}>
                            {[e.title, e.trade].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {reassignSelected && (
                <div style={{ fontSize: '0.8rem', color: '#1e3a8a', background: '#dbeafe', borderRadius: 6, padding: '0.4rem 0.7rem' }}>
                  Replacing <strong>{nom.first_name} {nom.last_name}</strong> with <strong>{reassignSelected.first_name} {reassignSelected.last_name}</strong>
                  {reassignSelected.trade && ` (${reassignSelected.trade})`}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={onConfirmReassign}
                  disabled={!reassignSelected || isReassigning}
                  style={{ ...actionBtn('#2563eb', '#dbeafe'), fontWeight: 700, opacity: reassignSelected ? 1 : 0.45 }}
                >
                  {isReassigning ? 'Reassigning…' : 'Confirm Reassignment'}
                </button>
                <button onClick={onCancelReassign} style={actionBtn('#475569', '#f1f5f9')}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.75rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '0.65rem 0.75rem',
  verticalAlign: 'top',
  color: '#1e293b',
};

const actionBtn = (color: string, bg: string): React.CSSProperties => ({
  background: bg,
  color: color,
  border: `1px solid ${color}33`,
  borderRadius: 6,
  padding: '0.25rem 0.65rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginLeft: 4,
  transition: 'opacity 0.15s',
});

const inlineInput: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const inlineTextarea: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.85rem',
  outline: 'none',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  zIndex: 50,
  maxHeight: 220,
  overflowY: 'auto',
};

const dropItem: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.85rem',
  color: '#1e293b',
};

export default LaborNominations;
