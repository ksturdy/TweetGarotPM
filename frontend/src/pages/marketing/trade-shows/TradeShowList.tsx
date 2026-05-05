import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  tradeShowsApi,
  TradeShow,
  TRADE_SHOW_STATUS_OPTIONS,
} from '../../../services/tradeShows';
import { usersApi, User } from '../../../services/users';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';
import SearchableSelect from '../../../components/SearchableSelect';
import '../../../styles/SalesPipeline.css';

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) return '—';
  if (start && end && start !== end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  return formatDate(start || end);
};

const fmtMoney = (val?: number | string | null) => {
  if (val === null || val === undefined || val === '') return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const totalCost = (s: TradeShow) => {
  const fields = [s.registration_cost, s.booth_cost, s.travel_budget];
  let sum = 0;
  let any = false;
  for (const v of fields) {
    if (v !== null && v !== undefined && v !== '') {
      const n = typeof v === 'string' ? parseFloat(v) : v;
      if (!isNaN(n)) { sum += n; any = true; }
    }
  }
  if (s.total_budget !== null && s.total_budget !== undefined && s.total_budget !== '') {
    const n = typeof s.total_budget === 'string' ? parseFloat(s.total_budget) : s.total_budget;
    if (!isNaN(n)) return n;
  }
  return any ? sum : null;
};

const statusBadgeClass = (status: string): string => {
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

const TradeShowList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [salesLeadFilter, setSalesLeadFilter] = useState<string>('');
  const [coordinatorFilter, setCoordinatorFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: tradeShows, isLoading, error } = useQuery({
    queryKey: ['trade-shows'],
    queryFn: () => tradeShowsApi.getAll().then(res => res.data),
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

  const yearOptions = useMemo(() => {
    if (!tradeShows) return [];
    const years = new Set<number>();
    tradeShows.forEach(s => {
      if (s.event_start_date) {
        const y = new Date(s.event_start_date.includes('T') ? s.event_start_date : s.event_start_date + 'T00:00:00').getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [tradeShows]);

  const filtered = useMemo(() => {
    if (!tradeShows) return [];
    const q = searchQuery.trim().toLowerCase();
    return tradeShows.filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (yearFilter) {
        const y = s.event_start_date
          ? new Date(s.event_start_date.includes('T') ? s.event_start_date : s.event_start_date + 'T00:00:00').getFullYear()
          : null;
        if (y === null || y.toString() !== yearFilter) return false;
      }
      if (salesLeadFilter && (s.sales_lead_id?.toString() || '') !== salesLeadFilter) return false;
      if (coordinatorFilter && (s.coordinator_id?.toString() || '') !== coordinatorFilter) return false;
      if (q) {
        const haystack = [
          s.name, s.venue, s.city, s.state, s.sales_lead_name, s.coordinator_name, s.booth_number
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tradeShows, statusFilter, yearFilter, salesLeadFilter, coordinatorFilter, searchQuery]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tradeShowsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-shows'] }),
  });

  const handleDelete = async (show: TradeShow, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      message: `Are you sure you want to delete "${show.name}"? This will remove all attendees as well.`,
      title: 'Delete Trade Show',
      danger: true,
    });
    if (ok) deleteMutation.mutate(show.id);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setYearFilter('');
    setSalesLeadFilter('');
    setCoordinatorFilter('');
    setSearchQuery('');
  };

  const filtersActive =
    !!statusFilter || !!yearFilter || !!salesLeadFilter || !!coordinatorFilter || !!searchQuery.trim();

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Trade Shows', 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated ${today}  •  ${filtered.length} trade show${filtered.length === 1 ? '' : 's'}`, 40, 58);

    const filterLines: string[] = [];
    if (statusFilter) filterLines.push(`Status: ${statusLabel(statusFilter)}`);
    if (yearFilter) filterLines.push(`Year: ${yearFilter}`);
    if (salesLeadFilter) {
      const u = users?.find(x => x.id.toString() === salesLeadFilter);
      if (u) filterLines.push(`Sales Lead: ${u.first_name} ${u.last_name}`);
    }
    if (coordinatorFilter) {
      const u = users?.find(x => x.id.toString() === coordinatorFilter);
      if (u) filterLines.push(`Coordinator: ${u.first_name} ${u.last_name}`);
    }
    if (searchQuery.trim()) filterLines.push(`Search: "${searchQuery.trim()}"`);
    if (filterLines.length) {
      doc.text(`Filters — ${filterLines.join('  •  ')}`, 40, 74);
    }

    autoTable(doc, {
      startY: filterLines.length ? 90 : 76,
      head: [['Name', 'Status', 'Event Date', 'Venue', 'City/State', 'Sales Lead', 'Coordinator', 'Attendees', 'Total Cost', 'Reg. Deadline']],
      body: filtered.map(s => [
        s.name || '',
        statusLabel(s.status || ''),
        formatDateRange(s.event_start_date, s.event_end_date),
        s.venue || '',
        [s.city, s.state].filter(Boolean).join(', '),
        s.sales_lead_name || '',
        s.coordinator_name || '',
        String(s.attendee_count ?? 0),
        (() => { const t = totalCost(s); return t === null ? '' : fmtMoney(t); })(),
        formatDate(s.registration_deadline),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`trade-shows-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (isLoading) return <div className="loading">Loading trade shows...</div>;
  if (error) return <div className="error-message">Error loading trade shows</div>;

  return (
    <div className="container" style={{ maxWidth: 'min(100%, 1800px)', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>🎪 Trade Shows</h1>
            <div className="sales-subtitle">{filtered.length} trade show{filtered.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-secondary" onClick={exportPdf} disabled={filtered.length === 0}>
            📄 Export PDF
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/marketing/trade-shows/create')}>
            + New Trade Show
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              type="text"
              list="trade-show-suggestions"
              placeholder="Type to search name, venue, city…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <datalist id="trade-show-suggestions">
              {Array.from(new Set(
                (tradeShows || []).flatMap(s => [s.name, s.venue, s.city].filter((x): x is string => Boolean(x)))
              )).slice(0, 50).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {TRADE_SHOW_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Year</label>
            <select className="form-input" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All Years</option>
              {yearOptions.map(y => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sales Lead</label>
            <SearchableSelect
              options={userOptions}
              value={salesLeadFilter}
              onChange={setSalesLeadFilter}
              placeholder="-- Any --"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Coordinator</label>
            <SearchableSelect
              options={userOptions}
              value={coordinatorFilter}
              onChange={setCoordinatorFilter}
              placeholder="-- Any --"
            />
          </div>

          {filtersActive && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={clearFilters} style={{ width: '100%' }}>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎪</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
            {filtersActive ? 'No matching trade shows' : 'No trade shows yet'}
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            {filtersActive
              ? 'Try clearing or adjusting your filters'
              : 'Add your first trade show to start tracking events, registrations, and attendees.'}
          </p>
          {!filtersActive && (
            <button className="btn btn-primary" onClick={() => navigate('/marketing/trade-shows/create')}>
              + New Trade Show
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Event Date</th>
                  <th>Venue</th>
                  <th>City / State</th>
                  <th>Sales Lead</th>
                  <th>Coordinator</th>
                  <th style={{ textAlign: 'center' }}>Attendees</th>
                  <th style={{ textAlign: 'right' }}>Total Cost</th>
                  <th>Reg. Deadline</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(show => {
                  const cost = totalCost(show);
                  return (
                    <tr
                      key={show.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/marketing/trade-shows/${show.id}`)}
                    >
                      <td style={{ fontWeight: 600, color: '#1f2937' }}>{show.name}</td>
                      <td>
                        <span className={statusBadgeClass(show.status)}>{statusLabel(show.status)}</span>
                      </td>
                      <td className="sales-date-cell">{formatDateRange(show.event_start_date, show.event_end_date)}</td>
                      <td>{show.venue || '—'}</td>
                      <td>{[show.city, show.state].filter(Boolean).join(', ') || '—'}</td>
                      <td>{show.sales_lead_name || '—'}</td>
                      <td>{show.coordinator_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{show.attendee_count ?? 0}</td>
                      <td style={{ textAlign: 'right' }}>{cost === null ? '—' : fmtMoney(cost)}</td>
                      <td className="sales-date-cell">{formatDate(show.registration_deadline)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={(e) => handleDelete(show, e)}
                          title="Delete trade show"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '4px 8px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeShowList;
