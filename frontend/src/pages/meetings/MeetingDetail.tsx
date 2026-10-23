import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MEETING_TYPES } from '../../services/meetings';
import { projectsApi } from '../../services/projects';
import { format, parseISO } from 'date-fns';
import ForumIcon from '@mui/icons-material/Forum';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import RepeatIcon from '@mui/icons-material/Repeat';
import NextPlanIcon from '@mui/icons-material/NextPlan';
import PublishIcon from '@mui/icons-material/Publish';
import LockIcon from '@mui/icons-material/Lock';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MeetingAttendeesSection from '../../components/meetings/MeetingAttendeesSection';
import MeetingAgendaSection from '../../components/meetings/MeetingAgendaSection';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import { useAuth } from '../../context/AuthContext';
import { generateMeetingMinutesPdf } from '../../utils/meetingMinutesPdf';
import '../../styles/SalesPipeline.css';
import './Meetings.css';

const statusBadge = (status: string) => {
  const styles: Record<string, React.CSSProperties> = {
    draft: { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' },
    published: { background: '#16a34a', color: '#fff' },
    closed: { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' },
  };
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'capitalize',
      letterSpacing: '0.04em',
      ...styles[status],
    }}>
      {status}
    </span>
  );
};

const formatDate = (d: string | null) => {
  if (!d) return null;
  try { return format(parseISO(d), 'EEEE, MMMM d, yyyy'); } catch { return d; }
};

const formatTime = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const MeetingDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const navigate = useNavigate();
  const { toast, confirm } = useTitanFeedback();
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', Number(id)],
    queryFn: () => meetingsApi.getById(Number(id)).then(r => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['meeting', Number(id)] });
    queryClient.invalidateQueries({ queryKey: ['meetings', Number(projectId)] });
  };

  const publishMutation = useMutation({
    mutationFn: () => meetingsApi.publish(Number(id)),
    onSuccess: () => { invalidate(); toast.success('Meeting published.'); },
    onError: () => toast.error('Failed to publish meeting.'),
  });

  const closeMutation = useMutation({
    mutationFn: () => meetingsApi.close(Number(id)),
    onSuccess: () => { invalidate(); toast.success('Meeting closed.'); },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to close meeting.'),
  });

  const scheduleNextMutation = useMutation({
    mutationFn: () => meetingsApi.scheduleNext(Number(id)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['meetings', Number(projectId)] });
      queryClient.invalidateQueries({ queryKey: ['meeting-series', Number(projectId)] });
      toast.success(`Meeting #${res.data.number} scheduled.`);
      navigate(`/projects/${projectId}/meetings/${res.data.id}`);
    },
    onError: () => toast.error('Failed to schedule next meeting.'),
  });

  const scheduleFollowupMutation = useMutation({
    mutationFn: () => meetingsApi.scheduleFollowup(Number(id)),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['meetings', Number(projectId)] });
      toast.success(`Follow-up meeting #${res.data.number} created.`);
      navigate(`/projects/${projectId}/meetings/${res.data.id}`);
    },
    onError: () => toast.error('Failed to create follow-up meeting.'),
  });

  const handleExportPdf = async () => {
    if (!meeting) return;
    setExportingPdf(true);
    try {
      const logoUrl = '/api/tenant/logo';
      const blob = await generateMeetingMinutesPdf(meeting, project?.name || '', logoUrl, tenant?.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Meeting-Minutes-${meeting.number}-${(meeting.scheduled_date || '').substring(0, 10) || 'draft'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to generate PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (isLoading) return <div className="loading">Loading…</div>;
  if (!meeting) return <div className="loading">Meeting not found.</div>;

  const isReadonly = meeting.status === 'closed';
  const timeStr = (() => {
    const s = formatTime(meeting.start_time);
    const e = formatTime(meeting.end_time);
    if (!s) return null;
    return e ? `${s} – ${e}` : s;
  })();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link to={`/projects/${projectId}/meetings`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>
          <ArrowBackIcon style={{ fontSize: 16 }} /> Back to Meetings
        </Link>
      </div>

      {/* Header card */}
      <div className="meeting-detail-header">
        <div className="meeting-detail-title-row">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
            <ForumIcon style={{ fontSize: 28, marginTop: 2, opacity: 0.7 }} />
            <div>
              <h1 className="meeting-detail-title">
                #{meeting.number} — {meeting.title}
              </h1>
              <div className="meeting-detail-badges" style={{ marginTop: 8 }}>
                {statusBadge(meeting.status)}
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.9)',
                }}>
                  {MEETING_TYPES[meeting.meeting_type] || meeting.meeting_type}
                </span>
                {meeting.series_title && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 12px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'rgba(249,115,22,0.3)',
                    color: '#fed7aa',
                  }}>
                    <RepeatIcon style={{ fontSize: 13 }} /> {meeting.series_title}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="meeting-detail-actions">
            <button
              className="sales-btn sales-btn-secondary"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
              onClick={handleExportPdf}
              disabled={exportingPdf}
            >
              <PictureAsPdfIcon style={{ fontSize: 15, marginRight: 4 }} />
              {exportingPdf ? 'Exporting…' : 'Export PDF'}
            </button>
            {meeting.status !== 'closed' && (
              <Link to={`/projects/${projectId}/meetings/${id}/edit`} className="sales-btn sales-btn-secondary" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', textDecoration: 'none' }}>
                <EditIcon style={{ fontSize: 15, marginRight: 4 }} /> Edit
              </Link>
            )}
            {meeting.status === 'draft' && (
              <button className="sales-btn sales-btn-primary" style={{ background: '#16a34a', border: 'none' }}
                onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                <PublishIcon style={{ fontSize: 15, marginRight: 4 }} />
                {publishMutation.isPending ? 'Publishing…' : 'Publish'}
              </button>
            )}
            {meeting.status === 'published' && (
              <button className="sales-btn sales-btn-secondary" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
                onClick={async () => {
                  const ok = await confirm({ title: 'Close Meeting?', message: 'This meeting will become read-only.', confirmText: 'Close', danger: false });
                  if (ok) closeMutation.mutate();
                }}
                disabled={closeMutation.isPending}>
                <LockIcon style={{ fontSize: 15, marginRight: 4 }} />
                {closeMutation.isPending ? 'Closing…' : 'Close Meeting'}
              </button>
            )}
            {(meeting.status === 'published' || meeting.status === 'closed') && meeting.series_id && (
              <button className="sales-btn sales-btn-primary"
                style={{ background: '#f97316', border: 'none' }}
                onClick={async () => {
                  const ok = await confirm({ title: 'Schedule Next Meeting?', message: 'Open action items and attendees will be carried forward to the next meeting.', confirmText: 'Schedule' });
                  if (ok) scheduleNextMutation.mutate();
                }}
                disabled={scheduleNextMutation.isPending}>
                <NextPlanIcon style={{ fontSize: 15, marginRight: 4 }} />
                {scheduleNextMutation.isPending ? 'Scheduling…' : 'Schedule Next Meeting'}
              </button>
            )}
            {(meeting.status === 'published' || meeting.status === 'closed') && !meeting.series_id && (
              <button className="sales-btn sales-btn-primary"
                style={{ background: '#f97316', border: 'none' }}
                onClick={async () => {
                  const ok = await confirm({ title: 'Schedule Follow-up Meeting?', message: 'A new draft meeting will be created for next week. Attendees and open action items will be carried forward.', confirmText: 'Create Follow-up' });
                  if (ok) scheduleFollowupMutation.mutate();
                }}
                disabled={scheduleFollowupMutation.isPending}>
                <NextPlanIcon style={{ fontSize: 15, marginRight: 4 }} />
                {scheduleFollowupMutation.isPending ? 'Creating…' : 'Schedule Follow-up'}
              </button>
            )}
          </div>
        </div>

        {/* Info row */}
        <div className="meeting-detail-info-row">
          {formatDate(meeting.scheduled_date) && (
            <span className="meeting-info-item">
              <CalendarTodayIcon style={{ fontSize: 14 }} />
              {formatDate(meeting.scheduled_date)}
            </span>
          )}
          {timeStr && (
            <span className="meeting-info-item">
              <AccessTimeIcon style={{ fontSize: 14 }} />
              {timeStr}
            </span>
          )}
          {meeting.location && (
            <span className="meeting-info-item">
              <LocationOnIcon style={{ fontSize: 14 }} />
              {meeting.location}
            </span>
          )}
          {meeting.created_by_name && (
            <span className="meeting-info-item">
              <PersonIcon style={{ fontSize: 14 }} />
              Created by {meeting.created_by_name}
            </span>
          )}
          {meeting.previous_meeting_number && (
            <span className="meeting-info-item" style={{ color: '#fed7aa' }}>
              <RepeatIcon style={{ fontSize: 14 }} />
              Follows Meeting #{meeting.previous_meeting_number}
            </span>
          )}
        </div>
      </div>

      {/* Details section */}
      {meeting.description && (
        <div className="meeting-section-card">
          <div className="meeting-section-header">
            <span className="meeting-section-title">Details</span>
          </div>
          <div className="meeting-section-body">
            <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{meeting.description}</p>
          </div>
        </div>
      )}

      {/* Attendees */}
      <div className="meeting-section-card">
        <div className="meeting-section-header">
          <span className="meeting-section-title">
            Attendees ({(meeting.attendees || []).length})
          </span>
        </div>
        <div className="meeting-section-body">
          <MeetingAttendeesSection
            meetingId={meeting.id}
            projectId={Number(projectId)}
            attendees={meeting.attendees || []}
            readonly={isReadonly}
          />
        </div>
      </div>

      {/* Agenda + nested action items */}
      <div className="meeting-section-card">
        <div className="meeting-section-header">
          <span className="meeting-section-title">
            Agenda ({(meeting.agenda_items || []).length} items)
          </span>
          {(meeting.action_items || []).filter(ai => ai.status !== 'closed').length > 0 && (
            <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
              {(meeting.action_items || []).filter(ai => ai.status !== 'closed').length} open actions
            </span>
          )}
        </div>
        <div className="meeting-section-body">
          <MeetingAgendaSection
            meetingId={meeting.id}
            agendaItems={meeting.agenda_items || []}
            actionItems={meeting.action_items || []}
            attendees={meeting.attendees || []}
            readonly={isReadonly}
          />
        </div>
      </div>
    </div>
  );
};

export default MeetingDetail;
