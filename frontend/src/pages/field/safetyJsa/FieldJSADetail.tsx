import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ShareIcon from '@mui/icons-material/Share';
import {
  safetyJsaApi,
  SafetyJsaHazard,
  SafetyJsaSignature,
} from '../../../services/safetyJsa';
import { generateJsaPdf } from '../../../utils/jsaPdfClient';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const FieldJSADetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [showSignatureForm, setShowSignatureForm] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const {
    data: jsa,
    isLoading,
  } = useQuery({
    queryKey: ['field-safety-jsa', id],
    queryFn: async () => {
      const res = await safetyJsaApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const activateMutation = useMutation({
    mutationFn: () => safetyJsaApi.activate(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', id] });
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => safetyJsaApi.complete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', id] });
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => safetyJsaApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
      navigate(`/field/projects/${projectId}/safety-jsa`);
    },
  });

  const signatureMutation = useMutation({
    mutationFn: (name: string) =>
      safetyJsaApi.addSignature(Number(id), { employeeName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', id] });
      setSignatureName('');
      setShowSignatureForm(false);
    },
  });

  const workerNamesMutation = useMutation({
    mutationFn: (names: string[]) =>
      safetyJsaApi.updateWorkerNames(Number(id), names),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', id] });
      setNewWorkerName('');
      setShowWorkerForm(false);
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this JSA?')) {
      deleteMutation.mutate();
    }
  };

  const handleAddSignature = () => {
    if (!signatureName.trim()) return;
    signatureMutation.mutate(signatureName.trim());
  };

  const handleAddWorkerName = () => {
    if (!newWorkerName.trim() || !jsa) return;
    const currentNames = jsa.worker_names || [];
    workerNamesMutation.mutate([...currentNames, newWorkerName.trim()]);
  };

  const handleDownloadPdf = async () => {
    if (!jsa) return;
    setDownloadingPdf(true);
    try {
      const blob = await generateJsaPdf(jsa);
      const filename = `JSA-${jsa.number}-${jsa.project_number || ''}.pdf`;

      // On iOS, use native share sheet (lets user save to Files, AirDrop, etc.)
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
        // Fallback: open blob URL in new tab
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

  const handleShareJsa = async () => {
    if (!jsa) return;
    setSendingEmail(true);
    try {
      const blob = await generateJsaPdf(jsa);
      const filename = `JSA-${jsa.number}-${jsa.project_number || ''}.pdf`;
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      // Use native share on mobile (works on iOS/Android) to attach file directly
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `JSA-${jsa.number}`,
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

        const subject = `JSA-${jsa.number} - ${jsa.project_name || ''} (${jsa.project_number || ''})`;
        window.location.href = `mailto:jsa@tweetgarot.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Please see attached ${filename}`)}`;
      }
    } catch (err: any) {
      // User cancelled the share sheet — not an error
      if (err?.name === 'AbortError') return;
      console.error('Failed to share JSA:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) {
    return <div className="field-loading">Loading JSA...</div>;
  }

  if (!jsa) {
    return <div className="field-loading">JSA not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">JSA-{jsa.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>
            {jsa.task_description}
          </p>
        </div>
        <span className={`field-status field-status-${jsa.status}`}>
          {jsa.status}
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
          onClick={handleShareJsa}
          disabled={sendingEmail}
          type="button"
          style={{ opacity: sendingEmail ? 0.6 : 1 }}
        >
          <ShareIcon style={{ fontSize: 16 }} />
          {sendingEmail ? 'Preparing...' : 'Email JSA'}
        </button>
      </div>

      {/* Details Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Details</div>
        {jsa.project_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Project</span>
            <span className="field-detail-value">
              {jsa.project_name}{jsa.project_number ? ` (${jsa.project_number})` : ''}
            </span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Date of Work</span>
          <span className="field-detail-value">{formatDate(jsa.date_of_work)}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Location</span>
          <span className="field-detail-value">{jsa.work_location || '-'}</span>
        </div>
        {jsa.customer_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Customer / GC</span>
            <span className="field-detail-value">{jsa.customer_name}</span>
          </div>
        )}
        {jsa.department_trade && (
          <div className="field-detail-row">
            <span className="field-detail-label">Department / Trade</span>
            <span className="field-detail-value">{jsa.department_trade}</span>
          </div>
        )}
        {jsa.filled_out_by && (
          <div className="field-detail-row">
            <span className="field-detail-label">Filled Out By</span>
            <span className="field-detail-value">{jsa.filled_out_by}</span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{jsa.created_by_name}</span>
        </div>
        {jsa.reviewed_by_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Reviewed By</span>
            <span className="field-detail-value">{jsa.reviewed_by_name}</span>
          </div>
        )}
      </div>

      {/* PPE Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">PPE Required</div>
        {jsa.ppe_required && jsa.ppe_required.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {jsa.ppe_required.map((item: string) => (
              <span
                key={item}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No PPE specified</div>
        )}
      </div>

      {/* Permits Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Permits Required</div>
        {jsa.permits_required && jsa.permits_required.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {jsa.permits_required.map((item: string) => (
              <span
                key={item}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#fff7ed',
                  color: '#c2410c',
                  border: '1px solid #fed7aa',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No permits specified</div>
        )}
      </div>

      {/* Equipment Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Equipment</div>
        {jsa.equipment_required && jsa.equipment_required.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {jsa.equipment_required.map((item: string) => (
              <span
                key={item}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No equipment specified</div>
        )}
      </div>

      {/* Hazards Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">
          <WarningAmberIcon style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} />
          Hazard Analysis
        </div>
        {jsa.hazards && jsa.hazards.length > 0 ? (
          jsa.hazards.map((hazard: SafetyJsaHazard) => (
            <div key={hazard.id} className="field-hazard-row">
              <div className="field-hazard-step">Row {hazard.sort_order}</div>
              <div className="field-detail-row">
                <span className="field-detail-label">Major Task</span>
                <span className="field-detail-value">{hazard.step_description || '-'}</span>
              </div>
              <div className="field-detail-row">
                <span className="field-detail-label">Potential Hazard</span>
                <span className="field-detail-value">{hazard.hazard || '-'}</span>
              </div>
              <div className="field-detail-row">
                <span className="field-detail-label">Control Action</span>
                <span className="field-detail-value">{hazard.control_measure || '-'}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No hazards documented</div>
        )}
      </div>

      {/* Additional Comments Section */}
      {jsa.additional_comments && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Additional Comments</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {jsa.additional_comments}
          </div>
        </div>
      )}

      {/* Legacy Notes Section (keep for backward compat) */}
      {jsa.notes && !jsa.additional_comments && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Notes</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {jsa.notes}
          </div>
        </div>
      )}

      {/* Worker Sign-In Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Worker Sign-In</div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            fontSize: 11,
            color: '#1e40af',
            marginBottom: 10,
            lineHeight: 1.3,
            fontStyle: 'italic',
          }}
        >
          By printing my name, I acknowledge my participation in the JSA and commit to work safely
        </div>

        {jsa.worker_names && jsa.worker_names.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            {jsa.worker_names.map((name: string, index: number) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: '#f9fafb',
                  borderRadius: 6,
                  marginBottom: 3,
                  border: '1px solid #e5e7eb',
                  fontSize: 14,
                  color: '#374151',
                }}
              >
                {index + 1}. {name}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            No workers signed in yet
          </div>
        )}

        {jsa.status === 'active' && !showWorkerForm && (
          <button
            className="field-btn field-btn-primary field-btn-sm"
            onClick={() => setShowWorkerForm(true)}
            type="button"
            style={{ marginTop: 4 }}
          >
            <PersonAddIcon style={{ fontSize: 16 }} />
            Add Worker
          </button>
        )}

        {jsa.status === 'active' && showWorkerForm && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="field-form-input"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder="Print worker name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddWorkerName();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button
                className="field-btn field-btn-success field-btn-sm"
                onClick={handleAddWorkerName}
                disabled={!newWorkerName.trim() || workerNamesMutation.isPending}
                type="button"
                style={{ opacity: !newWorkerName.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
              >
                {workerNamesMutation.isPending ? 'Saving...' : 'Add'}
              </button>
            </div>
            <button
              className="field-btn field-btn-secondary field-btn-sm"
              onClick={() => {
                setShowWorkerForm(false);
                setNewWorkerName('');
              }}
              type="button"
              style={{ marginTop: 6 }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Signatures Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Signatures</div>
        {jsa.signatures && jsa.signatures.length > 0 ? (
          jsa.signatures.map((sig: SafetyJsaSignature) => (
            <div key={sig.id} className="field-detail-row">
              <span className="field-detail-label">{sig.employee_name}</span>
              <span className="field-detail-value">{formatDateTime(sig.signed_at)}</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            No signatures yet
          </div>
        )}

        {jsa.status === 'active' && !showSignatureForm && (
          <button
            className="field-btn field-btn-primary field-btn-sm"
            onClick={() => setShowSignatureForm(true)}
            type="button"
            style={{ marginTop: 8 }}
          >
            <PersonAddIcon style={{ fontSize: 16 }} />
            Add Signature
          </button>
        )}

        {jsa.status === 'active' && showSignatureForm && (
          <div style={{ marginTop: 12 }}>
            <div className="field-form-group">
              <label className="field-form-label">Employee Name</label>
              <input
                type="text"
                className="field-form-input"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Enter your full name"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="field-btn field-btn-success field-btn-sm"
                onClick={handleAddSignature}
                disabled={!signatureName.trim() || signatureMutation.isPending}
                type="button"
                style={{ opacity: !signatureName.trim() ? 0.5 : 1 }}
              >
                {signatureMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                className="field-btn field-btn-secondary field-btn-sm"
                onClick={() => {
                  setShowSignatureForm(false);
                  setSignatureName('');
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {jsa.status === 'draft' && (
        <div className="field-actions-bar">
          <button
            className="field-btn field-btn-success"
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
            type="button"
          >
            <PlayArrowIcon style={{ fontSize: 18 }} />
            {activateMutation.isPending ? 'Activating...' : 'Activate'}
          </button>
          <button
            className="field-btn field-btn-primary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/safety-jsa/${id}/edit`)
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

      {jsa.status === 'active' && (
        <div className="field-actions-bar">
          <button
            className="field-btn field-btn-success"
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            type="button"
          >
            <CheckCircleIcon style={{ fontSize: 18 }} />
            {completeMutation.isPending ? 'Completing...' : 'Complete'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FieldJSADetail;
