import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ShareIcon from '@mui/icons-material/Share';
import { dailyReportsApi, DailyReport, DailyReportCrew } from '../../../services/dailyReports';
import { generateDailyReportPdf } from '../../../utils/dailyReportPdfClient';
import { useAuth } from '../../../context/AuthContext';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const date = new Date(d + 'T00:00:00');
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

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

const FieldDailyReportDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, user } = useAuth();
  const { toast, confirm } = useTitanFeedback();
  // Use API proxy for logo to avoid R2 CORS issues in PDF generation
  const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const {
    data: report,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['field-daily-report', id],
    queryFn: async () => {
      const res = await dailyReportsApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: () => dailyReportsApi.submit(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-daily-report', id] });
      queryClient.invalidateQueries({
        queryKey: ['field-daily-reports', projectId],
      });
    },
  });

  const reviseMutation = useMutation({
    mutationFn: () => dailyReportsApi.revise(Number(id), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-daily-report', id] });
      queryClient.invalidateQueries({ queryKey: ['field-daily-reports', projectId] });
    },
  });

  const handleSubmitReport = async () => {
    const msg = report?.status === 'revision'
      ? 'Resubmit this daily report?'
      : 'Submit this daily report? It cannot be edited after submission.';
    const ok = await confirm(msg);
    if (ok) {
      submitMutation.mutate();
    }
  };

  const handleRecallReport = async () => {
    const ok = await confirm('Recall this report for editing? It will need to be resubmitted.');
    if (ok) {
      reviseMutation.mutate();
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setDownloadingPdf(true);
    try {
      const blob = await generateDailyReportPdf(report, logoUrl);
      const dateStr = report.report_date?.replace(/-/g, '') || '';
      const filename = `DailyReport-${dateStr}-${report.project_number || ''}.pdf`;

      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIos) {
        try {
          const pdfFile = new File([blob], filename, { type: 'application/pdf' });
          if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
            await navigator.share({ files: [pdfFile], title: filename });
            return;
          }
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') return;
        }
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
      }
    } catch (err) {
      console.error('Failed to download PDF:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleEmailReport = async () => {
    if (!report) return;
    setSendingEmail(true);
    try {
      const blob = await generateDailyReportPdf(report, logoUrl);
      const dateStr = report.report_date?.replace(/-/g, '') || '';
      const filename = `DailyReport-${dateStr}-${report.project_number || ''}.pdf`;
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Daily Report - ${report.report_date}`,
        });
      } else {
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        const fmtDate = new Date(report.report_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const subject = `Daily Report ${fmtDate} - ${report.project_name || ''} (${report.project_number || ''})`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Please see attached ${filename}`)}`;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to share daily report:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return <div className="field-loading">Loading report...</div>;
  }

  if (isError || !report) {
    return (
      <div className="field-empty">
        <WarningAmberIcon />
        <div className="field-empty-title">Report not found</div>
        <div className="field-empty-text">
          This daily report could not be loaded.
        </div>
      </div>
    );
  }

  const crews: DailyReportCrew[] = report.crews || [];
  const totalManHours = crews.reduce(
    (sum, c) => sum + c.crew_size * c.hours_worked,
    0
  );

  return (
    <div>
      <button
        className="field-btn field-btn-secondary field-btn-sm"
        onClick={() =>
          navigate(`/field/projects/${projectId}/daily-reports`)
        }
        style={{ marginBottom: 16 }}
      >
        <ArrowBackIcon style={{ fontSize: 18, marginRight: 4 }} />
        Back to List
      </button>

      <h1 className="field-page-title">{formatDate(report.report_date)}</h1>
      <div style={{ marginBottom: 16 }}>
        <span className={`field-status field-status-${report.status}`}>
          {report.status}
        </span>
      </div>

      {/* Revision Notes Banner */}
      {report.status === 'revision' && report.revision_notes && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fbbf24',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: '0.9rem',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#92400e' }}>Revision Requested</div>
          <div>{report.revision_notes}</div>
          {report.revised_by_name && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
              By {report.revised_by_name} on {formatDateTime(report.revised_at)}
            </div>
          )}
        </div>
      )}

      {/* PDF & Email Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="field-btn field-btn-secondary field-btn-sm"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          type="button"
          style={{ opacity: downloadingPdf ? 0.6 : 1 }}
        >
          <PictureAsPdfIcon style={{ fontSize: 16 }} />
          {downloadingPdf ? 'Generating...' : 'Download PDF'}
        </button>
        <button
          className="field-btn field-btn-secondary field-btn-sm"
          onClick={handleEmailReport}
          disabled={sendingEmail}
          type="button"
          style={{ opacity: sendingEmail ? 0.6 : 1 }}
        >
          <ShareIcon style={{ fontSize: 16 }} />
          {sendingEmail ? 'Preparing...' : 'Email Report'}
        </button>
      </div>

      {/* Date & Weather */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Date &amp; Weather</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Date</span>
          <span className="field-detail-value">
            {formatDate(report.report_date)}
          </span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Weather</span>
          <span className="field-detail-value">
            {report.weather || 'N/A'}
          </span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Temperature</span>
          <span className="field-detail-value">
            {report.temperature || 'N/A'}
          </span>
        </div>
      </div>

      {/* Work Performed */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Work Performed</div>
        <div className="field-detail-row">
          <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
            {report.work_performed || 'No work description provided.'}
          </span>
        </div>
      </div>

      {/* Crews */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">
          <GroupsIcon style={{ fontSize: 18, marginRight: 4, verticalAlign: 'middle' }} />
          Crews ({crews.length})
        </div>
        {crews.length === 0 ? (
          <div className="field-detail-row">
            <span className="field-detail-value" style={{ color: '#9ca3af' }}>
              No crew entries recorded.
            </span>
          </div>
        ) : (
          <>
            {crews.map((crew) => (
              <div
                key={crew.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div className="field-detail-row">
                  <span className="field-detail-label">Trade</span>
                  <span className="field-detail-value">
                    {tradeLabel(crew.trade)}
                  </span>
                </div>
                <div className="field-detail-row">
                  <span className="field-detail-label">Foreman</span>
                  <span className="field-detail-value">
                    {crew.foreman || 'N/A'}
                  </span>
                </div>
                <div className="field-detail-row">
                  <span className="field-detail-label">Crew Size</span>
                  <span className="field-detail-value">{crew.crew_size}</span>
                </div>
                <div className="field-detail-row">
                  <span className="field-detail-label">Hours Worked</span>
                  <span className="field-detail-value">{crew.hours_worked}</span>
                </div>
                {crew.work_description && (
                  <div className="field-detail-row">
                    <span className="field-detail-label">Work</span>
                    <span className="field-detail-value">
                      {crew.work_description}
                    </span>
                  </div>
                )}
              </div>
            ))}
            <div className="field-detail-row" style={{ fontWeight: 600 }}>
              <span className="field-detail-label">Total Man-Hours</span>
              <span className="field-detail-value">{totalManHours}</span>
            </div>
          </>
        )}
      </div>

      {/* Materials & Equipment */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Materials &amp; Equipment</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Materials</span>
          <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
            {report.materials || 'None'}
          </span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Equipment</span>
          <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
            {report.equipment || 'None'}
          </span>
        </div>
      </div>

      {/* Delays */}
      {(report.delay_hours > 0 || report.delay_reason) && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Delays</div>
          <div className="field-detail-row">
            <span className="field-detail-label">Delay Hours</span>
            <span className="field-detail-value">{report.delay_hours}</span>
          </div>
          {report.delay_reason && (
            <div className="field-detail-row">
              <span className="field-detail-label">Reason</span>
              <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                {report.delay_reason}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Safety */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Safety</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Incidents</span>
          <span
            className="field-detail-value"
            style={{
              color: report.safety_incidents > 0 ? '#ef4444' : '#22c55e',
              fontWeight: 600,
            }}
          >
            {report.safety_incidents}
          </span>
        </div>
        {report.safety_notes && (
          <div className="field-detail-row">
            <span className="field-detail-label">Notes</span>
            <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
              {report.safety_notes}
            </span>
          </div>
        )}
      </div>

      {/* Other */}
      {(report.visitors || report.issues) && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Other</div>
          {report.visitors && (
            <div className="field-detail-row">
              <span className="field-detail-label">Visitors</span>
              <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                {report.visitors}
              </span>
            </div>
          )}
          {report.issues && (
            <div className="field-detail-row">
              <span className="field-detail-label">Issues</span>
              <span className="field-detail-value" style={{ whiteSpace: 'pre-wrap' }}>
                {report.issues}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Report Info</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{report.created_by_name}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created At</span>
          <span className="field-detail-value">
            {formatDateTime(report.created_at)}
          </span>
        </div>
        {report.submitted_at && (
          <div className="field-detail-row">
            <span className="field-detail-label">Submitted At</span>
            <span className="field-detail-value">
              {formatDateTime(report.submitted_at)}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="field-actions-bar">
        {(report.status === 'draft' || report.status === 'revision') && (
          <>
            <button
              className="field-btn field-btn-secondary"
              onClick={() =>
                navigate(
                  `/field/projects/${projectId}/daily-reports/${report.id}/edit`
                )
              }
            >
              <EditIcon style={{ fontSize: 18, marginRight: 4 }} />
              Edit
            </button>
            <button
              className="field-btn field-btn-primary"
              onClick={handleSubmitReport}
              disabled={submitMutation.isPending}
            >
              <SendIcon style={{ fontSize: 18, marginRight: 4 }} />
              {submitMutation.isPending ? 'Submitting...' : (report.status === 'revision' ? 'Resubmit' : 'Submit')}
            </button>
          </>
        )}
        {report.status === 'submitted' && report.created_by === user?.id && (
          <button
            className="field-btn field-btn-secondary"
            onClick={handleRecallReport}
            disabled={reviseMutation.isPending}
          >
            {reviseMutation.isPending ? 'Recalling...' : 'Recall for Editing'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldDailyReportDetail;
