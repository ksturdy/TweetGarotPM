import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { laborApi, LaborAccount, LaborAccountPayload } from '../../services/labor';
import '../../styles/SalesPipeline.css';

const LaborAccounts: React.FC = () => {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LaborAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['labor-accounts', showInactive],
    queryFn: () => laborApi.getAccounts(showInactive),
  });

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a: LaborAccount) => { setEditing(a); setDialogOpen(true); };
  const close = () => { setDialogOpen(false); setEditing(null); };

  const toggleActive = useMutation({
    mutationFn: (a: LaborAccount) => laborApi.updateAccount(a.id, { is_active: !a.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labor-accounts'] }),
  });

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              ← Back to Labor Board
            </Link>
            <h1>🏭 Labor Accounts</h1>
            <div className="sales-subtitle">
              Service accounts and department locations for accounts-work assignments
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <button
            onClick={openNew}
            style={{ background: '#002356', color: 'white', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            + New Account
          </button>
        </div>
      </div>

      <div className="sales-table-section">
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No labor accounts yet. Add one to start assigning crew to accounts work.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Dept Code', 'Name', 'Location', 'Customer', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569', fontWeight: 600, letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: a.is_active ? 1 : 0.5 }}>
                  <td style={td}>
                    {a.department_code
                      ? <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{a.department_code}</span>
                      : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: '#1e293b' }}>{a.name}</td>
                  <td style={td}>{a.location || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={td}>{a.customer_name || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 999,
                      fontSize: '0.7rem', fontWeight: 600,
                      background: a.is_active ? '#dcfce7' : '#f1f5f9',
                      color: a.is_active ? '#15803d' : '#64748b',
                    }}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => openEdit(a)} style={actionBtn}>Edit</button>
                    <button
                      onClick={() => toggleActive.mutate(a)}
                      style={{ ...actionBtn, color: a.is_active ? '#dc2626' : '#16a34a' }}
                    >
                      {a.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialogOpen && (
        <AccountDialog
          editing={editing}
          onClose={close}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['labor-accounts'] }); close(); }}
        />
      )}
    </div>
  );
};

const AccountDialog: React.FC<{
  editing: LaborAccount | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name || '');
  const [deptCode, setDeptCode] = useState(editing?.department_code || '');
  const [location, setLocation] = useState(editing?.location || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error('Name is required');
      const payload: LaborAccountPayload = {
        name: name.trim(),
        departmentCode: deptCode.trim() || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      return editing
        ? laborApi.updateAccount(editing.id, payload)
        : laborApi.createAccount(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['labor-accounts'] }); onSaved(); },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Failed to save'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 10, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
            {editing ? 'Edit Labor Account' : 'New Labor Account'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.85rem' }}>{error}</div>}
          <div>
            <label style={lbl}>Account Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="e.g. Green Bay Packaging — Green Bay, WI" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={lbl}>Department Code</label>
              <input value={deptCode} onChange={(e) => setDeptCode(e.target.value)} style={inp} placeholder="e.g. 10-50" />
            </div>
            <div>
              <label style={lbl}>Location (City, State)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} style={inp} placeholder="e.g. Green Bay, WI" />
            </div>
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Optional notes about this account" />
          </div>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} style={{ background: '#002356', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
            {save.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

const td: React.CSSProperties = { padding: '0.6rem 0.75rem', verticalAlign: 'middle' };
const actionBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#002356', fontWeight: 600, padding: '0 0.4rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 };
const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.6rem', fontSize: '0.85rem', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', boxSizing: 'border-box' };

export default LaborAccounts;
