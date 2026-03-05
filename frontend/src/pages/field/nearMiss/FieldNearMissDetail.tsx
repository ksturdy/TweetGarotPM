import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ShareIcon from '@mui/icons-material/Share';
import { nearMissReportsApi, REPORT_TYPE_LABELS } from '../../../services/nearMissReports';
import { generateNearMissPdf } from '../../../utils/nearMissPdfClient';
import { useAuth } from '../../../context/AuthContext';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const FieldNearMissDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['field-near-miss-report', id],
    queryFn: async () => {
      const res = await nearMissReportsApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: () => nearMissReportsApi.submit(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-near-miss-report', id] });
      queryClient.invalidateQueries({ queryKey: ['field-near-miss-reports', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => nearMissReportsApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-near-miss-reports', projectId] });
      navigate(`/field/projects/${projectId}/safety-near-miss`);
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this report?')) {
      deleteMutation.mutate();
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    setDownloadingPdf(true);
    try {
      const blob = await generateNearMissPdf(report as any, logoUrl);
      const filename = `NM-${report.number}-${report.project_number || ''}.pdf`;

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
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleEmailReport = async () => {
    if (!report) return;
    setSendingEmail(true);
    try {
      const blob = await generateNearMissPdf(report as any, logoUrl);
      const filename = `NM-${report.number}-${report.project_number || ''}.pdf`;
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `NM-${report.number}`,
        });
      } else {
        // Desktop fallback: download file then open mailto
        const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        const typeLabel = REPORT_TYPE_LABELS[report.report_type] || report.report_type;
        const subject = encodeURIComponent(
          `${typeLabel} Report NM-${report.number} - ${report.project_name || ''} (${report.project_number || ''})`
        );
        const body = encodeURIComponent(
          `Please see the attached ${typeLabel} report NM-${report.number}.\n\n` +
          `The PDF is attached to this email.\n\n` +
          `Thank you,\nTweet Garot Mechanical`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to share report:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return <div className="field-loading">Loading report...</div>;
  }

  if (!report) {
    return <div className="field-loading">Report not found</div>;
  }

  const typeColor = report.report_type === 'near_miss' ? { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' } :
                    report.report_type === 'hazard_identification' ? { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' } :
                    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">NM-{report.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>
            {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
          </p>
        </div>
        <span className={`field-status field-status-${report.status}`}>
          {report.status}
        </span>
      </div>

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

      {/* Report Type Badge */}
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 16,
          fontSize: 13,
          fontWeight: 600,
          background: typeColor.bg,
          color: typeColor.text,
          border: `1px solid ${typeColor.border}`,
        }}>
          {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
        </span>
      </div>

      {/* Details Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Details</div>
        {report.project_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Project</span>
            <span className="field-detail-value">
              {report.project_name}{report.project_number ? ` (${report.project_number})` : ''}
            </span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Date</span>
          <span className="field-detail-value">{formatDate(report.date_of_incident)}</span>
        </div>
        {report.reported_by && (
          <div className="field-detail-row">
            <span className="field-detail-label">Reported By</span>
            <span className="field-detail-value">{report.reported_by}</span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Location on Site</span>
          <span className="field-detail-value">{report.location_on_site || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{report.created_by_name}</span>
        </div>
      </div>

      {/* Description Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Description of Near Miss / Hazard / Incentive</div>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {report.description || '-'}
        </div>
      </div>

      {/* Corrective Action Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Corrective Action Taken</div>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {report.corrective_action || '-'}
        </div>
      </div>

      {/* Date Corrected */}
      {report.date_corrected && (
        <div className="field-detail-section">
          <div className="field-detail-row">
            <span className="field-detail-label">Date Corrected</span>
            <span className="field-detail-value">{formatDate(report.date_corrected)}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {report.status === 'draft' && (
        <div className="field-actions-bar">
          <button
            className="field-btn field-btn-success"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            type="button"
          >
            <CheckCircleIcon style={{ fontSize: 18 }} />
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
          <button
            className="field-btn field-btn-primary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/safety-near-miss/${id}/edit`)
            }
            type="button"
          >
            <EditIcon style={{ fontSize: 18 }} />
            Edit
          </button>
          <button
            className="field-btn field-btn-danger field-btn-sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            type="button"
            style={{ width: 'auto', minWidth: 48 }}
          >
            <DeleteIcon style={{ fontSize: 18 }} />
          </button>
        </div>
      )}
    </div>
  );
};

export default FieldNearMissDetail;
