import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  safetyJsaApi,
  SafetyJsa,
  SafetyJsaHazard,
  SafetyJsaSignature,
} from '../../../services/safetyJsa';

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
  const { projectId, jsaId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showSignatureForm, setShowSignatureForm] = useState(false);
  const [signatureName, setSignatureName] = useState('');

  const {
    data: jsa,
    isLoading,
  } = useQuery({
    queryKey: ['field-safety-jsa', jsaId],
    queryFn: async () => {
      const res = await safetyJsaApi.getById(Number(jsaId));
      return res.data;
    },
    enabled: !!jsaId,
  });

  const activateMutation = useMutation({
    mutationFn: () => safetyJsaApi.activate(Number(jsaId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', jsaId] });
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => safetyJsaApi.complete(Number(jsaId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', jsaId] });
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => safetyJsaApi.delete(Number(jsaId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsas', projectId] });
      navigate(`/field/projects/${projectId}/safety-jsa`);
    },
  });

  const signatureMutation = useMutation({
    mutationFn: (name: string) =>
      safetyJsaApi.addSignature(Number(jsaId), { employeeName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-safety-jsa', jsaId] });
      setSignatureName('');
      setShowSignatureForm(false);
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

      {/* Details Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Details</div>
        <div className="field-detail-row">
          <span className="field-detail-label">Date of Work</span>
          <span className="field-detail-value">{formatDate(jsa.date_of_work)}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Location</span>
          <span className="field-detail-value">{jsa.work_location || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Weather</span>
          <span className="field-detail-value">{jsa.weather || '-'}</span>
        </div>
        <div className="field-detail-row">
          <span className="field-detail-label">Temperature</span>
          <span className="field-detail-value">{jsa.temperature || '-'}</span>
        </div>
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
        <div className="field-detail-section-title">Required PPE</div>
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

      {/* Hazards Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">
          <WarningAmberIcon style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} />
          Hazard Analysis
        </div>
        {jsa.hazards && jsa.hazards.length > 0 ? (
          jsa.hazards.map((hazard: SafetyJsaHazard) => (
            <div key={hazard.id} className="field-hazard-row">
              <div className="field-hazard-step">Step {hazard.sort_order}</div>
              <div className="field-detail-row">
                <span className="field-detail-label">Work Step</span>
                <span className="field-detail-value">{hazard.step_description || '-'}</span>
              </div>
              <div className="field-detail-row">
                <span className="field-detail-label">Hazard</span>
                <span className="field-detail-value">{hazard.hazard || '-'}</span>
              </div>
              <div className="field-detail-row">
                <span className="field-detail-label">Control Measure</span>
                <span className="field-detail-value">{hazard.control_measure || '-'}</span>
              </div>
              <div className="field-detail-row">
                <span className="field-detail-label">Responsible</span>
                <span className="field-detail-value">{hazard.responsible_person || '-'}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: '#6b7280' }}>No hazards documented</div>
        )}
      </div>

      {/* Notes Section */}
      {jsa.notes && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Notes</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {jsa.notes}
          </div>
        </div>
      )}

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
              navigate(`/field/projects/${projectId}/safety-jsa/${jsaId}/edit`)
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
