import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleIcon from '@mui/icons-material/People';
import { safetyJsaApi, SafetyJsa } from '../../../services/safetyJsa';

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
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
];

const FieldJSAList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: jsas = [], isLoading } = useQuery({
    queryKey: ['field-safety-jsas', projectId, statusFilter],
    queryFn: async () => {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const res = await safetyJsaApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading JSAs...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Job Safety Analysis</h1>
      <p className="field-page-subtitle">Safety hazard assessments for this project</p>

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

      {jsas.length === 0 ? (
        <div className="field-empty">
          <HealthAndSafetyIcon />
          <div className="field-empty-title">No JSAs found</div>
          <div className="field-empty-text">
            Tap the + button to create a new Job Safety Analysis
          </div>
        </div>
      ) : (
        jsas.map((jsa: SafetyJsa) => (
          <div
            key={jsa.id}
            className="field-card"
            onClick={() =>
              navigate(`/field/projects/${projectId}/safety-jsa/${jsa.id}`)
            }
          >
            <div className="field-card-header">
              <div>
                <div className="field-card-number">JSA-{jsa.number}</div>
                <div className="field-card-title">
                  {truncate(jsa.task_description, 60)}
                </div>
              </div>
              <span className={`field-status field-status-${jsa.status}`}>
                {jsa.status}
              </span>
            </div>
            <div className="field-card-subtitle">
              {formatDate(jsa.date_of_work)}
              {jsa.work_location ? ` \u2022 ${jsa.work_location}` : ''}
              {jsa.department_trade ? ` \u2022 ${jsa.department_trade}` : ''}
            </div>
            <div className="field-card-meta">
              <span>By {jsa.created_by_name}</span>
              {jsa.hazards && jsa.hazards.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <WarningAmberIcon style={{ fontSize: 14, color: '#f59e0b' }} />
                  {jsa.hazards.length} hazard{jsa.hazards.length !== 1 ? 's' : ''}
                </span>
              )}
              {jsa.worker_names && jsa.worker_names.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PeopleIcon style={{ fontSize: 14, color: '#6b7280' }} />
                  {jsa.worker_names.length} worker{jsa.worker_names.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        ))
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/safety-jsa/new`)
        }
        aria-label="Create JSA"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldJSAList;
