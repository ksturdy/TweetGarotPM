import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MEETING_TYPES, RECURRENCE_LABELS } from '../../services/meetings';
import { projectsApi } from '../../services/projects';
import ForumIcon from '@mui/icons-material/Forum';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';
import './Meetings.css';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const MeetingForm: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useTitanFeedback();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [meetingMode, setMeetingMode] = useState<'oneoff' | 'series'>('oneoff');
  const [duration, setDuration] = useState(60);
  const initialStart = searchParams.get('time') || '';
  const [form, setForm] = useState({
    title: '',
    meeting_type: 'project_meeting',
    series_id: '',
    recurrence_type: 'weekly',
    day_of_week: '1',
    scheduled_date: searchParams.get('date') || '',
    start_time: initialStart,
    end_time: initialStart ? addMinsToTime(initialStart, 60) : '',
    location: '',
    description: '',
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: existingMeeting } = useQuery({
    queryKey: ['meeting', Number(id)],
    queryFn: () => meetingsApi.getById(Number(id)).then(r => r.data),
    enabled: isEdit && Boolean(id),
  });

  useEffect(() => {
    if (existingMeeting) {
      setForm(f => ({
        ...f,
        title: existingMeeting.title,
        meeting_type: existingMeeting.meeting_type,
        series_id: existingMeeting.series_id ? String(existingMeeting.series_id) : '',
        scheduled_date: existingMeeting.scheduled_date || '',
        start_time: existingMeeting.start_time || '',
        end_time: existingMeeting.end_time || '',
        location: existingMeeting.location || '',
        description: existingMeeting.description || '',
      }));
      if (existingMeeting.series_id) setMeetingMode('series');
      if (existingMeeting.start_time && existingMeeting.end_time) {
        const mins = diffMins(existingMeeting.start_time, existingMeeting.end_time);
        if (mins > 0) setDuration(mins);
      }
    }
  }, [existingMeeting]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      let seriesId = form.series_id ? Number(form.series_id) : undefined;

      if (!isEdit && meetingMode === 'series' && !seriesId) {
        const seriesRes = await meetingsApi.createSeries({
          projectId: Number(projectId),
          title: form.title,
          meeting_type: form.meeting_type,
          recurrence_type: form.recurrence_type as any,
          day_of_week: Number(form.day_of_week),
          start_time: form.start_time || undefined,
          end_time: form.end_time || undefined,
          location: form.location || undefined,
        });
        seriesId = seriesRes.data.id;
      }

      const payload = {
        projectId: Number(projectId),
        title: form.title,
        meetingType: form.meeting_type,
        seriesId,
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
      queryClient.invalidateQueries({ queryKey: ['meeting-series', Number(projectId)] });
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
              <label className="form-label">Schedule</label>
              <div style={{ display: 'flex', gap: 0, border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => setMeetingMode('oneoff')}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                    background: meetingMode === 'oneoff' ? '#1e3a5f' : '#fff',
                    color: meetingMode === 'oneoff' ? '#fff' : '#374151',
                  }}
                >One-off</button>
                <button
                  type="button"
                  onClick={() => setMeetingMode('series')}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 500, border: 'none', borderLeft: '1px solid #d1d5db', cursor: 'pointer',
                    background: meetingMode === 'series' ? '#1e3a5f' : '#fff',
                    color: meetingMode === 'series' ? '#fff' : '#374151',
                  }}
                >Recurring</button>
              </div>
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

          {meetingMode === 'series' && !isEdit && (
            <div style={{ display: 'grid', gridTemplateColumns: form.recurrence_type !== 'monthly' ? '1fr 1fr' : '1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Recurrence</label>
                <select className="form-input" value={form.recurrence_type} onChange={e => set('recurrence_type', e.target.value)}>
                  {Object.entries(RECURRENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {form.recurrence_type !== 'monthly' && (
                <div className="form-group">
                  <label className="form-label">Day of Week</label>
                  <select className="form-input" value={form.day_of_week} onChange={e => set('day_of_week', e.target.value)}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={String(i)}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {isEdit && existingMeeting?.series_title && (
            <div className="form-group">
              <label className="form-label">Series</label>
              <div style={{ fontSize: 13, color: '#374151', padding: '6px 0' }}>{existingMeeting.series_title}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
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
