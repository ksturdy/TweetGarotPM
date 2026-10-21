import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, Meeting, MeetingSeries, MEETING_TYPES, RECURRENCE_LABELS } from '../../services/meetings';
import { projectsApi } from '../../services/projects';
import { format, parseISO } from 'date-fns';
import ForumIcon from '@mui/icons-material/Forum';
import AddIcon from '@mui/icons-material/Add';
import RepeatIcon from '@mui/icons-material/Repeat';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';
import './Meetings.css';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  });

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input className="form-input" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input className="form-input" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} />
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

const MeetingList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast, confirm } = useTitanFeedback();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('all');
  const [seriesOpen, setSeriesOpen] = useState(true);
  const [showSeriesDialog, setShowSeriesDialog] = useState(false);
  const [editingSeries, setEditingSeries] = useState<MeetingSeries | undefined>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: series = [] } = useQuery({
    queryKey: ['meeting-series', Number(projectId)],
    queryFn: () => meetingsApi.getSeriesByProject(Number(projectId)).then(r => r.data),
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings', Number(projectId), statusFilter],
    queryFn: () => meetingsApi.getByProject(Number(projectId), statusFilter !== 'all' ? { status: statusFilter } : {}).then(r => r.data),
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

  const formatTime = (t: string | null) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const filteredMeetings = statusFilter === 'all' ? meetings : meetings.filter(m => m.status === statusFilter);

  const draftCount = meetings.filter(m => m.status === 'draft').length;
  const publishedCount = meetings.filter(m => m.status === 'published').length;
  const closedCount = meetings.filter(m => m.status === 'closed').length;
  const openActions = meetings.reduce((sum, m) => sum + (Number(m.open_action_count) || 0), 0);

  return (
    <div className="sales-container">
      {/* Page header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <h1><ForumIcon style={{ verticalAlign: 'middle', marginRight: 8, fontSize: 28 }} />Meetings</h1>
          {project && <div className="sales-subtitle">{project.name}</div>}
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary" onClick={() => { setEditingSeries(undefined); setShowSeriesDialog(true); }}>
            <RepeatIcon fontSize="small" /> New Series
          </button>
          <button className="sales-btn sales-btn-primary" onClick={() => navigate(`/projects/${projectId}/meetings/new`)}>
            <AddIcon fontSize="small" /> New Meeting
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total Meetings', value: meetings.length },
          { label: 'Draft', value: draftCount },
          { label: 'Published', value: publishedCount },
          { label: 'Closed', value: closedCount },
          { label: 'Open Actions', value: openActions, highlight: openActions > 0 },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.highlight ? '#ef4444' : '#1e3a5f' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Series panel */}
      {series.length > 0 && (
        <div className="meetings-series-panel">
          <button className="meetings-series-toggle" onClick={() => setSeriesOpen(o => !o)}>
            <RepeatIcon style={{ fontSize: 16 }} />
            <span>Meeting Series ({series.length})</span>
            {seriesOpen ? <ExpandLessIcon style={{ fontSize: 18 }} /> : <ExpandMoreIcon style={{ fontSize: 18 }} />}
          </button>
          {seriesOpen && (
            <div className="meetings-series-list">
              {series.map(s => (
                <div key={s.id} className="meetings-series-item">
                  <div className="meetings-series-item-left">
                    <span className="meetings-series-title">{s.title}</span>
                    <span className="sales-stage-badge" style={{ marginLeft: 8 }}>
                      <span className="sales-stage-dot" style={{ background: '#3b82f6' }} />
                      {RECURRENCE_LABELS[s.recurrence_type]}
                      {s.day_of_week != null && s.recurrence_type !== 'monthly' ? ` · ${DAY_NAMES[s.day_of_week]}` : ''}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: 13, marginLeft: 8 }}>
                      {s.meeting_count} meetings
                      {s.last_meeting_date ? ` · Last: ${formatDate(s.last_meeting_date)}` : ''}
                    </span>
                  </div>
                  <div className="meetings-series-item-right">
                    {Number(s.open_action_count) > 0 && (
                      <span className="sales-stage-badge">
                        <span className="sales-stage-dot" style={{ background: '#f59e0b' }} />
                        {s.open_action_count} open actions
                      </span>
                    )}
                    <button className="btn-icon" title="Edit series" onClick={() => { setEditingSeries(s); setShowSeriesDialog(true); }}>
                      <EditIcon style={{ fontSize: 16 }} />
                    </button>
                    <button className="btn-icon btn-icon-danger" title="Delete series"
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete Series?', message: 'Meetings will not be deleted.', confirmText: 'Delete', danger: true });
                        if (ok) deleteSeriesMutation.mutate(s.id);
                      }}>
                      <DeleteIcon style={{ fontSize: 16 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="filter-tabs" style={{ marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${meetings.length})` },
          { key: 'draft', label: `Draft (${draftCount})` },
          { key: 'published', label: `Published (${publishedCount})` },
          { key: 'closed', label: `Closed (${closedCount})` },
        ].map(tab => (
          <button key={tab.key} className={`filter-tab ${statusFilter === tab.key ? 'active' : ''}`} onClick={() => setStatusFilter(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Meetings table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading meetings…</div>
      ) : filteredMeetings.length === 0 ? (
        <div className="sales-table-section">
          <table className="sales-table">
            <tbody>
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 60 }}>
                  <ForumIcon style={{ fontSize: 48, color: '#d1d5db', display: 'block', margin: '0 auto 12px' }} />
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>No meetings found</h3>
                  <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>
                    {statusFilter !== 'all' ? 'Try a different status filter.' : 'Create the first meeting for this project.'}
                  </p>
                  {statusFilter === 'all' && (
                    <button className="sales-btn sales-btn-primary" onClick={() => navigate(`/projects/${projectId}/meetings/new`)}>
                      <AddIcon fontSize="small" /> Create First Meeting
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sales-table-section">
          <div style={{ overflowX: 'auto' }}>
          <table className="sales-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Title</th>
                <th style={{ width: 130 }}>Type</th>
                <th style={{ width: 120 }}>Series</th>
                <th style={{ width: 160 }}>Date / Time</th>
                <th style={{ width: 72, textAlign: 'center' }}>Attendees</th>
                <th style={{ width: 90, textAlign: 'center' }}>Open Actions</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredMeetings.map(m => (
                <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/meetings/${m.id}`)}>
                  <td style={{ fontWeight: 600, color: '#1e3a5f' }}>{m.number}</td>
                  <td>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    {m.location && <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.location}</div>}
                  </td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{MEETING_TYPES[m.meeting_type] || m.meeting_type}</td>
                  <td>
                    {m.series_title ? (
                      <span className="sales-stage-badge" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex' }}>
                        <span className="sales-stage-dot" style={{ background: '#3b82f6', flexShrink: 0 }} />
                        {m.series_title}
                      </span>
                    ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    <div>{formatDate(m.scheduled_date) || '—'}</div>
                    {m.start_time && (
                      <div style={{ color: '#9ca3af', fontSize: 12 }}>
                        {formatTime(m.start_time)}{m.end_time ? ` – ${formatTime(m.end_time)}` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', color: '#6b7280', fontSize: 13 }}>{m.attendee_count || 0}</td>
                  <td style={{ textAlign: 'center' }}>
                    {Number(m.open_action_count) > 0 ? (
                      <span className="sales-stage-badge">
                        <span className="sales-stage-dot" style={{ background: '#f59e0b' }} />
                        {m.open_action_count}
                      </span>
                    ) : <span style={{ color: '#9ca3af', fontSize: 13 }}>0</span>}
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn-icon btn-icon-danger" title="Delete"
                      onClick={async () => {
                        const ok = await confirm({ title: `Delete Meeting #${m.number}?`, message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
                        if (ok) deleteMeetingMutation.mutate(m.id);
                      }}>
                      <DeleteIcon style={{ fontSize: 15 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
