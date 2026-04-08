import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyReportsApi, DailyReportCrew } from '../../services/dailyReports';
import { projectsApi } from '../../services/projects';
import { format, parseISO } from 'date-fns';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../../styles/SalesPipeline.css';

const tradeLabel = (trade: string): string => {
  const labels: Record<string, string> = {
    plumbing: 'Plumbing',
    piping: 'Piping',
    sheet_metal: 'Sheet Metal',
    general: 'General',
    other: 'Other',
  };
  return labels[trade] || trade;
};

const labelStyle: React.CSSProperties = { fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' };
const valStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 500 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 };

const DailyReportDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['dailyReport', id],
    queryFn: () => dailyReportsApi.getById(Number(id)).then((res) => res.data),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => dailyReportsApi.approve(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyReport', id] });
    },
  });

  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  const reviseMutation = useMutation({
    mutationFn: () => dailyReportsApi.revise(Number(id), { revision_notes: revisionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyReport', id] });
      setShowRevisionForm(false);
      setRevisionNotes('');
    },
  });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!report) {
    return <div className="loading">Report not found</div>;
  }

  const crews: DailyReportCrew[] = report.crews || [];
  const totalManHours = crews.reduce(
    (sum: number, c: DailyReportCrew) => sum + c.crew_size * c.hours_worked,
    0
  );

  const statusColors: Record<string, string> = {
    draft: '#f59e0b',
    submitted: '#3b82f6',
    approved: '#22c55e',
    revision: '#ef4444',
  };

  return (
    <div>
      <div className="sales-page-header" style={{ marginBottom: '0.75rem' }}>
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}/daily-reports`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>
              &larr; Back to Daily Reports
            </Link>
            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Daily Report - {format(parseISO(report.report_date), 'MMMM d, yyyy')}</h1>
            <div className="sales-subtitle" style={{ fontSize: '0.8rem', marginTop: 2 }}>{project?.name || 'Project'}</div>
          </div>
        </div>
        <div className="sales-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'white',
            backgroundColor: statusColors[report.status] || '#6b7280',
            textTransform: 'capitalize',
          }}>
            {report.status}
          </span>
          {report.status === 'submitted' && (
            <>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const ok = await confirm('Approve this daily report?');
                  if (ok) {
                    approveMutation.mutate();
                  }
                }}
                disabled={approveMutation.isPending}
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowRevisionForm(true)}
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              >
                Revise &amp; Resubmit
              </button>
            </>
          )}
        </div>
      </div>

      {/* Revision reason inline form */}
      {showRevisionForm && (
        <div className="card" style={{ padding: '1rem', marginBottom: '0.75rem', border: '2px solid #f59e0b' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem' }}>Send Back for Revision</h4>
          <textarea
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            placeholder="Reason for revision (required)..."
            rows={3}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setShowRevisionForm(false); setRevisionNotes(''); }} style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => reviseMutation.mutate()}
              disabled={!revisionNotes.trim() || reviseMutation.isPending}
              style={{ fontSize: '0.8rem', padding: '4px 12px', backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}
            >
              {reviseMutation.isPending ? 'Sending...' : 'Send for Revision'}
            </button>
          </div>
        </div>
      )}

      {/* Revision notes banner */}
      {report.revision_notes && (
        <div style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8, padding: '8px 12px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          <strong>Revision Notes:</strong> {report.revision_notes}
          {report.revised_by_name && (
            <span style={{ color: '#6b7280', marginLeft: 8 }}>
              — {report.revised_by_name}, {report.revised_at ? format(new Date(report.revised_at), 'MMM d, yyyy h:mm a') : ''}
            </span>
          )}
        </div>
      )}

      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        {/* Row 1: Date/Weather + Work Performed side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '0.75rem' }}>
          {/* Left: Date & Weather */}
          <div>
            <h4 style={sectionTitle}>Date & Weather</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              <div>
                <div style={labelStyle}>Date</div>
                <div style={valStyle}>{format(parseISO(report.report_date), 'EEE, MMM d, yyyy')}</div>
              </div>
              <div>
                <div style={labelStyle}>Weather</div>
                <div style={valStyle}>{report.weather || 'N/A'}</div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={labelStyle}>Temperature</div>
                <div style={valStyle}>{report.temperature ? `${report.temperature}°F` : 'N/A'}</div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div style={labelStyle}>Safety Incidents</div>
                <div style={{ ...valStyle, color: report.safety_incidents > 0 ? '#ef4444' : '#22c55e' }}>
                  {report.safety_incidents}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Work Performed */}
          <div>
            <h4 style={sectionTitle}>Work Performed</h4>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#374151', lineHeight: 1.4 }}>
              {report.work_performed || 'No work description provided.'}
            </div>
          </div>
        </div>

        {/* Crews */}
        <div style={{ marginBottom: '0.75rem' }}>
          <h4 style={sectionTitle}>Crews ({crews.length}){crews.length > 0 && <span style={{ float: 'right', fontWeight: 500, fontSize: '0.75rem', color: '#374151' }}>Total Man-Hours: {totalManHours}</span>}</h4>
          {crews.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No crew entries recorded.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>Trade</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>Foreman</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>Crew Size</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>Hours</th>
                  <th style={{ textAlign: 'center', padding: '4px 8px', fontWeight: 600, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>Man-Hrs</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase' }}>Work Description</th>
                </tr>
              </thead>
              <tbody>
                {crews.map((crew) => (
                  <tr key={crew.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 8px' }}>{tradeLabel(crew.trade)}</td>
                    <td style={{ padding: '4px 8px' }}>{crew.foreman || '-'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{crew.crew_size}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>{crew.hours_worked}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{crew.crew_size * crew.hours_worked}</td>
                    <td style={{ padding: '4px 8px' }}>{crew.work_description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Row 3: Materials/Equipment + Delays/Safety/Other side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
          {/* Left: Materials & Equipment */}
          <div>
            <h4 style={sectionTitle}>Materials & Equipment</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              <div>
                <div style={labelStyle}>Materials</div>
                <div style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{report.materials || 'None'}</div>
              </div>
              <div>
                <div style={labelStyle}>Equipment</div>
                <div style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{report.equipment || 'None'}</div>
              </div>
            </div>
          </div>

          {/* Right: Delays + Other */}
          <div>
            {(report.delay_hours > 0 || report.delay_reason) ? (
              <>
                <h4 style={sectionTitle}>Delays</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', marginBottom: 8 }}>
                  <div>
                    <div style={labelStyle}>Hours</div>
                    <div style={valStyle}>{report.delay_hours}</div>
                  </div>
                  {report.delay_reason && (
                    <div>
                      <div style={labelStyle}>Reason</div>
                      <div style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{report.delay_reason}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h4 style={sectionTitle}>Delays</h4>
                <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>None</div>
              </>
            )}
            {report.safety_notes && (
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>Safety Notes</div>
                <div style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{report.safety_notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Visitors & Issues row */}
        {(report.visitors || report.issues) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
            {report.visitors && (
              <div>
                <h4 style={sectionTitle}>Visitors</h4>
                <div style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{report.visitors}</div>
              </div>
            )}
            {report.issues && (
              <div>
                <h4 style={sectionTitle}>Issues</h4>
                <div style={{ ...valStyle, whiteSpace: 'pre-wrap' }}>{report.issues}</div>
              </div>
            )}
          </div>
        )}

        {/* Footer: Report Info */}
        <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 6, display: 'flex', gap: '2rem', fontSize: '0.75rem', color: '#6b7280' }}>
          <span><strong>Created By:</strong> {report.created_by_name}</span>
          <span><strong>Created:</strong> {report.created_at ? format(new Date(report.created_at), 'MMM d, yyyy h:mm a') : 'N/A'}</span>
          {report.submitted_at && <span><strong>Submitted:</strong> {format(new Date(report.submitted_at), 'MMM d, yyyy h:mm a')}</span>}
          {report.revised_at && <span><strong>Returned:</strong> {format(new Date(report.revised_at), 'MMM d, yyyy h:mm a')} by {report.revised_by_name}</span>}
          {report.approved_at && <span><strong>Approved:</strong> {format(new Date(report.approved_at), 'MMM d, yyyy h:mm a')}</span>}
        </div>
      </div>
    </div>
  );
};

export default DailyReportDetail;
