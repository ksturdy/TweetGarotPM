import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  laborApi,
  TimeOffRecord,
  TimeOffType,
  TIME_OFF_LABELS,
} from '../../services/labor';
import '../modals/Modal.css';

const TIME_OFF_TYPES: TimeOffType[] = ['vacation', 'fmla', 'laid_off', 'light_duty'];

interface TimeOffDialogProps {
  open: boolean;
  onClose: () => void;
  employeeId?: number;
  employeeName?: string;
  editing?: TimeOffRecord | null;
  invalidateKeys?: (string | number)[][];
}

const TimeOffDialog: React.FC<TimeOffDialogProps> = ({
  open,
  onClose,
  employeeId,
  employeeName,
  editing,
  invalidateKeys,
}) => {
  const qc = useQueryClient();
  const [type, setType] = useState<TimeOffType>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setStartDate(editing.start_date?.slice(0, 10) || '');
      setEndDate(editing.end_date?.slice(0, 10) || '');
      setNotes(editing.notes || '');
    } else {
      setType('vacation');
      setStartDate('');
      setEndDate('');
      setNotes('');
    }
    setError(null);
  }, [open, editing]);

  const invalidate = () => {
    const keys = invalidateKeys || [['labor-board'], ['labor-time-off'], ['labor-summary']];
    keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) throw new Error('Start and end dates are required.');
      if (new Date(endDate) < new Date(startDate)) throw new Error('End date must be on or after start date.');
      if (editing) {
        return laborApi.updateTimeOff(editing.id, { type, startDate, endDate, notes: notes || undefined });
      }
      if (!employeeId) throw new Error('Employee is required.');
      return laborApi.createTimeOff({ employeeId, type, startDate, endDate, notes: notes || undefined });
    },
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => laborApi.deleteTimeOff(editing!.id),
    onSuccess: () => { invalidate(); onClose(); },
    onError: (e: any) => setError(e?.response?.data?.error || e?.message || 'Failed to delete'),
  });

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>{editing ? 'Edit Time Off' : 'Add Time Off'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: 12, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {employeeName && (
            <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', background: '#f1f5f9', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
              {employeeName}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lblStyle}>Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {TIME_OFF_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: 6,
                      border: `2px solid ${type === t ? '#002356' : '#e2e8f0'}`,
                      background: type === t ? '#002356' : 'white',
                      color: type === t ? 'white' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {TIME_OFF_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={lblStyle}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={lblStyle}>End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lblStyle}>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                placeholder="e.g. FMLA paperwork submitted 8/15, return TBD"
              />
            </div>
          </div>
        </div>

        <div style={footerStyle}>
          {editing && (
            <button
              onClick={() => { if (window.confirm('Remove this time-off block?')) deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
              style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fca5a5', marginRight: 'auto' }}
            >
              {deleteMutation.isPending ? 'Removing…' : 'Remove'}
            </button>
          )}
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={btnPrimary}
          >
            {saveMutation.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Time Off'}
          </button>
        </div>
      </div>
    </div>
  );
};

const lblStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem', fontWeight: 600,
  color: '#475569', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: 0.4,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.6rem', fontSize: '0.85rem',
  border: '1px solid #e2e8f0', borderRadius: 6, background: 'white',
  boxSizing: 'border-box',
};
const footerStyle: React.CSSProperties = {
  borderTop: '1px solid #f3f4f6', padding: '1rem 2rem',
  display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center',
};
const btnPrimary: React.CSSProperties = {
  background: '#002356', color: 'white', border: 'none',
  padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: 'white', color: '#475569', border: '1px solid #cbd5e1',
  padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
};

export default TimeOffDialog;
