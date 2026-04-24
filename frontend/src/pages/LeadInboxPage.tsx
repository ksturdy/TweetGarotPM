import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import InboxIcon from '@mui/icons-material/Inbox';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import EmailIcon from '@mui/icons-material/Email';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import leadInboxApi, { LeadInbox } from '../services/leadInbox';
import './LeadInboxPage.css';

type TabFilter = 'ai_processed' | 'pending' | 'approved' | 'rejected' | 'error';

const CONFIDENCE_COLORS = {
  high: '#10b981',    // Green
  medium: '#f59e0b',  // Amber
  low: '#6b7280',     // Gray
  manual: '#3b82f6',  // Blue
};

const CONFIDENCE_LABELS = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  manual: 'MANUAL',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value: number | null): string {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const LeadInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TabFilter>('ai_processed');

  // Fetch leads with current filter
  const { data: leads, isLoading } = useQuery({
    queryKey: ['lead-inbox', statusFilter],
    queryFn: () => leadInboxApi.getAll({ status: statusFilter }),
  });

  // Fetch stats for badge counts
  const { data: stats } = useQuery({
    queryKey: ['lead-inbox-stats'],
    queryFn: () => leadInboxApi.getStats(),
    refetchInterval: 30000, // Poll every 30 seconds for new leads
  });

  const handleLeadClick = (leadId: number) => {
    navigate(`/lead-inbox/${leadId}`);
  };

  const getTabCount = (status: TabFilter): number => {
    if (!stats) return 0;
    return stats[status] || 0;
  };

  return (
    <div className="lead-inbox-page">
      <div className="page-header">
        <div className="header-left">
          <InboxIcon className="page-icon" />
          <h1>Lead Inbox</h1>
          {stats && stats.ai_processed > 0 && (
            <span className="pending-badge">{stats.ai_processed} ready to review</span>
          )}
        </div>
        <div className="header-right">
          <div className="email-info">
            <EmailIcon style={{ fontSize: 18, marginRight: 8 }} />
            <span>Forward leads to <strong>leads@titanpm3.com</strong></span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${statusFilter === 'ai_processed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ai_processed')}
        >
          <CheckCircleIcon style={{ fontSize: 18, marginRight: 6 }} />
          Ready to Review
          {getTabCount('ai_processed') > 0 && (
            <span className="tab-count">{getTabCount('ai_processed')}</span>
          )}
        </button>

        <button
          className={`tab ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <HourglassEmptyIcon style={{ fontSize: 18, marginRight: 6 }} />
          Processing
          {getTabCount('pending') > 0 && (
            <span className="tab-count">{getTabCount('pending')}</span>
          )}
        </button>

        <button
          className={`tab ${statusFilter === 'approved' ? 'active' : ''}`}
          onClick={() => setStatusFilter('approved')}
        >
          <CheckCircleIcon style={{ fontSize: 18, marginRight: 6 }} />
          Approved ({getTabCount('approved')})
        </button>

        <button
          className={`tab ${statusFilter === 'rejected' ? 'active' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CancelIcon style={{ fontSize: 18, marginRight: 6 }} />
          Rejected ({getTabCount('rejected')})
        </button>

        <button
          className={`tab ${statusFilter === 'error' ? 'active' : ''}`}
          onClick={() => setStatusFilter('error')}
        >
          <ErrorIcon style={{ fontSize: 18, marginRight: 6 }} />
          Errors
          {getTabCount('error') > 0 && (
            <span className="tab-count error">{getTabCount('error')}</span>
          )}
        </button>
      </div>

      <div className="lead-list">
        {isLoading && <div className="loading">Loading leads...</div>}

        {!isLoading && leads && leads.length === 0 && (
          <div className="empty-state">
            <InboxIcon style={{ fontSize: 64, color: '#d1d5db' }} />
            <h3>No leads in this category</h3>
            <p>
              {statusFilter === 'ai_processed' && 'Leads that have been processed by AI will appear here for review.'}
              {statusFilter === 'pending' && 'Leads currently being processed by AI will appear here.'}
              {statusFilter === 'approved' && 'Approved leads that have been converted to opportunities will appear here.'}
              {statusFilter === 'rejected' && 'Rejected leads will appear here.'}
              {statusFilter === 'error' && 'Leads that encountered errors during processing will appear here.'}
            </p>
          </div>
        )}

        {!isLoading && leads && leads.length > 0 && (
          <div className="lead-cards">
            {leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => handleLeadClick(lead.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface LeadCardProps {
  lead: LeadInbox;
  onClick: () => void;
}

const LeadCard: React.FC<LeadCardProps> = ({ lead, onClick }) => {
  const extractedData = lead.extracted_data;
  const title = extractedData?.title || lead.subject || '(No Subject)';
  const company = extractedData?.client_company || lead.from_name || 'Unknown';
  const location = extractedData?.location || 'Location not specified';
  const value = extractedData?.estimated_value;

  return (
    <div className="lead-card" onClick={onClick}>
      <div className="card-header">
        <div className="card-title-row">
          <h3 className="card-title">{title}</h3>
          {lead.ai_confidence && (
            <span
              className="confidence-badge"
              style={{
                backgroundColor: CONFIDENCE_COLORS[lead.ai_confidence],
                color: 'white',
              }}
            >
              {CONFIDENCE_LABELS[lead.ai_confidence]}
            </span>
          )}
        </div>
        <div className="card-meta">
          <span className="from-email">{lead.from_email}</span>
          <span className="received-date">{formatDate(lead.received_at)}</span>
        </div>
      </div>

      <div className="card-body">
        <div className="card-info-row">
          <span className="label">Company:</span>
          <span className="value">{company}</span>
        </div>
        <div className="card-info-row">
          <span className="label">Location:</span>
          <span className="value">{location}</span>
        </div>
        {value && (
          <div className="card-info-row">
            <span className="label">Est. Value:</span>
            <span className="value value-highlight">{formatCurrency(value)}</span>
          </div>
        )}
        {extractedData?.project_type && (
          <div className="card-info-row">
            <span className="label">Type:</span>
            <span className="value">{extractedData.project_type}</span>
          </div>
        )}
        {lead.attachment_count > 0 && (
          <div className="card-attachment-indicator">
            <AttachFileIcon style={{ fontSize: 14 }} />
            <span>{lead.attachment_count} attachment{lead.attachment_count > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {lead.status === 'error' && (
        <div className="card-error">
          <ErrorIcon style={{ fontSize: 16, marginRight: 4 }} />
          <span>{lead.ai_extraction_error || 'Processing error'}</span>
        </div>
      )}
    </div>
  );
};

export default LeadInboxPage;
