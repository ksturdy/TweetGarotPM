import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LinkIcon from '@mui/icons-material/Link';
import DeleteIcon from '@mui/icons-material/Delete';
import TuneIcon from '@mui/icons-material/Tune';
import { Link, useNavigate } from 'react-router-dom';
import TradeShowURLImportDialog from './TradeShowURLImportDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  tradeShowsApi,
  TradeShow,
  TRADE_SHOW_STATUS_OPTIONS,
  EVENT_TYPE_OPTIONS,
} from '../../../services/tradeShows';
import { MARKETS } from '../../../constants/markets';
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
    date_tbd: 'badge badge-purple',
    registered: 'badge badge-info',
    in_progress: 'badge badge-warning',
    completed: 'badge badge-success',
    cancelled: 'badge badge-danger',
  };
  return map[status] || 'badge';
};

const statusLabel = (status: string) => {
  if (status === 'date_tbd') return 'Date TBD';
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const FILTER_DEFAULTS_KEY = 'trade-shows-filter-defaults';
type FilterDefaults = { statusFilter: string[]; yearFilter: string[]; eventTypeFilter: string[]; marketFilter: string[] };
const EMPTY_DEFAULTS: FilterDefaults = { statusFilter: [], yearFilter: [], eventTypeFilter: [], marketFilter: [] };
const loadFilterDefaults = (): FilterDefaults => {
  try { const s = localStorage.getItem(FILTER_DEFAULTS_KEY); if (s) return { ...EMPTY_DEFAULTS, ...JSON.parse(s) }; } catch {}
  return EMPTY_DEFAULTS;
};

const MultiSelectFilter: React.FC<{
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}> = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);

  const displayText = value.length === 0
    ? placeholder
    : value.length === 1
      ? (options.find(o => o.value === value[0])?.label ?? value[0])
      : `${value.length} selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="form-input"
        style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: value.length ? 'var(--text-primary)' : '#9ca3af' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText}</span>
        <span style={{ opacity: 0.5, fontSize: '0.7rem', marginLeft: 4, flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', marginTop: 2, maxHeight: 240, overflowY: 'auto' }}>
          {value.length > 0 && (
            <div style={{ padding: '0.35rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
              <button type="button" style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }} onClick={() => onChange([])}>
                Clear selection
              </button>
            </div>
          )}
          {options.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem', color: '#374151', userSelect: 'none' }}>
              <input type="checkbox" checked={value.includes(opt.value)} onChange={() => toggle(opt.value)} style={{ margin: 0, cursor: 'pointer' }} />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const COL_WIDTHS_KEY = 'trade-shows-col-widths';
const DEFAULT_COL_WIDTHS = {
  name: 200, status: 82, event_type: 70, market: 80,
  event_date: 148, venue: 150, city: 95, sales_lead: 90,
  coordinator: 88, attendees: 62, total_cost: 76, reg_deadline: 80, actions: 36,
};
type ColKey = keyof typeof DEFAULT_COL_WIDTHS;

const TradeShowList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [statusFilter, setStatusFilter] = useState<string[]>(() => loadFilterDefaults().statusFilter);
  const [yearFilter, setYearFilter] = useState<string[]>(() => loadFilterDefaults().yearFilter);
  const [salesLeadFilter, setSalesLeadFilter] = useState<string>('');
  const [coordinatorFilter, setCoordinatorFilter] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>(() => loadFilterDefaults().eventTypeFilter);
  const [marketFilter, setMarketFilter] = useState<string[]>(() => loadFilterDefaults().marketFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('event_start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<FilterDefaults>(EMPTY_DEFAULTS);

  const [colWidths, setColWidths] = useState<typeof DEFAULT_COL_WIDTHS>(() => {
    try {
      const stored = localStorage.getItem(COL_WIDTHS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Discard stored widths if their total is wildly different from defaults (stale data)
        const total = Object.values(parsed as Record<string, number>).reduce((a, b) => a + b, 0);
        const defaultTotal = Object.values(DEFAULT_COL_WIDTHS).reduce((a, b) => a + b, 0);
        if (total > 0 && total < defaultTotal * 2.5) return { ...DEFAULT_COL_WIDTHS, ...parsed };
      }
    } catch {}
    return DEFAULT_COL_WIDTHS;
  });

  useEffect(() => {
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  const startResize = useCallback((col: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[col];
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + ev.clientX - startX);
      setColWidths(prev => ({ ...prev, [col]: newWidth }));
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

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
      if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;
      if (yearFilter.length > 0) {
        const y = s.event_start_date
          ? new Date(s.event_start_date.includes('T') ? s.event_start_date : s.event_start_date + 'T00:00:00').getFullYear()
          : null;
        if (y === null || !yearFilter.includes(y.toString())) return false;
      }
      if (salesLeadFilter && (s.sales_lead_id?.toString() || '') !== salesLeadFilter) return false;
      if (coordinatorFilter && (s.coordinator_id?.toString() || '') !== coordinatorFilter) return false;
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(s.event_type ?? '')) return false;
      if (marketFilter.length > 0 && !marketFilter.includes(s.market ?? '')) return false;
      if (q) {
        const haystack = [
          s.name, s.venue, s.city, s.state, s.sales_lead_name, s.coordinator_name, s.booth_number
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tradeShows, statusFilter, yearFilter, salesLeadFilter, coordinatorFilter, eventTypeFilter, marketFilter, searchQuery]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      switch (sortKey) {
        case 'name':       av = a.name?.toLowerCase() ?? ''; bv = b.name?.toLowerCase() ?? ''; break;
        case 'status':     av = a.status ?? ''; bv = b.status ?? ''; break;
        case 'event_start_date': av = a.event_start_date ?? ''; bv = b.event_start_date ?? ''; break;
        case 'city':       av = [a.city, a.state].filter(Boolean).join(', ').toLowerCase(); bv = [b.city, b.state].filter(Boolean).join(', ').toLowerCase(); break;
        case 'sales_lead':  av = a.sales_lead_name?.toLowerCase() ?? ''; bv = b.sales_lead_name?.toLowerCase() ?? ''; break;
        case 'cost':        av = totalCost(a) ?? -1; bv = totalCost(b) ?? -1; break;
        case 'attendees':   av = a.attendee_count ?? 0; bv = b.attendee_count ?? 0; break;
        case 'event_type':  av = a.event_type?.toLowerCase() ?? ''; bv = b.event_type?.toLowerCase() ?? ''; break;
        case 'market':      av = a.market?.toLowerCase() ?? ''; bv = b.market?.toLowerCase() ?? ''; break;
        default: return 0;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: string) => (
    <span className="sales-sort-icon">{sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  );

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
    setStatusFilter([]);
    setYearFilter([]);
    setSalesLeadFilter('');
    setCoordinatorFilter('');
    setEventTypeFilter([]);
    setMarketFilter([]);
    setSearchQuery('');
  };

  const filtersActive =
    statusFilter.length > 0 || yearFilter.length > 0 || !!salesLeadFilter || !!coordinatorFilter ||
    eventTypeFilter.length > 0 || marketFilter.length > 0 || !!searchQuery.trim();

  const openSettings = () => {
    setSettingsForm(loadFilterDefaults());
    setShowSettings(true);
  };

  const saveSettings = () => {
    localStorage.setItem(FILTER_DEFAULTS_KEY, JSON.stringify(settingsForm));
    setStatusFilter(settingsForm.statusFilter);
    setYearFilter(settingsForm.yearFilter);
    setEventTypeFilter(settingsForm.eventTypeFilter);
    setMarketFilter(settingsForm.marketFilter);
    setShowSettings(false);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Conferences and Trade Shows', 40, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated ${today}  •  ${filtered.length} trade show${filtered.length === 1 ? '' : 's'}`, 40, 58);

    const filterLines: string[] = [];
    if (statusFilter.length) filterLines.push(`Status: ${statusFilter.map(statusLabel).join(', ')}`);
    if (yearFilter.length) filterLines.push(`Year: ${yearFilter.join(', ')}`);
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
      head: [['Name', 'Status', 'Event Type', 'Market', 'Event Date', 'Venue', 'City/State', 'Sales Lead', 'Attendees', 'Total Cost', 'Reg. Deadline']],
      body: filtered.map(s => [
        s.name || '',
        statusLabel(s.status || ''),
        s.event_type ? (EVENT_TYPE_OPTIONS.find(o => o.value === s.event_type)?.label ?? s.event_type) : '',
        s.market ? (MARKETS.find(o => o.value === s.market)?.label ?? s.market) : '',
        formatDateRange(s.event_start_date, s.event_end_date),
        s.venue || '',
        [s.city, s.state].filter(Boolean).join(', '),
        s.sales_lead_name || '',
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
    <>
    <div className="container" style={{ maxWidth: 'min(100%, 1800px)', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>Conferences and Trade Shows</h1>
            <div className="sales-subtitle">{filtered.length} trade show{filtered.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-secondary" onClick={exportPdf} disabled={filtered.length === 0}>
            <PictureAsPdfIcon style={{ fontSize: 16, marginRight: 6, verticalAlign: 'middle' }} /> Export PDF
          </button>
          <button className="btn btn-secondary" onClick={() => setShowImportDialog(true)}>
            <LinkIcon style={{ fontSize: 16, marginRight: 6, verticalAlign: 'middle' }} /> Import from URL
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/marketing/trade-shows/create')}>
            + New Event
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', overflow: 'visible' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
          <button
            type="button"
            onClick={openSettings}
            title="Default view settings"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'inline-flex', alignItems: 'center', padding: '2px 4px', borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            <TuneIcon style={{ fontSize: 18 }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
            <MultiSelectFilter options={TRADE_SHOW_STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} placeholder="All Statuses" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Year</label>
            <MultiSelectFilter options={yearOptions.map(y => ({ value: y.toString(), label: y.toString() }))} value={yearFilter} onChange={setYearFilter} placeholder="All Years" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sales Lead</label>
            <SearchableSelect options={userOptions} value={salesLeadFilter} onChange={setSalesLeadFilter} placeholder="-- Any --" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Coordinator</label>
            <SearchableSelect options={userOptions} value={coordinatorFilter} onChange={setCoordinatorFilter} placeholder="-- Any --" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Event Type</label>
            <MultiSelectFilter options={EVENT_TYPE_OPTIONS} value={eventTypeFilter} onChange={setEventTypeFilter} placeholder="All Types" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Market</label>
            <MultiSelectFilter options={MARKETS} value={marketFilter} onChange={setMarketFilter} placeholder="All Markets" />
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
              + New Event
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table sales-table--wrap" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {([
                    { key: 'name', label: 'Name', sort: 'name', align: 'left' },
                    { key: 'status', label: 'Status', sort: 'status', align: 'left' },
                    { key: 'event_type', label: 'Event Type', sort: 'event_type', align: 'left' },
                    { key: 'market', label: 'Market', sort: 'market', align: 'left' },
                    { key: 'event_date', label: 'Event Date', sort: 'event_start_date', align: 'left' },
                    { key: 'venue', label: 'Venue', sort: null, align: 'left' },
                    { key: 'city', label: 'City / State', sort: 'city', align: 'left' },
                    { key: 'sales_lead', label: 'Sales Lead', sort: 'sales_lead', align: 'left' },
                    { key: 'coordinator', label: 'Coordinator', sort: null, align: 'left' },
                    { key: 'attendees', label: 'Attendees', sort: 'attendees', align: 'center' },
                    { key: 'total_cost', label: 'Total Cost', sort: 'cost', align: 'right' },
                    { key: 'reg_deadline', label: 'Reg. Deadline', sort: null, align: 'left' },
                  ] as { key: ColKey; label: string; sort: string | null; align: string }[]).map(col => (
                    <th
                      key={col.key}
                      style={{ position: 'relative', whiteSpace: 'nowrap', width: colWidths[col.key], textAlign: col.align as any, cursor: col.sort ? 'pointer' : 'default' }}
                      onClick={col.sort ? () => handleSort(col.sort!) : undefined}
                    >
                      {col.label}{col.sort ? <> {sortIcon(col.sort)}</> : null}
                      <div
                        style={{ position: 'absolute', top: 0, right: 0, width: 8, height: '100%', cursor: 'col-resize', zIndex: 1 }}
                        onMouseDown={(e) => startResize(col.key, e)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  ))}
                  <th style={{ width: colWidths.actions }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(show => {
                  const cost = totalCost(show);
                  return (
                    <tr
                      key={show.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/marketing/trade-shows/${show.id}`)}
                    >
                      <td style={{ fontWeight: 600, color: '#1f2937' }}>{show.name}</td>
                      <td>
                        <span className={statusBadgeClass(show.status)} style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{statusLabel(show.status)}</span>
                      </td>
                      <td>{show.event_type ? (EVENT_TYPE_OPTIONS.find(o => o.value === show.event_type)?.label ?? show.event_type) : '—'}</td>
                      <td>{show.market ? (MARKETS.find(o => o.value === show.market)?.label ?? show.market) : '—'}</td>
                      <td className="sales-date-cell">{formatDateRange(show.event_start_date, show.event_end_date)}</td>
                      <td>{show.venue || '—'}</td>
                      <td>{[show.city, show.state].filter(Boolean).join(', ') || '—'}</td>
                      <td>{show.sales_lead_name || '—'}</td>
                      <td>{show.coordinator_name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{show.attendee_count ?? 0}</td>
                      <td style={{ textAlign: 'right' }}>{cost === null ? '—' : fmtMoney(cost)}</td>
                      <td className="sales-date-cell">{formatDate(show.registration_deadline)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={(e) => handleDelete(show, e)}
                          title="Delete trade show"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                        >
                          <DeleteIcon style={{ fontSize: 16 }} />
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

    {showImportDialog && <TradeShowURLImportDialog onClose={() => setShowImportDialog(false)} />}

    {showSettings && (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        onClick={() => setShowSettings(false)}
      >
        <div
          style={{ background: 'white', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 520, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
          onClick={e => e.stopPropagation()}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: '0.35rem' }}>Default View Settings</h2>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            These filters will be applied automatically each time you open this page.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Statuses</label>
              <MultiSelectFilter options={TRADE_SHOW_STATUS_OPTIONS} value={settingsForm.statusFilter} onChange={v => setSettingsForm(f => ({ ...f, statusFilter: v }))} placeholder="All Statuses" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Years</label>
              <MultiSelectFilter options={yearOptions.map(y => ({ value: y.toString(), label: y.toString() }))} value={settingsForm.yearFilter} onChange={v => setSettingsForm(f => ({ ...f, yearFilter: v }))} placeholder="All Years" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Event Types</label>
              <MultiSelectFilter options={EVENT_TYPE_OPTIONS} value={settingsForm.eventTypeFilter} onChange={v => setSettingsForm(f => ({ ...f, eventTypeFilter: v }))} placeholder="All Types" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default Markets</label>
              <MultiSelectFilter options={MARKETS} value={settingsForm.marketFilter} onChange={v => setSettingsForm(f => ({ ...f, marketFilter: v }))} placeholder="All Markets" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
              onClick={() => { setSettingsForm(EMPTY_DEFAULTS); localStorage.removeItem(FILTER_DEFAULTS_KEY); }}
            >
              Clear all defaults
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveSettings}>Save Defaults</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default TradeShowList;
