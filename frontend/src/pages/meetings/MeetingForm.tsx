import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MeetingSeries, MEETING_TYPES, RECURRENCE_LABELS } from '../../services/meetings';
import { projectsApi } from '../../services/projects';
import ForumIcon from '@mui/icons-material/Forum';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';
import './Meetings.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MeetingForm: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useTitanFeedback();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [meetingMode, setMeetingMode] = useState<'oneoff' | 'series'>('oneoff');
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [form, setForm] = useState({
    title: '',
    meeting_type: 'project_meeting',
    series_id: '',
    scheduled_date: searchParams.get('date') || '',
    start_time: searchParams.get('time') || '',
    end_time: '',
    location: '',
    description: '',
  });
  const [newSeries, setNewSeries] = useState({
    title: '',
    recurrence_type: 'weekly',
    day_of_week: 1,
    start_time: '',
    end_time: '',
    location: '',
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ['meeting-series', Number(projectId)],
    queryFn: () => meetingsApi.getSeriesByProject(Number(projectId)).then(r => r.data),
  });

  const { data: existingMeeting } = useQuery({
    queryKey: ['meeting', Number(id)],
    queryFn: () => meetingsApi.getById(Number(id)).then(r => r.data),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (existingMeeting) {
      setForm({
        title: existingMeeting.title,
        meeting_type: existingMeeting.meeting_type,
        series_id: existingMeeting.series_id ? String(existingMeeting.series_id) : '',
        scheduled_date: existingMeeting.scheduled_date || '',
        start_time: existingMeeting.start_time || '',
        end_time: existingMeeting.end_time || '',
        location: existingMeeting.location || '',
        description: existingMeeting.description || '',
      });
      if (existingMeeting.series_id) setMeetingMode('series');
    }
  }, [existingMeeting]);

  const selectedSeries = seriesList.find(s => String(s.id) === form.series_id);
  useEffect(() => {
    if (selectedSeries && !isEdit) {
      setForm(f => ({
        ...f,
        title: f.title || selectedSeries.title,
        meeting_type: selectedSeries.meeting_type,
        start_time: selectedSeries.start_time || f.start_time,
        end_time: selectedSeries.end_time || f.end_time,
        location: selectedSeries.location || f.location,
      }));
    }
  }, [selectedSeries?.id]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setNS = (k: string, v: any) => setNewSeries(f => ({ ...f, [k]: v }));

  const createSeriesMutation = useMutation({
    mutationFn: (title: string) => meetingsApi.createSeries({
      projectId: Number(projectId),
      title,
      meeting_type: form.meeting_type,
      recurrence_type: newSeries.recurrence_type as any,
      day_of_week: newSeries.day_of_week,
      start_time: newSeries.start_time || undefined,
      end_time: newSeries.end_time || undefined,
      location: newSeries.location || undefined,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['meeting-series', Number(projectId)] });
      setForm(f => ({ ...f, series_id: String(res.data.id) }));
      setShowNewSeries(false);
      toast.success('Series created.');
    },
    onError: () => toast.error('Failed to create series.'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        projectId: Number(projectId),
        title: form.title,
        meetingType: form.meeting_type,
        seriesId: form.series_id ? Number(form.series_id) : undefined,
        scheduledDate: form.scheduled_date || undefined,
        startTime: form.start_time || undefined,
        endTime: form.end_time || undefined,
        location: form.location || undefined,
        description: form.description || undefined,
      };
      if (isEdit) return meetingsApi.update(Number(id), payload);
      return meetingsApi.create(payload as any);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['meetings', Number(projectId)] });
      toast.success(isEdit ? 'Meeting updated.' : 'Meeting created.');
      navigate(`/projects/${projectId}/meetings/${res.data.id}`);
    },
    onError: () => toast.error('Failed to save meeting.'),
  });

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ForumIcon style={{ color: '#1e3a5f', fontSize: 28 }} />
            <div>
              <h1>{isEdit ? 'Edit Meeting' : 'New Meeting'}</h1>
              {project && <p style={{ color: '#6b7280', margin: 0 }}>{project.name}</p>}
            </div>
          </div>
        </div>
        <div className="sales-page-actions">
          <Link to={`/projects/${projectId}/meetings`} className="sales-btn sales-btn-secondary">Cancel</Link>
        </div>
      </div>

      <div className="meeting-section-card">
        <div className="meeting-section-header">
          <span className="meeting-section-title">Meeting Details</span>
        </div>
        <div className="meeting-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {!isEdit && (
            <div className="form-group">
              <label className="form-label">Meeting Type</label>
              <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => setMeetingMode('oneoff')}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                    background: meetingMode === 'oneoff' ? '#1e3a5f' : '#fff',
                    color: meetingMode === 'oneoff' ? '#fff' : '#374151',
                  }}
                >One-off Meeting</button>
                <button
                  type="button"
                  onClick={() => setMeetingMode('series')}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 500, border: 'none', borderLeft: '1px solid #d1d5db', cursor: 'pointer',
                    background: meetingMode === 'series' ? '#1e3a5f' : '#fff',
                    color: meetingMode === 'series' ? '#fff' : '#374151',
                  }}
                >Series Meeting</button>
              </div>
            </div>
          )}

          {meetingMode === 'series' && (
            <div className="form-group">
              <label className="form-label">Meeting Series</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  className="form-input"
                  value={form.series_id}
                  onChange={e => { set('series_id', e.target.value); setShowNewSeries(false); }}
                  style={{ flex: 1 }}
                >
                  <option value="">— Select a series —</option>
                  {seriesList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({RECURRENCE_LABELS[s.recurrence_type]})
                    </option>
                  ))}
                </select>
                <button type="button" className="sales-btn sales-btn-secondary" onClick={() => setShowNewSeries(v => !v)}>
                  {showNewSeries ? 'Cancel' : '+ New Series'}
                </button>
              </div>
              {showNewSeries && (
                <div style={{ marginTop: 12, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Series Name *</label>
                      <input className="form-input" value={newSeries.title} onChange={e => setNS('title', e.target.value)} placeholder="e.g. Weekly OAC" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Recurrence</label>
                      <select className="form-input" value={newSeries.recurrence_type} onChange={e => setNS('recurrence_type', e.target.value)}>
                        {Object.entries(RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  {newSeries.recurrence_type !== 'monthly' && (
                    <div className="form-group">
                      <label className="form-label">Day of Week</label>
                      <select className="form-input" value={newSeries.day_of_week} onChange={e => setNS('day_of_week', Number(e.target.value))}>
                        {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Default Start Time</label>
                      <input className="form-input" type="time" value={newSeries.start_time} onChange={e => setNS('start_time', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Default End Time</label>
                      <input className="form-input" type="time" value={newSeries.end_time} onChange={e => setNS('end_time', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Location</label>
                    <input className="form-input" value={newSeries.location} onChange={e => setNS('location', e.target.value)} />
                  </div>
                  <div>
                    <button
                      type="button"
                      className="sales-btn sales-btn-primary"
                      onClick={() => createSeriesMutation.mutate(newSeries.title)}
                      disabled={!newSeries.title || createSeriesMutation.isPending}
                    >
                      {createSeriesMutation.isPending ? 'Creating…' : 'Create Series'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Meeting title" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Meeting Category</label>
              <select className="form-input" value={form.meeting_type} onChange={e => set('meeting_type', e.target.value)}>
                {Object.entries(MEETING_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input className="form-input" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input className="form-input" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Room, address, or video link" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Purpose / Description</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What is the purpose of this meeting?" style={{ resize: 'vertical' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        <Link to={`/projects/${projectId}/meetings`} className="sales-btn sales-btn-secondary" style={{ textDecoration: 'none' }}>Cancel</Link>
        <button
          className="sales-btn sales-btn-primary"
          onClick={() => saveMutation.mutate()}
          disabled={!form.title || saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Meeting'}
        </button>
      </div>
    </div>
  );
};

export default MeetingForm;
