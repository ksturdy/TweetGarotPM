import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, Meeting, MeetingSeries, ProjectActionItem, ActionItemStatus, MEETING_TYPES, RECURRENCE_LABELS } from '../../services/meetings';
import { projectsApi } from '../../services/projects';
import { format, parseISO } from 'date-fns';
import ForumIcon from '@mui/icons-material/Forum';
import AddIcon from '@mui/icons-material/Add';
import RepeatIcon from '@mui/icons-material/Repeat';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewListIcon from '@mui/icons-material/ViewList';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import MeetingCalendarMonth from './MeetingCalendarMonth';
import MeetingCalendarWeek from './MeetingCalendarWeek';
import '../../styles/SalesPipeline.css';
import './Meetings.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addMinsToTime(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function diffMins(startStr: string, endStr: string): number {
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
const PAGE_SIZE = 12;

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    draft: '#f59e0b',
    published: '#10b981',
    closed: '#6b7280',
  };
  return colors[status] || '#6b7280';
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`sales-stage-badge ${status}`}>
    <span className="sales-stage-dot" style={{ background: getStatusColor(status) }} />
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

const SeriesDialog: React.FC<{
  projectId: number;
  series?: MeetingSeries;
  onClose: () => void;
  onSaved: () => void;
}> = ({ projectId, series, onClose, onSaved }) => {
  const { toast } = useTitanFeedback();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: series?.title || '',
    meeting_type: series?.meeting_type || 'project_meeting',
    recurrence_type: series?.recurrence_type || 'weekly',
    day_of_week: series?.day_of_week ?? 1,
    start_time: series?.start_time || '',
    end_time: series?.end_time || '',
    location: series?.location || '',
    description: series?.description || '',
    carry_over_statuses: series?.carry_over_statuses?.length ? series.carry_over_statuses : ['open', 'in_progress'],
  });

  const initDuration = () => {
    if (series?.start_time && series?.end_time) {
      const mins = diffMins(series.start_time, series.end_time);
      return mins > 0 ? mins : 60;
    }
    return 60;
  };
  const [duration, setDuration] = useState(initDuration);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      series
        ? meetingsApi.updateSeries(series.id, form)
        : meetingsApi.createSeries({ ...form, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-series', projectId] });
      toast.success(series ? 'Series updated.' : 'Series created.');
      onSaved();
    },
    onError: () => toast.error('Failed to save series.'),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{series ? 'Edit Series' : 'New Meeting Series'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Series Name *</label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Weekly OAC" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Meeting Type</label>
              <select className="form-input" value={form.meeting_type} onChange={e => set('meeting_type', e.target.value)}>
                {Object.entries(MEETING_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Recurrence</label>
              <select className="form-input" value={form.recurrence_type} onChange={e => set('recurrence_type', e.target.value)}>
                {Object.entries(RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          {form.recurrence_type !== 'monthly' && (
            <div className="form-group">
              <label className="form-label">Day of Week</label>
              <select className="form-input" value={form.day_of_week} onChange={e => set('day_of_week', Number(e.target.value))}>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input
                className="form-input"
                type="time"
                value={form.start_time}
                onChange={e => {
                  const newStart = e.target.value;
                  set('start_time', newStart);
                  if (newStart && duration > 0) set('end_time', addMinsToTime(newStart, duration));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (min)</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={duration}
                onChange={e => {
                  const mins = Math.max(1, parseInt(e.target.value) || 1);
                  setDuration(mins);
                  if (form.start_time) set('end_time', addMinsToTime(form.start_time, mins));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input
                className="form-input"
                type="time"
                value={form.end_time}
                onChange={e => {
                  const newEnd = e.target.value;
                  set('end_time', newEnd);
                  if (form.start_time && newEnd) {
                    const mins = diffMins(form.start_time, newEnd);
                    if (mins > 0) setDuration(mins);
                  }
                }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Carry over to next meeting</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {[
                { value: 'open',        label: 'Open',        color: '#f97316' },
                { value: 'ongoing',     label: 'Ongoing',     color: '#3b82f6' },
                { value: 'on_hold',     label: 'On Hold',     color: '#ec4899' },
                { value: 'information', label: 'Information', color: '#0ea5e9' },
                { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
              ].map(s => {
                const active = form.carry_over_statuses.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set(
                      'carry_over_statuses',
                      active
                        ? form.carry_over_statuses.filter((v: string) => v !== s.value)
                        : [...form.carry_over_statuses, s.value]
                    )}
                    className={`sales-stage-badge${active ? '' : ''}`}
                    style={{
                      border: active ? `1.5px solid ${s.color}` : '1.5px solid #e5e7eb',
                      background: active ? `${s.color}18` : '#f9fafb',
                      color: active ? s.color : '#9ca3af',
                      cursor: 'pointer',
                      fontWeight: active ? 700 : 500,
                      opacity: active ? 1 : 0.7,
                    }}
                  >
                    <span className="sales-stage-dot" style={{ background: active ? s.color : '#d1d5db' }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              Action items with these statuses will be copied to the next meeting in this series.
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="sales-btn sales-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="sales-btn sales-btn-primary" onClick={() => mutation.mutate()} disabled={!form.title || mutation.isPending}>
            {mutation.isPending ? 'Saving…' : series ? 'Save Changes' : 'Create Series'}
          </button>
        </div>
      </div>
    </div>
  );
};

type SeriesRow = MeetingSeries & {
  meetings: Meeting[];
  firstDate: string | null;
  lastDate: string | null;
};

type FollowUpGroup = {
  key: string;
  title: string;
  meetings: Meeting[];
  firstDate: string | null;
  lastDate: string | null;
};

const MeetingList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast, confirm } = useTitanFeedback();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'meetings' | 'items' | 'templates'>('meetings');
  const [expandedSeries, setExpandedSeries] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'week' | 'month'>('list');
  const [page, setPage] = useState(1);
  const [showSeriesDialog, setShowSeriesDialog] = useState(false);
  const [editingSeries, setEditingSeries] = useState<MeetingSeries | undefined>();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const createMenuRef = useRef<HTMLDivElement>(null);

  const ALL_ACTION_STATUSES: ActionItemStatus[] = ['open', 'in_progress', 'ongoing', 'on_hold', 'information', 'closed'];
  const STATUS_META: Record<ActionItemStatus, { label: string; color: string }> = {
    open:        { label: 'Open',        color: '#f97316' },
    in_progress: { label: 'In Progress', color: '#3b82f6' },
    ongoing:     { label: 'Ongoing',     color: '#6366f1' },
    on_hold:     { label: 'On Hold',     color: '#ec4899' },
    information: { label: 'Information', color: '#0ea5e9' },
    closed:      { label: 'Closed',      color: '#6b7280' },
  };
  const [itemStatusFilter, setItemStatusFilter] = useState<Set<ActionItemStatus>>(
    new Set(['open', 'in_progress', 'ongoing', 'on_hold', 'information'])
  );
  const [itemSortField, setItemSortField] = useState<'due_date' | 'meeting_date' | 'status'>('due_date');
  const [itemSortDir, setItemSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: series = [] } = useQuery({
    queryKey: ['meeting-series', Number(projectId)],
    queryFn: () => meetingsApi.getSeriesByProject(Number(projectId)).then(r => r.data),
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings', Number(projectId)],
    queryFn: () => meetingsApi.getByProject(Number(projectId), {}).then(r => r.data),
  });

  const { data: allActionItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['meeting-action-items-project', Number(projectId)],
    queryFn: () => meetingsApi.getActionItemsByProject(Number(projectId)).then(r => r.data),
    enabled: activeTab === 'items',
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteSeries(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-series', Number(projectId)] });
      toast.success('Series deleted.');
    },
    onError: () => toast.error('Failed to delete series.'),
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', Number(projectId)] });
      toast.success('Meeting deleted.');
    },
    onError: () => toast.error('Failed to delete meeting.'),
  });

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
  };

  const meetingsBySeries = useMemo(() => {
    const map = new Map<number | null, Meeting[]>();
    meetings.forEach(m => {
      const key = m.series_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [meetings]);

  const seriesRows = useMemo((): SeriesRow[] => {
    return series.map(s => {
      const sm = (meetingsBySeries.get(s.id) || []).sort((a, b) =>
        (a.scheduled_date || '').localeCompare(b.scheduled_date || '')
      );
      const dates = sm.map(m => m.scheduled_date).filter(Boolean) as string[];
      return {
        ...s,
        meetings: sm,
        firstDate: dates[0] ?? null,
        lastDate: dates[dates.length - 1] ?? null,
      };
    });
  }, [series, meetingsBySeries]);

  // Build follow-up chains from meetings that have no series_id.
  // Meetings linked by previous_meeting_id are grouped together.
  const ungroupedGroups = useMemo((): FollowUpGroup[] => {
    const ungrouped = meetingsBySeries.get(null) || [];
    const byId = new Map<number, Meeting>(ungrouped.map(m => [m.id, m]));
    const followupOf = new Map<number, Meeting[]>();

    ungrouped.forEach(m => {
      if (m.previous_meeting_id) {
        if (!followupOf.has(m.previous_meeting_id)) followupOf.set(m.previous_meeting_id, []);
        followupOf.get(m.previous_meeting_id)!.push(m);
      }
    });

    const visited = new Set<number>();
    const groups: FollowUpGroup[] = [];

    const collectChain = (root: Meeting): Meeting[] => {
      const chain: Meeting[] = [];
      const queue = [root];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (visited.has(curr.id)) continue;
        visited.add(curr.id);
        chain.push(curr);
        (followupOf.get(curr.id) || []).forEach(m => queue.push(m));
      }
      return chain.sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''));
    };

    ungrouped
      .filter(m => !m.previous_meeting_id || !byId.has(m.previous_meeting_id))
      .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
      .forEach(root => {
        if (!visited.has(root.id)) {
          const chain = collectChain(root);
          const dates = chain.map(m => m.scheduled_date).filter(Boolean) as string[];
          groups.push({
            key: `fg-${root.id}`,
            title: root.title,
            meetings: chain,
            firstDate: dates[0] ?? null,
            lastDate: dates[dates.length - 1] ?? null,
          });
        }
      });

    return groups;
  }, [meetingsBySeries]);

  const filteredActionItems = useMemo((): ProjectActionItem[] => {
    const STATUS_ORDER: Record<ActionItemStatus, number> = {
      open: 0, in_progress: 1, ongoing: 2, on_hold: 3, information: 4, closed: 5,
    };
    const filtered = allActionItems.filter(ai => itemStatusFilter.has(ai.status as ActionItemStatus));
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (itemSortField === 'due_date') {
        if (!a.due_date && !b.due_date) cmp = 0;
        else if (!a.due_date) cmp = 1;
        else if (!b.due_date) cmp = -1;
        else cmp = a.due_date.localeCompare(b.due_date);
      } else if (itemSortField === 'meeting_date') {
        const ad = a.meeting_date || '';
        const bd = b.meeting_date || '';
        cmp = ad.localeCompare(bd);
      } else if (itemSortField === 'status') {
        cmp = (STATUS_ORDER[a.status as ActionItemStatus] ?? 9) - (STATUS_ORDER[b.status as ActionItemStatus] ?? 9);
      }
      return itemSortDir === 'asc' ? cmp : -cmp;
    });
  }, [allActionItems, itemStatusFilter, itemSortField, itemSortDir]);

  const totalRows = seriesRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const paginatedRows = seriesRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showingFrom = totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, totalRows);

  const toggleSeries = (id: number) => {
    setExpandedSeries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleFollowUp = async (meetings: Meeting[]) => {
    const latest = [...meetings].sort((a, b) =>
      (b.scheduled_date || '').localeCompare(a.scheduled_date || '')
    );
    if (latest.length > 0) {
      try {
        const res = await meetingsApi.scheduleFollowup(latest[0].id);
        queryClient.invalidateQueries({ queryKey: ['meetings', Number(projectId)] });
        navigate(`/projects/${projectId}/meetings/${res.data.id}`);
      } catch {
        toast.error('Failed to create follow-up.');
      }
    } else {
      navigate(`/projects/${projectId}/meetings/new`);
    }
  };

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <h1><ForumIcon style={{ verticalAlign: 'middle', marginRight: 8, fontSize: 28 }} />Meetings</h1>
          {project && <div className="sales-subtitle">{project.name}</div>}
        </div>
        <div className="sales-header-actions">
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', height: 36 }}>
            {([
              ['list', <ViewListIcon fontSize="small" />, 'List view'],
              ['week', <ViewWeekIcon fontSize="small" />, 'Week view'],
              ['month', <CalendarMonthIcon fontSize="small" />, 'Month view'],
            ] as const).map(([mode, icon, label]) => (
              <button
                key={mode}
                title={label}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, border: 'none', cursor: 'pointer',
                  borderLeft: mode !== 'list' ? '1px solid #d1d5db' : 'none',
                  background: viewMode === mode ? '#1e3a5f' : '#fff',
                  color: viewMode === mode ? '#fff' : '#374151',
                }}
              >
                {icon}
              </button>
            ))}
          </div>
          <button
            title="Filter"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, border: '1px solid #d1d5db', borderRadius: 6,
              background: '#fff', color: '#374151', cursor: 'pointer',
            }}
          >
            <FilterListIcon fontSize="small" />
          </button>
          {/* Create meeting split button */}
          <div ref={createMenuRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', height: 36 }}>
              <button
                className="sales-btn sales-btn-primary"
                style={{ height: 36, borderRadius: '6px 0 0 6px', borderRight: '1px solid rgba(255,255,255,0.25)' }}
                onClick={() => navigate(`/projects/${projectId}/meetings/new`)}
              >
                Create meeting
              </button>
              <button
                className="sales-btn sales-btn-primary"
                style={{ height: 36, padding: '0 6px', borderRadius: '0 6px 6px 0' }}
                onClick={() => setShowCreateMenu(m => !m)}
              >
                <ArrowDropDownIcon fontSize="small" />
              </button>
            </div>
            {showCreateMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200,
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 170, overflow: 'hidden',
              }}>
                {[
                  { label: 'New Meeting', icon: <AddIcon style={{ fontSize: 14 }} />, action: () => navigate(`/projects/${projectId}/meetings/new`) },
                  { label: 'New Series', icon: <RepeatIcon style={{ fontSize: 14 }} />, action: () => { setEditingSeries(undefined); setShowSeriesDialog(true); } },
                ].map(item => (
                  <button
                    key={item.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 16px', textAlign: 'left',
                      border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#374151',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    onClick={() => { setShowCreateMenu(false); item.action(); }}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        {(['meetings', 'items', 'templates'] as const).map(tab => (
          <button
            key={tab}
            className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Calendar views */}
      {viewMode === 'month' && (
        <MeetingCalendarMonth meetings={meetings} projectId={projectId!} onNavigate={navigate} />
      )}
      {viewMode === 'week' && (
        <MeetingCalendarWeek meetings={meetings} projectId={projectId!} onNavigate={navigate} />
      )}

      {/* List — Meetings tab */}
      {viewMode === 'list' && activeTab === 'meetings' && (
        <>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading meetings…</div>
          ) : seriesRows.length === 0 && ungroupedGroups.length === 0 ? (
            <div className="sales-table-section">
              <div className="empty-state">
                <ForumIcon style={{ fontSize: 48, color: '#d1d5db', display: 'block', margin: '0 auto 12px' }} />
                <p>No meetings yet. Create a meeting or set up a recurring series.</p>
              </div>
            </div>
          ) : (
            <div className="sales-table-section">
              <div style={{ overflowX: 'auto' }}>
              <table className="sales-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Meeting series</th>
                    <th style={{ width: 130 }}>Count</th>
                    <th style={{ width: 280 }}>Date range</th>
                    <th style={{ width: 200 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map(row => {
                    const isExpanded = expandedSeries.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr>
                          <td>
                            <button className="btn-icon" onClick={() => toggleSeries(row.id)}>
                              {isExpanded
                                ? <ExpandMoreIcon style={{ fontSize: 18 }} />
                                : <ChevronRightIcon style={{ fontSize: 18 }} />}
                            </button>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500, color: '#1e3a5f' }}>{row.title}</span>
                            {row.recurrence_type && (
                              <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 12 }}>
                                {RECURRENCE_LABELS[row.recurrence_type]}
                                {row.day_of_week != null && row.recurrence_type !== 'monthly'
                                  ? ` · ${DAY_NAMES[row.day_of_week]}` : ''}
                              </span>
                            )}
                          </td>
                          <td style={{ color: '#6b7280', fontSize: 13 }}>
                            {row.meetings.length} Meeting{row.meetings.length !== 1 ? 's' : ''}
                          </td>
                          <td style={{ color: '#6b7280', fontSize: 13 }}>
                            {row.firstDate
                              ? row.firstDate === row.lastDate
                                ? formatDate(row.firstDate)
                                : `${formatDate(row.firstDate)} – ${formatDate(row.lastDate)}`
                              : '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              <button
                                className="sales-btn sales-btn-secondary"
                                onClick={() => handleFollowUp(row.meetings)}
                              >
                                <AddIcon fontSize="small" /> Follow-up
                              </button>
                              <button className="btn-icon" title="Edit series"
                                onClick={() => { setEditingSeries(row); setShowSeriesDialog(true); }}>
                                <EditIcon style={{ fontSize: 15 }} />
                              </button>
                              <button className="btn-icon btn-icon-danger" title="Delete series"
                                onClick={async () => {
                                  const ok = await confirm({ title: 'Delete Series?', message: 'Meetings will not be deleted.', confirmText: 'Delete', danger: true });
                                  if (ok) deleteSeriesMutation.mutate(row.id);
                                }}>
                                <DeleteIcon style={{ fontSize: 15 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && row.meetings.map(m => (
                          <tr
                            key={`m-${m.id}`}
                            style={{ cursor: 'pointer', background: '#f9fafb' }}
                            onClick={() => navigate(`/projects/${projectId}/meetings/${m.id}`)}
                          >
                            <td></td>
                            <td style={{ paddingLeft: 28 }}>
                              <div style={{ fontWeight: 500, fontSize: 13, color: '#374151' }}>
                                #{m.number} · {m.title}
                              </div>
                              {m.location && (
                                <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.location}</div>
                              )}
                            </td>
                            <td><StatusBadge status={m.status} /></td>
                            <td style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(m.scheduled_date)}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn-icon btn-icon-danger" title="Delete meeting"
                                  onClick={async () => {
                                    const ok = await confirm({ title: `Delete Meeting #${m.number}?`, message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
                                    if (ok) deleteMeetingMutation.mutate(m.id);
                                  }}>
                                  <DeleteIcon style={{ fontSize: 14 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* One-off / follow-up chains */}
                  {ungroupedGroups.length > 0 && (
                    <>
                      {paginatedRows.length > 0 && (
                        <tr>
                          <td colSpan={5} style={{
                            padding: '6px 16px', background: '#f3f4f6',
                            fontSize: 11, fontWeight: 700, color: '#9ca3af',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                          }}>
                            One-off &amp; Follow-up Meetings ({ungroupedGroups.reduce((n, g) => n + g.meetings.length, 0)})
                          </td>
                        </tr>
                      )}
                      {ungroupedGroups.map(group => {
                        const isExpanded = expandedGroups.has(group.key);
                        const hasMultiple = group.meetings.length > 1;

                        if (!hasMultiple) {
                          const m = group.meetings[0];
                          return (
                            <tr
                              key={group.key}
                              style={{ cursor: 'pointer' }}
                              onClick={() => navigate(`/projects/${projectId}/meetings/${m.id}`)}
                            >
                              <td></td>
                              <td>
                                <div style={{ fontWeight: 500, fontSize: 13, color: '#374151' }}>#{m.number} · {m.title}</div>
                                {m.location && <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.location}</div>}
                              </td>
                              <td><StatusBadge status={m.status} /></td>
                              <td style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(m.scheduled_date)}</td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button className="sales-btn sales-btn-secondary" onClick={() => handleFollowUp(group.meetings)}>
                                    <AddIcon fontSize="small" /> Follow-up
                                  </button>
                                  <button className="btn-icon btn-icon-danger" title="Delete"
                                    onClick={async () => {
                                      const ok = await confirm({ title: `Delete Meeting #${m.number}?`, message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
                                      if (ok) deleteMeetingMutation.mutate(m.id);
                                    }}>
                                    <DeleteIcon style={{ fontSize: 14 }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <React.Fragment key={group.key}>
                            <tr>
                              <td>
                                <button className="btn-icon" onClick={() => toggleGroup(group.key)}>
                                  {isExpanded
                                    ? <ExpandMoreIcon style={{ fontSize: 18 }} />
                                    : <ChevronRightIcon style={{ fontSize: 18 }} />}
                                </button>
                              </td>
                              <td>
                                <span style={{ fontWeight: 500, color: '#1e3a5f' }}>{group.title}</span>
                                <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 12 }}>Follow-up chain</span>
                              </td>
                              <td style={{ color: '#6b7280', fontSize: 13 }}>
                                {group.meetings.length} Meetings
                              </td>
                              <td style={{ color: '#6b7280', fontSize: 13 }}>
                                {group.firstDate === group.lastDate
                                  ? formatDate(group.firstDate)
                                  : `${formatDate(group.firstDate)} – ${formatDate(group.lastDate)}`}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button className="sales-btn sales-btn-secondary" onClick={() => handleFollowUp(group.meetings)}>
                                    <AddIcon fontSize="small" /> Follow-up
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && group.meetings.map(m => (
                              <tr
                                key={`m-${m.id}`}
                                style={{ cursor: 'pointer', background: '#f9fafb' }}
                                onClick={() => navigate(`/projects/${projectId}/meetings/${m.id}`)}
                              >
                                <td></td>
                                <td style={{ paddingLeft: 28 }}>
                                  <div style={{ fontWeight: 500, fontSize: 13, color: '#374151' }}>
                                    #{m.number} · {m.title}
                                  </div>
                                  {m.location && <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.location}</div>}
                                </td>
                                <td><StatusBadge status={m.status} /></td>
                                <td style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(m.scheduled_date)}</td>
                                <td onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn-icon btn-icon-danger" title="Delete"
                                      onClick={async () => {
                                        const ok = await confirm({ title: `Delete Meeting #${m.number}?`, message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
                                        if (ok) deleteMeetingMutation.mutate(m.id);
                                      }}>
                                      <DeleteIcon style={{ fontSize: 14 }} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
              </div>

              {/* Pagination */}
              {totalRows > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderTop: '1px solid #e5e7eb',
                  fontSize: 13, color: '#6b7280',
                }}>
                  <span>Showing {showingFrom}–{showingTo} of {totalRows}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button className="btn-icon" disabled={page === 1} onClick={() => setPage(1)}
                      style={{ opacity: page === 1 ? 0.4 : 1 }}>«</button>
                    <button className="btn-icon" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      style={{ opacity: page === 1 ? 0.4 : 1 }}>‹</button>
                    <span style={{ padding: '0 10px', fontWeight: 500 }}>{page} of {totalPages}</span>
                    <button className="btn-icon" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                      style={{ opacity: page === totalPages ? 0.4 : 1 }}>›</button>
                    <button className="btn-icon" disabled={page === totalPages} onClick={() => setPage(totalPages)}
                      style={{ opacity: page === totalPages ? 0.4 : 1 }}>»</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Items tab */}
      {viewMode === 'list' && activeTab === 'items' && (
        <div className="sales-table-section">
          {/* Filter + sort bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_ACTION_STATUSES.map(s => {
                const meta = STATUS_META[s];
                const active = itemStatusFilter.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setItemStatusFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s); else next.add(s);
                        return next;
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      border: `1.5px solid ${active ? meta.color : '#e5e7eb'}`,
                      background: active ? `${meta.color}18` : '#f9fafb',
                      color: active ? meta.color : '#9ca3af',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? meta.color : '#d1d5db', display: 'inline-block' }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Sort by</span>
              <select
                className="form-input"
                style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
                value={`${itemSortField}:${itemSortDir}`}
                onChange={e => {
                  const [field, dir] = e.target.value.split(':');
                  setItemSortField(field as any);
                  setItemSortDir(dir as any);
                }}
              >
                <option value="due_date:asc">Due Date (soonest first)</option>
                <option value="due_date:desc">Due Date (latest first)</option>
                <option value="meeting_date:desc">Meeting Date (newest first)</option>
                <option value="meeting_date:asc">Meeting Date (oldest first)</option>
                <option value="status:asc">Status</option>
              </select>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                {filteredActionItems.length} item{filteredActionItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {itemsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
          ) : filteredActionItems.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: '#6b7280' }}>No action items match the selected filters.</p>
            </div>
          ) : (
            <table className="sales-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>#</th>
                  <th>Description</th>
                  <th>Assignee</th>
                  <th>Meeting</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredActionItems.map((ai, idx) => {
                  const meta = STATUS_META[ai.status as ActionItemStatus] || { label: ai.status, color: '#6b7280' };
                  const dueDate = ai.due_date
                    ? (() => { try { return format(parseISO(ai.due_date), 'MMM d, yyyy'); } catch { return ai.due_date; } })()
                    : null;
                  const isPast = ai.due_date && ai.status !== 'closed' && ai.due_date < new Date().toISOString().slice(0, 10);
                  const assigneeDisplay = ai.assignee_display || ai.assignee_user_name || ai.assignee_name;
                  return (
                    <tr
                      key={ai.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${projectId}/meetings/${ai.meeting_id}`)}
                    >
                      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, verticalAlign: 'middle' }}>{idx + 1}</td>
                      <td style={{ verticalAlign: 'top', paddingTop: 12, paddingBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ai.description}
                        </div>
                        {ai.agenda_item_title && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ai.agenda_item_title}
                          </div>
                        )}
                        {ai.originated_meeting_number && ai.originated_meeting_id !== ai.meeting_id && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            Carried from #{ai.originated_meeting_number}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: '#374151', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {assigneeDisplay || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ verticalAlign: 'middle', overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          #{ai.meeting_number} · {ai.meeting_title}
                        </div>
                        {ai.meeting_date && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            {(() => { try { return format(parseISO(ai.meeting_date), 'MMM d, yyyy'); } catch { return ''; } })()}
                          </div>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        {dueDate ? (
                          <>
                            <div style={{ fontSize: 12, color: isPast ? '#ef4444' : '#374151', fontWeight: isPast ? 600 : 400 }}>
                              {dueDate}
                            </div>
                            {isPast && (
                              <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Overdue</div>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 600, color: meta.color,
                          background: `${meta.color}12`, padding: '3px 10px', borderRadius: 20,
                          border: `1px solid ${meta.color}40`,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Templates tab */}
      {viewMode === 'list' && activeTab === 'templates' && (
        <div className="sales-table-section">
          <div className="empty-state">
            <p>Meeting templates coming soon.</p>
          </div>
        </div>
      )}

      {showSeriesDialog && (
        <SeriesDialog
          projectId={Number(projectId)}
          series={editingSeries}
          onClose={() => setShowSeriesDialog(false)}
          onSaved={() => setShowSeriesDialog(false)}
        />
      )}
    </div>
  );
};

export default MeetingList;
