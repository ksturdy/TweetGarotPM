import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmailIcon from '@mui/icons-material/Email';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import TimelineIcon from '@mui/icons-material/Timeline';
import leadInboxApi, { ExtractedLeadData, LeadInbox } from '../services/leadInbox';
import { useTitanFeedback } from '../context/TitanFeedbackContext';
import './LeadInboxDetailPage.css';

const CONFIDENCE_COLORS = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#6b7280',
  manual: '#3b82f6',
};

const CONFIDENCE_LABELS = {
  high: 'HIGH CONFIDENCE',
  medium: 'MEDIUM CONFIDENCE',
  low: 'LOW CONFIDENCE',
  manual: 'MANUALLY EDITED',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const LeadInboxDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [formData, setFormData] = useState<Partial<ExtractedLeadData>>({});
  const [isEdited, setIsEdited] = useState(false);

  // Fetch lead details
  const { data: lead, isLoading } = useQuery<LeadInbox>({
    queryKey: ['lead-inbox-detail', id],
    queryFn: () => leadInboxApi.getById(Number(id)),
  });

  // Update form data when lead is loaded
  useEffect(() => {
    if (lead?.extracted_data) {
      setFormData(lead.extracted_data);
    }
  }, [lead]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => leadInboxApi.approve(Number(id), formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['lead-inbox-stats'] });
      alert('Lead approved and opportunity created!');
      navigate('/sales-pipeline');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to approve lead');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => leadInboxApi.reject(Number(id), reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['lead-inbox-stats'] });
      alert('Lead rejected');
      navigate('/lead-inbox');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to reject lead');
    },
  });

  // Reprocess mutation
  const reprocessMutation = useMutation({
    mutationFn: () => leadInboxApi.reprocess(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-inbox-detail', id] });
      alert('Re-processing lead with AI...');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to reprocess lead');
    },
  });

  const handleApprove = async () => {
    const confirmed = await confirm({
      title: 'Create Opportunity',
      message: 'Are you sure you want to create an opportunity from this lead?',
      confirmText: 'Create Opportunity',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      approveMutation.mutate();
    }
  };

  const handleReject = async () => {
    // TODO: Use a better input dialog
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason !== null) {
      rejectMutation.mutate(reason || 'No reason provided');
    }
  };

  const handleReprocess = async () => {
    const confirmed = await confirm({
      title: 'Re-process with AI',
      message: 'This will re-run AI extraction and replace the current extracted data. Continue?',
      confirmText: 'Re-process',
      cancelText: 'Cancel',
    });

    if (confirmed) {
      reprocessMutation.mutate();
    }
  };

  const handleFieldChange = (field: keyof ExtractedLeadData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsEdited(true);
  };

  if (isLoading || !lead) {
    return <div className="loading-container">Loading lead details...</div>;
  }

  const canApprove = lead.status === 'ai_processed' || lead.status === 'error';
  const canReject = lead.status !== 'rejected' && lead.status !== 'approved';
  const canReprocess = lead.status !== 'pending';

  return (
    <div className="lead-inbox-detail-page">
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate('/lead-inbox')}>
          <ArrowBackIcon style={{ fontSize: 20 }} />
          Back to Inbox
        </button>

        <div className="header-actions">
          {canReprocess && (
            <button
              className="btn-secondary"
              onClick={handleReprocess}
              disabled={reprocessMutation.isPending}
            >
              <RefreshIcon style={{ fontSize: 18, marginRight: 6 }} />
              Re-process
            </button>
          )}
          {canReject && (
            <button
              className="btn-danger"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              <CancelIcon style={{ fontSize: 18, marginRight: 6 }} />
              Reject
            </button>
          )}
          {canApprove && (
            <button
              className="btn-primary"
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              <CheckCircleIcon style={{ fontSize: 18, marginRight: 6 }} />
              Approve & Create Opportunity
            </button>
          )}
        </div>
      </div>

      <div className="detail-content">
        {/* Left Column: Email Display */}
        <div className="email-column">
          <div className="section">
            <div className="section-header">
              <EmailIcon style={{ fontSize: 20, marginRight: 8 }} />
              <h2>Email Details</h2>
              {lead.ai_confidence && (
                <span
                  className="confidence-badge"
                  style={{
                    backgroundColor: CONFIDENCE_COLORS[lead.ai_confidence],
                    marginLeft: 'auto',
                  }}
                >
                  {CONFIDENCE_LABELS[lead.ai_confidence]}
                </span>
              )}
            </div>

            <div className="email-meta">
              <div className="meta-row">
                <span className="label">From:</span>
                <span className="value">
                  {lead.from_name && <strong>{lead.from_name}</strong>}
                  <span className="email-addr">&lt;{lead.from_email}&gt;</span>
                </span>
              </div>
              <div className="meta-row">
                <span className="label">Subject:</span>
                <span className="value">{lead.subject || '(No Subject)'}</span>
              </div>
              <div className="meta-row">
                <span className="label">Received:</span>
                <span className="value">{formatDate(lead.received_at)}</span>
              </div>
              {lead.attachment_count > 0 && (
                <div className="meta-row">
                  <span className="label">Attachments:</span>
                  <span className="value">
                    <AttachFileIcon style={{ fontSize: 14, verticalAlign: 'middle' }} />
                    {lead.attachment_count} file{lead.attachment_count > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <h3>Email Body</h3>
            <div className="email-body">
              {lead.stripped_text || lead.body_text || '(Empty email body)'}
            </div>
          </div>

          {lead.attachments && lead.attachments.length > 0 && (
            <div className="section">
              <h3>Attachments</h3>
              <div className="attachments-list">
                {lead.attachments.map(attachment => (
                  <div key={attachment.id} className="attachment-item">
                    <AttachFileIcon style={{ fontSize: 18 }} />
                    <span className="attachment-name">{attachment.original_name}</span>
                    {attachment.size_bytes && (
                      <span className="attachment-size">
                        ({(attachment.size_bytes / 1024).toFixed(1)} KB)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {lead.activities && lead.activities.length > 0 && (
            <div className="section">
              <div className="section-header">
                <TimelineIcon style={{ fontSize: 20, marginRight: 8 }} />
                <h3>Activity Log</h3>
              </div>
              <div className="activities-list">
                {lead.activities.map(activity => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-type">{activity.activity_type}</div>
                    <div className="activity-description">{activity.description}</div>
                    <div className="activity-time">{formatDate(activity.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Extracted Data Form */}
        <div className="form-column">
          <div className="section">
            <h2>Extracted Opportunity Data</h2>
            {isEdited && (
              <div className="edit-indicator">You have unsaved edits</div>
            )}

            {lead.status === 'error' && (
              <div className="error-message">
                <CancelIcon style={{ fontSize: 18, marginRight: 8 }} />
                AI Extraction Failed: {lead.ai_extraction_error}
              </div>
            )}

            <form className="extracted-data-form">
              <div className="form-group">
                <label>Project Title *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="Project name"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Project description"
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Client Name</label>
                  <input
                    type="text"
                    value={formData.client_name || ''}
                    onChange={(e) => handleFieldChange('client_name', e.target.value)}
                    placeholder="Contact name"
                  />
                </div>

                <div className="form-group">
                  <label>Client Company</label>
                  <input
                    type="text"
                    value={formData.client_company || ''}
                    onChange={(e) => handleFieldChange('client_company', e.target.value)}
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Client Email</label>
                  <input
                    type="email"
                    value={formData.client_email || ''}
                    onChange={(e) => handleFieldChange('client_email', e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Client Phone</label>
                  <input
                    type="tel"
                    value={formData.client_phone || ''}
                    onChange={(e) => handleFieldChange('client_phone', e.target.value)}
                    placeholder="555-1234"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    placeholder="City, State"
                  />
                </div>

                <div className="form-group">
                  <label>Estimated Value</label>
                  <input
                    type="number"
                    value={formData.estimated_value || ''}
                    onChange={(e) => handleFieldChange('estimated_value', Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Project Type</label>
                  <select
                    value={formData.project_type || ''}
                    onChange={(e) => handleFieldChange('project_type', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Data Center">Data Center</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Education">Education</option>
                    <option value="Government">Government</option>
                    <option value="Residential">Residential</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Construction Type</label>
                  <select
                    value={formData.construction_type || ''}
                    onChange={(e) => handleFieldChange('construction_type', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="New Construction">New Construction</option>
                    <option value="Renovation">Renovation</option>
                    <option value="Expansion">Expansion</option>
                    <option value="Tenant Improvement">Tenant Improvement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>General Contractor</label>
                <input
                  type="text"
                  value={formData.general_contractor || ''}
                  onChange={(e) => handleFieldChange('general_contractor', e.target.value)}
                  placeholder="GC name"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Architect</label>
                  <input
                    type="text"
                    value={formData.architect || ''}
                    onChange={(e) => handleFieldChange('architect', e.target.value)}
                    placeholder="Architect name"
                  />
                </div>

                <div className="form-group">
                  <label>Engineer</label>
                  <input
                    type="text"
                    value={formData.engineer || ''}
                    onChange={(e) => handleFieldChange('engineer', e.target.value)}
                    placeholder="Engineer name"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Est. Start Date</label>
                  <input
                    type="date"
                    value={formData.estimated_start_date || ''}
                    onChange={(e) => handleFieldChange('estimated_start_date', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority || 'medium'}
                    onChange={(e) => handleFieldChange('priority', e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {formData.extraction_notes && (
                <div className="form-group">
                  <label>AI Notes</label>
                  <div className="ai-notes">{formData.extraction_notes}</div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadInboxDetailPage;
