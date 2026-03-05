import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { rfisApi, RFI } from '../../../services/rfis';

const truncate = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Answered', value: 'answered' },
  { label: 'Closed', value: 'closed' },
];

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  normal: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  high: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const FieldRFIList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: rfis = [], isLoading } = useQuery({
    queryKey: ['field-rfis', projectId, statusFilter],
    queryFn: async () => {
      const filters: { source: string; status?: string } = { source: 'field' };
      if (statusFilter) filters.status = statusFilter;
      const res = await rfisApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading RFIs...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">RFIs</h1>
      <p className="field-page-subtitle">Requests for Information</p>

      <div className="field-filters">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            className={`field-filter-chip ${statusFilter === filter.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {rfis.length === 0 ? (
        <div className="field-empty">
          <QuestionAnswerIcon />
          <div className="field-empty-title">No RFIs found</div>
          <div className="field-empty-text">
            Tap the + button to submit a new RFI
          </div>
        </div>
      ) : (
        rfis.map((rfi: RFI) => {
          const pColor = priorityColors[rfi.priority] || priorityColors.normal;
          return (
            <div
              key={rfi.id}
              className="field-card"
              onClick={() =>
                navigate(`/field/projects/${projectId}/rfis/${rfi.id}`)
              }
            >
              <div className="field-card-header">
                <div>
                  <div className="field-card-number">RFI-{rfi.number}</div>
                  <div className="field-card-title">
                    {truncate(rfi.subject, 60)}
                  </div>
                </div>
                <span className={`field-status field-status-${rfi.status}`}>
                  {rfi.status}
                </span>
              </div>
              <div className="field-card-subtitle">
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  marginRight: 8,
                  background: pColor.bg,
                  color: pColor.text,
                  border: `1px solid ${pColor.border}`,
                }}>
                  {rfi.priority.charAt(0).toUpperCase() + rfi.priority.slice(1)}
                </span>
                {rfi.discipline && (
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
                    {rfi.discipline.charAt(0).toUpperCase() + rfi.discipline.slice(1)}
                  </span>
                )}
                {rfi.drawing_sheet && `Dwg: ${rfi.drawing_sheet}`}
              </div>
              <div className="field-card-meta">
                <span>By {rfi.created_by_name}</span>
              </div>
            </div>
          );
        })
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/rfis/new`)
        }
        aria-label="Create RFI"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldRFIList;
