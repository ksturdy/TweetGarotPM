import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  tradeShowsApi,
  TradeShowAttendee,
  ATTENDEE_REGISTRATION_STATUS_OPTIONS,
  ATTENDEE_ROLE_OPTIONS,
  AttendeeRegistrationStatus,
} from '../../../services/tradeShows';
import { usersApi, User } from '../../../services/users';
import SearchableSelect from '../../../components/SearchableSelect';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';
import '../../../styles/SalesPipeline.css';

const fmtMoney = (val?: number | string | null) => {
  if (val === null || val === undefined || val === '') return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const fmtDate = (val?: string | null) => {
  if (!val) return '—';
  const d = new Date(val.includes('T') ? val : val + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return '—';
  if (start && end && start !== end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  return fmtDate(start || end);
};

const fmtTime = (val?: string | null) => {
  if (!val) return '';
  const t = val.length >= 5 ? val.slice(0, 5) : val;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  if (isNaN(h)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    upcoming: 'badge badge-info',
    registered: 'badge badge-info',
    in_progress: 'badge badge-warning',
    completed: 'badge badge-success',
    cancelled: 'badge badge-danger',
  };
  return map[status] || 'badge';
};

const statusLabel = (status: string) =>
  status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const attendeeName = (a: TradeShowAttendee): string => {
  if (a.user_id && (a.user_first_name || a.user_last_name)) {
    return `${a.user_first_name || ''} ${a.user_last_name || ''}`.trim();
  }
  return a.external_name || '—';
};

type AttendeeFormState = {
  type: 'internal' | 'external';
  user_id: string;
  external_name: string;
  external_email: string;
  external_company: string;
  role: string;
  registration_status: AttendeeRegistrationStatus;
  arrival_date: string;
  departure_date: string;
  notes: string;
};

const emptyAttendee: AttendeeFormState = {
  type: 'internal',
  user_id: '',
  external_name: '',
  external_email: '',
  external_company: '',
  role: '',
  registration_status: 'pending',
  arrival_date: '',
  departure_date: '',
  notes: '',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#6b7280',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

const valueStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#1f2937',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#475569',
  marginTop: 0,
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const TradeShowDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<TradeShowAttendee | null>(null);
  const [attendeeForm, setAttendeeForm] = useState<AttendeeFormState>(emptyAttendee);
  const [attendeeError, setAttendeeError] = useState<string | null>(null);

  const showId = id ? parseInt(id) : 0;

  const { data: show, isLoading, error } = useQuery({
    queryKey: ['trade-show', id],
    queryFn: () => tradeShowsApi.getById(showId).then(res => res.data),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then(res => res.data),
  });

  const userOptions = useMemo(() => {
    const list = (users || []).filter((u: User) => u.is_active !== false);
    const taken = new Set((show?.attendees || []).map(a => a.user_id).filter(Boolean));
    return list
      .filter((u: User) => editingAttendee?.user_id === u.id || !taken.has(u.id))
      .map((u: User) => ({
        value: u.id.toString(),
        label: `${u.first_name} ${u.last_name}`,
        searchText: `${u.first_name} ${u.last_name} ${u.email || ''}`,
      }));
  }, [users, show, editingAttendee]);

  const deleteShowMutation = useMutation({
    mutationFn: () => tradeShowsApi.delete(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-shows'] });
      navigate('/marketing/trade-shows');
    },
  });

  const addAttendeeMutation = useMutation({
    mutationFn: (data: Partial<TradeShowAttendee>) => tradeShowsApi.addAttendee(showId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-show', id] });
      setShowAddModal(false);
      setAttendeeForm(emptyAttendee);
      setAttendeeError(null);
    },
    onError: (err: any) => setAttendeeError(err?.response?.data?.error || 'Failed to add attendee'),
  });

  const updateAttendeeMutation = useMutation({
    mutationFn: ({ attendeeId, data }: { attendeeId: number; data: Partial<TradeShowAttendee> }) =>
      tradeShowsApi.updateAttendee(showId, attendeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-show', id] });
      setEditingAttendee(null);
      setAttendeeForm(emptyAttendee);
      setAttendeeError(null);
    },
    onError: (err: any) => setAttendeeError(err?.response?.data?.error || 'Failed to update attendee'),
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: (attendeeId: number) => tradeShowsApi.removeAttendee(showId, attendeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-show', id] }),
  });

  const inlineUpdateAttendee = (attendee: TradeShowAttendee, patch: Partial<TradeShowAttendee>) => {
    updateAttendeeMutation.mutate({
      attendeeId: attendee.id,
      data: {
        user_id: attendee.user_id ?? null,
        external_name: attendee.external_name ?? null,
        external_email: attendee.external_email ?? null,
        external_company: attendee.external_company ?? null,
        role: attendee.role ?? null,
        registration_status: attendee.registration_status,
        arrival_date: attendee.arrival_date ?? null,
        departure_date: attendee.departure_date ?? null,
        notes: attendee.notes ?? null,
        ...patch,
      },
    });
  };

  const handleDeleteShow = async () => {
    if (!show) return;
    const ok = await confirm({
      message: `Delete "${show.name}"? This will remove all attendees as well.`,
      title: 'Delete Trade Show',
      danger: true,
    });
    if (ok) deleteShowMutation.mutate();
  };

  const handleRemoveAttendee = async (a: TradeShowAttendee) => {
    const ok = await confirm({
      message: `Remove ${attendeeName(a)} from this trade show?`,
      title: 'Remove Attendee',
      danger: true,
    });
    if (ok) removeAttendeeMutation.mutate(a.id);
  };

  const openAddAttendee = () => {
    setEditingAttendee(null);
    setAttendeeForm(emptyAttendee);
    setAttendeeError(null);
    setShowAddModal(true);
  };

  const openEditAttendee = (a: TradeShowAttendee) => {
    setEditingAttendee(a);
    setAttendeeForm({
      type: a.user_id ? 'internal' : 'external',
      user_id: a.user_id ? a.user_id.toString() : '',
      external_name: a.external_name || '',
      external_email: a.external_email || '',
      external_company: a.external_company || '',
      role: a.role || '',
      registration_status: a.registration_status,
      arrival_date: (a.arrival_date || '').split('T')[0],
      departure_date: (a.departure_date || '').split('T')[0],
      notes: a.notes || '',
    });
    setAttendeeError(null);
    setShowAddModal(true);
  };

  const submitAttendee = (e: React.FormEvent) => {
    e.preventDefault();
    setAttendeeError(null);

    const isInternal = attendeeForm.type === 'internal';
    if (isInternal && !attendeeForm.user_id) {
      setAttendeeError('Please select an internal user');
      return;
    }
    if (!isInternal && !attendeeForm.external_name.trim()) {
      setAttendeeError('Name is required for external attendees');
      return;
    }

    const data: Partial<TradeShowAttendee> = {
      user_id: isInternal ? parseInt(attendeeForm.user_id) : null,
      external_name: isInternal ? null : attendeeForm.external_name.trim(),
      external_email: isInternal ? null : (attendeeForm.external_email.trim() || null),
      external_company: isInternal ? null : (attendeeForm.external_company.trim() || null),
      role: attendeeForm.role || null,
      registration_status: attendeeForm.registration_status,
      arrival_date: attendeeForm.arrival_date || null,
      departure_date: attendeeForm.departure_date || null,
      notes: attendeeForm.notes || null,
    };

    if (editingAttendee) {
      updateAttendeeMutation.mutate({ attendeeId: editingAttendee.id, data });
    } else {
      addAttendeeMutation.mutate(data);
    }
  };

  if (isLoading) return <div className="loading">Loading…</div>;
  if (error || !show) return <div className="error-message">Trade show not found</div>;

  const totalCostCalc = (() => {
    if (show.total_budget !== null && show.total_budget !== undefined && show.total_budget !== '') {
      const n = typeof show.total_budget === 'string' ? parseFloat(show.total_budget) : show.total_budget;
      if (!isNaN(n)) return n;
    }
    let sum = 0;
    let any = false;
    for (const v of [show.registration_cost, show.booth_cost, show.travel_budget]) {
      if (v !== null && v !== undefined && v !== '') {
        const n = typeof v === 'string' ? parseFloat(v) : v;
        if (!isNaN(n)) { sum += n; any = true; }
      }
    }
    return any ? sum : null;
  })();

  const eventTime = (() => {
    const start = fmtTime(show.event_start_time);
    const end = fmtTime(show.event_end_time);
    if (!start && !end) return '';
    if (start && end) return `${start} – ${end}`;
    return start || end;
  })();

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing/trade-shows" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Trade Shows
            </Link>
            <h1>🎪 {show.name}</h1>
            <div style={{ marginTop: '0.5rem' }}>
              <span className={statusBadge(show.status)}>{statusLabel(show.status)}</span>
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/marketing/trade-shows/${id}/edit`)}>
            ✏️ Edit
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDeleteShow}
            style={{ color: '#dc2626', borderColor: '#fecaca' }}
            disabled={deleteShowMutation.isPending}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Summary grid */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={sectionTitle}>Event Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem 1.5rem' }}>
          <div>
            <div style={labelStyle}>Event Date</div>
            <div style={valueStyle}>{fmtDateRange(show.event_start_date, show.event_end_date)}</div>
            {eventTime && <div style={{ ...valueStyle, color: '#6b7280', fontSize: '0.85rem' }}>{eventTime}</div>}
          </div>
          <div>
            <div style={labelStyle}>Registration Deadline</div>
            <div style={valueStyle}>{fmtDate(show.registration_deadline)}</div>
          </div>
          <div>
            <div style={labelStyle}>Venue</div>
            <div style={valueStyle}>{show.venue || '—'}</div>
            {(show.city || show.state) && (
              <div style={{ ...valueStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                {[show.city, show.state, show.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div>
            <div style={labelStyle}>Booth</div>
            <div style={valueStyle}>
              {show.booth_number || show.booth_size
                ? `${show.booth_number || ''}${show.booth_number && show.booth_size ? ' • ' : ''}${show.booth_size || ''}`
                : '—'}
            </div>
          </div>
          <div>
            <div style={labelStyle}>Sales Lead</div>
            <div style={valueStyle}>{show.sales_lead_name || '—'}</div>
            {show.sales_lead_email && (
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{show.sales_lead_email}</div>
            )}
          </div>
          <div>
            <div style={labelStyle}>Coordinator</div>
            <div style={valueStyle}>{show.coordinator_name || '—'}</div>
            {show.coordinator_email && (
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{show.coordinator_email}</div>
            )}
          </div>
          {show.website_url && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Website</div>
              <a href={show.website_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                {show.website_url}
              </a>
            </div>
          )}
          {show.address && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Address</div>
              <div style={valueStyle}>{show.address}</div>
            </div>
          )}
          {show.description && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={labelStyle}>Description</div>
              <div style={valueStyle}>{show.description}</div>
            </div>
          )}
        </div>
      </div>

      {/* Costs */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={sectionTitle}>Costs</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={labelStyle}>Registration</div>
            <div style={valueStyle}>{fmtMoney(show.registration_cost)}</div>
          </div>
          <div>
            <div style={labelStyle}>Booth</div>
            <div style={valueStyle}>{fmtMoney(show.booth_cost)}</div>
          </div>
          <div>
            <div style={labelStyle}>Travel Budget</div>
            <div style={valueStyle}>{fmtMoney(show.travel_budget)}</div>
          </div>
          <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '1rem' }}>
            <div style={labelStyle}>Total</div>
            <div style={{ ...valueStyle, fontWeight: 700, fontSize: '1.1rem' }}>
              {totalCostCalc === null ? '—' : fmtMoney(totalCostCalc)}
            </div>
          </div>
        </div>
      </div>

      {/* Attendees */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            Attendees ({show.attendees?.length ?? 0})
          </h3>
          <button className="btn btn-primary" onClick={openAddAttendee}>+ Add Attendee</button>
        </div>

        {!show.attendees || show.attendees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6b7280' }}>
            No attendees yet. Add the first attendee to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Registration</th>
                  <th>Arrival</th>
                  <th>Departure</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {show.attendees.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>
                      {attendeeName(a)}
                      {a.user_id && a.user_email && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>{a.user_email}</div>
                      )}
                      {!a.user_id && a.external_email && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>{a.external_email}</div>
                      )}
                      {!a.user_id && a.external_company && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>{a.external_company}</div>
                      )}
                    </td>
                    <td>
                      <span className={a.user_id ? 'badge badge-success' : 'badge badge-info'}>
                        {a.user_id ? 'Internal' : 'External'}
                      </span>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '13px' }}
                        value={a.role || ''}
                        onChange={(e) => inlineUpdateAttendee(a, { role: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {ATTENDEE_ROLE_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '13px' }}
                        value={a.registration_status}
                        onChange={(e) => inlineUpdateAttendee(a, { registration_status: e.target.value as AttendeeRegistrationStatus })}
                      >
                        {ATTENDEE_REGISTRATION_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="sales-date-cell">{fmtDate(a.arrival_date)}</td>
                    <td className="sales-date-cell">{fmtDate(a.departure_date)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openEditAttendee(a)}
                        title="Edit attendee"
                        style={{
                          background: 'none', border: 'none', color: '#6b7280',
                          cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px', marginRight: '4px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#3b82f6')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleRemoveAttendee(a)}
                        title="Remove attendee"
                        style={{
                          background: 'none', border: 'none', color: '#9ca3af',
                          cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {show.notes && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={sectionTitle}>Notes</h3>
          <div style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>{show.notes}</div>
        </div>
      )}

      {/* Add/Edit Attendee Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
              {editingAttendee ? 'Edit Attendee' : 'Add Attendee'}
            </h2>

            {attendeeError && (
              <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem' }}>
                {attendeeError}
              </div>
            )}

            <form onSubmit={submitAttendee}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={labelStyle}>Attendee Type</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className={`btn ${attendeeForm.type === 'internal' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setAttendeeForm(f => ({ ...f, type: 'internal' }))}
                  >
                    Internal (Employee)
                  </button>
                  <button
                    type="button"
                    className={`btn ${attendeeForm.type === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setAttendeeForm(f => ({ ...f, type: 'external' }))}
                  >
                    External
                  </button>
                </div>
              </div>

              {attendeeForm.type === 'internal' ? (
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <SearchableSelect
                    options={userOptions}
                    value={attendeeForm.user_id}
                    onChange={(v) => setAttendeeForm(f => ({ ...f, user_id: v }))}
                    placeholder="-- Select an employee --"
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Name *</label>
                    <input
                      className="form-input"
                      value={attendeeForm.external_name}
                      onChange={(e) => setAttendeeForm(f => ({ ...f, external_name: e.target.value }))}
                      placeholder="Full name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      value={attendeeForm.external_email}
                      onChange={(e) => setAttendeeForm(f => ({ ...f, external_email: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company</label>
                    <input
                      className="form-input"
                      value={attendeeForm.external_company}
                      onChange={(e) => setAttendeeForm(f => ({ ...f, external_company: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-input"
                    value={attendeeForm.role}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, role: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {ATTENDEE_ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Registration Status</label>
                  <select
                    className="form-input"
                    value={attendeeForm.registration_status}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, registration_status: e.target.value as AttendeeRegistrationStatus }))}
                  >
                    {ATTENDEE_REGISTRATION_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Arrival Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={attendeeForm.arrival_date}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, arrival_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Departure Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={attendeeForm.departure_date}
                    onChange={(e) => setAttendeeForm(f => ({ ...f, departure_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={attendeeForm.notes}
                  onChange={(e) => setAttendeeForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={addAttendeeMutation.isPending || updateAttendeeMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addAttendeeMutation.isPending || updateAttendeeMutation.isPending}
                >
                  {(addAttendeeMutation.isPending || updateAttendeeMutation.isPending)
                    ? 'Saving…'
                    : editingAttendee ? 'Save Changes' : 'Add Attendee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeShowDetail;
