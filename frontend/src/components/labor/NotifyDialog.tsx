import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { laborApi, NotificationChannel, AssignmentRecord, NotifyResult } from '../../services/labor';
import '../modals/Modal.css';

const formatPhone = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  return raw;
};

interface NotifyDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: AssignmentRecord;
}

const NotifyDialog: React.FC<NotifyDialogProps> = ({ open, onClose, assignment }) => {
  const [channels, setChannels] = useState<NotificationChannel[]>(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [results, setResults] = useState<NotifyResult[] | null>(null);

  const { data: history } = useQuery({
    queryKey: ['assignment-notifications', assignment.id],
    queryFn: () => laborApi.getNotifications(assignment.id),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: () => laborApi.notify(assignment.id, channels, customMessage || undefined),
    onSuccess: (data) => {
      setResults(data.results);
    },
  });

  if (!open) return null;

  const toggleChannel = (c: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const hasEmail = !!assignment.email;
  const hasPhone = !!(assignment.mobile_phone || assignment.phone);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>Send Assignment Notification</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '1.25rem 2rem' }}>
          <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, color: '#1e293b' }}>
              {assignment.first_name} {assignment.last_name}
              {assignment.role ? ` — ${assignment.role}` : ''}
            </div>
            <div style={{ color: '#475569', marginTop: 2 }}>
              {assignment.project_number ? `#${assignment.project_number} ` : ''}{assignment.project_name}
            </div>
            {assignment.start_date && (
              <div style={{ color: '#475569', marginTop: 2 }}>
                Start {new Date(assignment.start_date).toLocaleDateString()}
                {assignment.shift_start_time ? ` @ ${assignment.shift_start_time}` : ''}
                {assignment.shift_pattern ? ` (${assignment.shift_pattern})` : ''}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
              Channels
            </div>
            <label style={channelLabelStyle(channels.includes('email'), !hasEmail)}>
              <input
                type="checkbox"
                checked={channels.includes('email')}
                disabled={!hasEmail}
                onChange={() => toggleChannel('email')}
              />
              <div>
                <div style={{ fontWeight: 600 }}>Email</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {hasEmail ? assignment.email : 'No email on file'}
                </div>
              </div>
            </label>
            <label style={channelLabelStyle(channels.includes('sms'), !hasPhone)}>
              <input
                type="checkbox"
                checked={channels.includes('sms')}
                disabled={!hasPhone}
                onChange={() => toggleChannel('sms')}
              />
              <div>
                <div style={{ fontWeight: 600 }}>Text Message (SMS)</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {hasPhone ? formatPhone(assignment.mobile_phone || assignment.phone) : 'No phone on file'}
                </div>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: 4, textTransform: 'uppercase' }}>
              Custom Message (optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Add a personal note that will be appended to the assignment details..."
              style={{
                width: '100%', padding: '0.5rem 0.6rem', fontSize: '0.85rem',
                border: '1px solid #e2e8f0', borderRadius: 6, minHeight: 70,
                boxSizing: 'border-box', resize: 'vertical',
              }}
            />
          </div>

          {results && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
            }}>
              <div style={{ background: 'white', borderRadius: 12, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(135deg,#002356,#004080)', padding: '1.25rem 1.5rem' }}>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>Titan</div>
                  <div style={{ color: '#93c5fd', fontSize: '0.8rem', marginTop: 2 }}>Assignment Notification</div>
                </div>
                <div style={{ padding: '1.25rem 1.5rem' }}>
                  {results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: 10 }}>
                      <span style={{ fontSize: '1.1rem', marginTop: 1 }}>{r.success ? '✅' : '❌'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#1e293b' }}>{r.channel.toUpperCase()}</div>
                        <div style={{ fontSize: '0.75rem', color: r.success ? '#059669' : '#dc2626' }}>
                          {r.message || (r.success ? 'Sent successfully' : r.error)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setResults(null); onClose(); }}
                    style={{ background: '#002356', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {history && history.length > 0 && (
            <details style={{ marginTop: '0.75rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}>
                Send history ({history.length})
              </summary>
              <div style={{ marginTop: 6, fontSize: '0.75rem' }}>
                {history.map((h) => (
                  <div key={h.id} style={{ padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                    {h.channel.toUpperCase()} → {h.recipient} —
                    <span style={{ color: h.status === 'sent' ? '#059669' : '#dc2626' }}> {h.status}</span>
                    <span style={{ color: '#94a3b8' }}> · {new Date(h.sent_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f3f4f6', padding: '1rem 2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            onClick={onClose}
            style={{ background: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || channels.length === 0}
            style={{ background: '#002356', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 6, fontWeight: 600, cursor: channels.length === 0 ? 'not-allowed' : 'pointer', opacity: channels.length === 0 ? 0.5 : 1 }}
          >
            {sendMutation.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

const channelLabelStyle = (selected: boolean, disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.6rem',
  padding: '0.6rem 0.75rem',
  border: `1px solid ${selected ? '#002356' : '#e2e8f0'}`,
  background: selected ? '#f0f5ff' : 'white',
  borderRadius: 6,
  marginBottom: 6,
  opacity: disabled ? 0.5 : 1,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export default NotifyDialog;
