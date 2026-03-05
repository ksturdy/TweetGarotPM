import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { nearMissReportsApi, NearMissReport, REPORT_TYPE_LABELS } from '../../../services/nearMissReports';

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const truncate = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
];

const FieldNearMissList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['field-near-miss-reports', projectId, statusFilter],
    queryFn: async () => {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const res = await nearMissReportsApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading reports...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Near Miss Reports</h1>
      <p className="field-page-subtitle">Near miss, hazard identification, and incentive reports</p>

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

      {reports.length === 0 ? (
        <div className="field-empty">
          <ReportProblemIcon />
          <div className="field-empty-title">No reports found</div>
          <div className="field-empty-text">
            Tap the + button to create a new report
          </div>
        </div>
      ) : (
        reports.map((report: NearMissReport) => (
          <div
            key={report.id}
            className="field-card"
            onClick={() =>
              navigate(`/field/projects/${projectId}/safety-near-miss/${report.id}`)
            }
          >
            <div className="field-card-header">
              <div>
                <div className="field-card-number">NM-{report.number}</div>
                <div className="field-card-title">
                  {truncate(report.description, 60)}
                </div>
              </div>
              <span className={`field-status field-status-${report.status}`}>
                {report.status}
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
                background: report.report_type === 'near_miss' ? '#fef2f2' :
                            report.report_type === 'hazard_identification' ? '#fff7ed' : '#f0fdf4',
                color: report.report_type === 'near_miss' ? '#dc2626' :
                       report.report_type === 'hazard_identification' ? '#c2410c' : '#15803d',
                border: `1px solid ${report.report_type === 'near_miss' ? '#fecaca' :
                         report.report_type === 'hazard_identification' ? '#fed7aa' : '#bbf7d0'}`,
              }}>
                {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
              </span>
              {formatDate(report.date_of_incident)}
              {report.location_on_site ? ` \u2022 ${report.location_on_site}` : ''}
            </div>
            <div className="field-card-meta">
              <span>By {report.created_by_name}</span>
              {report.date_corrected && (
                <span>Corrected: {formatDate(report.date_corrected)}</span>
              )}
            </div>
          </div>
        ))
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/safety-near-miss/new`)
        }
        aria-label="Create near miss report"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldNearMissList;
