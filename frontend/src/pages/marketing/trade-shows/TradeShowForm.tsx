import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  tradeShowsApi,
  TradeShow,
  TradeShowStatus,
  TRADE_SHOW_STATUS_OPTIONS,
} from '../../../services/tradeShows';
import { usersApi, User } from '../../../services/users';
import SearchableSelect from '../../../components/SearchableSelect';
import '../../../styles/SalesPipeline.css';

type FormState = {
  name: string;
  description: string;
  status: TradeShowStatus;
  venue: string;
  city: string;
  state: string;
  country: string;
  address: string;
  event_start_date: string;
  event_end_date: string;
  event_start_time: string;
  event_end_time: string;
  registration_deadline: string;
  registration_cost: string;
  booth_cost: string;
  travel_budget: string;
  total_budget: string;
  booth_number: string;
  booth_size: string;
  website_url: string;
  notes: string;
  sales_lead_id: string;
  coordinator_id: string;
};

const emptyForm: FormState = {
  name: '',
  description: '',
  status: 'upcoming',
  venue: '',
  city: '',
  state: '',
  country: '',
  address: '',
  event_start_date: '',
  event_end_date: '',
  event_start_time: '',
  event_end_time: '',
  registration_deadline: '',
  registration_cost: '',
  booth_cost: '',
  travel_budget: '',
  total_budget: '',
  booth_number: '',
  booth_size: '',
  website_url: '',
  notes: '',
  sales_lead_id: '',
  coordinator_id: '',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1.25rem',
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

const TradeShowForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['trade-show', id],
    queryFn: () => tradeShowsApi.getById(parseInt(id!)).then(res => res.data),
    enabled: isEdit,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then(res => res.data),
  });

  const userOptions = useMemo(() => {
    const list = (users || []).filter((u: User) => u.is_active !== false);
    return list.map((u: User) => ({
      value: u.id.toString(),
      label: `${u.first_name} ${u.last_name}`,
      searchText: `${u.first_name} ${u.last_name} ${u.email || ''}`,
    }));
  }, [users]);

  useEffect(() => {
    if (!existing) return;
    const toDateStr = (val?: string | null) => {
      if (!val) return '';
      // Strip time portion if present
      return val.split('T')[0];
    };
    const toTimeStr = (val?: string | null) => {
      if (!val) return '';
      // Backend returns 'HH:MM:SS' — keep first 5 for input[type=time]
      return val.length >= 5 ? val.slice(0, 5) : val;
    };
    const toStr = (val: any) => (val === null || val === undefined ? '' : String(val));
    setForm({
      name: existing.name || '',
      description: existing.description || '',
      status: (existing.status as TradeShowStatus) || 'upcoming',
      venue: existing.venue || '',
      city: existing.city || '',
      state: existing.state || '',
      country: existing.country || '',
      address: existing.address || '',
      event_start_date: toDateStr(existing.event_start_date),
      event_end_date: toDateStr(existing.event_end_date),
      event_start_time: toTimeStr(existing.event_start_time),
      event_end_time: toTimeStr(existing.event_end_time),
      registration_deadline: toDateStr(existing.registration_deadline),
      registration_cost: toStr(existing.registration_cost),
      booth_cost: toStr(existing.booth_cost),
      travel_budget: toStr(existing.travel_budget),
      total_budget: toStr(existing.total_budget),
      booth_number: existing.booth_number || '',
      booth_size: existing.booth_size || '',
      website_url: existing.website_url || '',
      notes: existing.notes || '',
      sales_lead_id: existing.sales_lead_id ? existing.sales_lead_id.toString() : '',
      coordinator_id: existing.coordinator_id ? existing.coordinator_id.toString() : '',
    });
  }, [existing]);

  const update = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const buildPayload = (): Partial<TradeShow> => {
    const numOrNull = (s: string) => {
      if (!s.trim()) return null;
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };
    const idOrNull = (s: string) => {
      if (!s) return null;
      const n = parseInt(s);
      return isNaN(n) ? null : n;
    };
    return {
      name: form.name.trim(),
      description: form.description || null,
      status: form.status,
      venue: form.venue || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      address: form.address || null,
      event_start_date: form.event_start_date || null,
      event_end_date: form.event_end_date || null,
      event_start_time: form.event_start_time || null,
      event_end_time: form.event_end_time || null,
      registration_deadline: form.registration_deadline || null,
      registration_cost: numOrNull(form.registration_cost),
      booth_cost: numOrNull(form.booth_cost),
      travel_budget: numOrNull(form.travel_budget),
      total_budget: numOrNull(form.total_budget),
      booth_number: form.booth_number || null,
      booth_size: form.booth_size || null,
      website_url: form.website_url || null,
      notes: form.notes || null,
      sales_lead_id: idOrNull(form.sales_lead_id),
      coordinator_id: idOrNull(form.coordinator_id),
    };
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<TradeShow>) => tradeShowsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['trade-shows'] });
      navigate(`/marketing/trade-shows/${res.data.id}`);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to create trade show'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TradeShow>) => tradeShowsApi.update(parseInt(id!), data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['trade-shows'] });
      queryClient.invalidateQueries({ queryKey: ['trade-show', id] });
      navigate(`/marketing/trade-shows/${res.data.id}`);
    },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to update trade show'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (form.event_start_date && form.event_end_date && form.event_end_date < form.event_start_date) {
      setError('Event end date cannot be before event start date');
      return;
    }
    const payload = buildPayload();
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEdit && loadingExisting) return <div className="loading">Loading…</div>;

  return (
    <div className="container" style={{ maxWidth: '1100px', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link
              to={isEdit ? `/marketing/trade-shows/${id}` : '/marketing/trade-shows'}
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; {isEdit ? 'Back to Trade Show' : 'Back to Trade Shows'}
            </Link>
            <h1>{isEdit ? 'Edit Trade Show' : '🎪 New Trade Show'}</h1>
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Details */}
        <div className="card" style={sectionStyle}>
          <h3 style={sectionTitle}>Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g., AHR Expo 2026"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={(e) => update('status', e.target.value)}>
                {TRADE_SHOW_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Booth Number</label>
              <input className="form-input" value={form.booth_number} onChange={(e) => update('booth_number', e.target.value)} placeholder="e.g., B-2347" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Booth Size</label>
              <input className="form-input" value={form.booth_size} onChange={(e) => update('booth_size', e.target.value)} placeholder="e.g., 10x20" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Website URL</label>
              <input className="form-input" type="url" value={form.website_url} onChange={(e) => update('website_url', e.target.value)} placeholder="https://" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What is this event about?"
              />
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="card" style={sectionStyle}>
          <h3 style={sectionTitle}>Schedule</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Event Start Date</label>
              <input className="form-input" type="date" value={form.event_start_date} onChange={(e) => update('event_start_date', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Event End Date</label>
              <input className="form-input" type="date" value={form.event_end_date} onChange={(e) => update('event_end_date', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Start Time</label>
              <input className="form-input" type="time" value={form.event_start_time} onChange={(e) => update('event_start_time', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">End Time</label>
              <input className="form-input" type="time" value={form.event_end_time} onChange={(e) => update('event_end_time', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registration Deadline</label>
              <input className="form-input" type="date" value={form.registration_deadline} onChange={(e) => update('registration_deadline', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="card" style={sectionStyle}>
          <h3 style={sectionTitle}>Location</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Venue</label>
              <input className="form-input" value={form.venue} onChange={(e) => update('venue', e.target.value)} placeholder="e.g., McCormick Place" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Address</label>
              <input className="form-input" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Street address" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">State</label>
              <input className="form-input" value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="e.g., IL" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Country</label>
              <input className="form-input" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="USA" />
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="card" style={sectionStyle}>
          <h3 style={sectionTitle}>Budget</h3>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#6b7280',
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            Set planning targets here. Actual expenses are tracked as line items on the trade show detail page (with categories, vendors, and budget vs. actual variance).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Registration Budget ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.registration_cost} onChange={(e) => update('registration_cost', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Booth Budget ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.booth_cost} onChange={(e) => update('booth_cost', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Travel Budget ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.travel_budget} onChange={(e) => update('travel_budget', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Total Budget Override ($)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                value={form.total_budget}
                onChange={(e) => update('total_budget', e.target.value)}
                placeholder="Leave blank to auto-sum above"
              />
            </div>
          </div>
        </div>

        {/* Roles */}
        <div className="card" style={sectionStyle}>
          <h3 style={sectionTitle}>Roles</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Sales Lead</label>
              <SearchableSelect
                options={userOptions}
                value={form.sales_lead_id}
                onChange={(v) => update('sales_lead_id', v)}
                placeholder="-- Select sales lead --"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Coordinator</label>
              <SearchableSelect
                options={userOptions}
                value={form.coordinator_id}
                onChange={(v) => update('coordinator_id', v)}
                placeholder="-- Select coordinator --"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={sectionStyle}>
          <h3 style={sectionTitle}>Notes</h3>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              className="form-input"
              rows={4}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Internal notes, talking points, follow-ups..."
            />
          </div>
        </div>

        {!isEdit && (
          <div
            className="card"
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              background: '#eff6ff',
              borderColor: '#bfdbfe',
              color: '#1e40af',
              fontSize: '0.85rem',
            }}
          >
            💡 After saving, you'll be able to add attendees, individual expense line items, and conference to-dos (with reminders) on the trade show detail page.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginBottom: '2rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(isEdit ? `/marketing/trade-shows/${id}` : '/marketing/trade-shows')}
            disabled={isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isPending || !form.name.trim()}>
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Trade Show'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TradeShowForm;
