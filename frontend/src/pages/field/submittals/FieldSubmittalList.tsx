import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { submittalsApi, Submittal } from '../../../services/submittals';

const STATUS_LABEL: Record<string, string> = {
  requested_from_vendor: 'Requested from Vendor',
  submitted_for_approval: 'Submitted for Approval',
  revise_resubmit: 'Revise & Resubmit',
  approved: 'Approved',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  requested_from_vendor: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  submitted_for_approval: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  revise_resubmit: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  approved: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
};

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Requested', value: 'requested_from_vendor' },
  { label: 'Submitted', value: 'submitted_for_approval' },
  { label: 'Revise', value: 'revise_resubmit' },
  { label: 'Approved', value: 'approved' },
];

const truncate = (text: string | null | undefined, max: number) => {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '…' : text;
};

const FieldSubmittalList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: submittals = [], isLoading } = useQuery({
    queryKey: ['field-submittals', projectId, statusFilter],
    queryFn: async () => {
      const filters: { status?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      const res = await submittalsApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading submittals...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Submittals</h1>
      <p className="field-page-subtitle">Shop drawings & product data</p>

      <div className="field-filters">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            className={`field-filter-chip ${statusFilter === f.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {submittals.length === 0 ? (
        <div className="field-empty">
          <AttachFileIcon />
          <div className="field-empty-title">No submittals found</div>
          <div className="field-empty-text">Tap the + button to create a new submittal</div>
        </div>
      ) : (
        submittals.map((sub: Submittal) => {
          const sc = STATUS_COLORS[sub.status] || STATUS_COLORS.submitted_for_approval;
          return (
            <div
              key={sub.id}
              className="field-card"
              onClick={() => navigate(`/field/projects/${projectId}/submittals/${sub.id}`)}
            >
              <div className="field-card-header">
                <div>
                  <div className="field-card-number">SUB-{sub.number}</div>
                  <div className="field-card-title">{truncate(sub.name || sub.description, 60)}</div>
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  background: sc.bg,
                  color: sc.text,
                  border: `1px solid ${sc.border}`,
                }}>
                  {STATUS_LABEL[sub.status] ?? sub.status}
                </span>
              </div>
              <div className="field-card-subtitle">
                {sub.spec_section && (
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    marginRight: 8,
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                  }}>
                    {sub.spec_section}
                  </span>
                )}
                {sub.subcontractor && truncate(sub.subcontractor, 40)}
              </div>
              {sub.description && sub.name && (
                <div className="field-card-meta">
                  <span>{truncate(sub.description, 80)}</span>
                </div>
              )}
            </div>
          );
        })
      )}

      <button
        className="field-fab"
        onClick={() => navigate(`/field/projects/${projectId}/submittals/new`)}
        aria-label="Create Submittal"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldSubmittalList;
