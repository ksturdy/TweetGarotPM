import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import { safetyObservationsApi, AUDIT_AREAS, SafetyObservation } from '../../../services/safetyObservations';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewed', label: 'Reviewed' },
];

const FieldSafetyObservationList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: observations = [], isLoading } = useQuery({
    queryKey: ['field-safety-observations', projectId, statusFilter],
    queryFn: () =>
      safetyObservationsApi
        .getByProject(Number(projectId), statusFilter ? { status: statusFilter } : undefined)
        .then(r => r.data),
  });

  const formatDate = (d: string) => {
    const dt = new Date(d.slice(0, 10) + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const countNos = (obs: SafetyObservation) => {
    let count = 0;
    for (const s of obs.sections ?? []) {
      for (const item of s.items ?? []) {
        if (item.answer === 'no') count++;
      }
    }
    return count;
  };

  const getAreaLabels = (obs: SafetyObservation) =>
    (obs.sections ?? [])
      .map(s => AUDIT_AREAS.find(a => a.key === s.area)?.label ?? s.area)
      .filter(Boolean);

  if (isLoading) {
    return <div className="field-loading">Loading observations...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 className="field-page-title">Safety Observations</h1>
        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
          {observations.length} record{observations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status filter chips */}
      <div className="field-filters">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            className={`field-filter-chip ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
            type="button"
          >
            {f.label}
          </button>
        ))}
      </div>

      {observations.length === 0 ? (
        <div className="field-empty">
          <HealthAndSafetyIcon />
          <div className="field-empty-title">No observations yet</div>
          <div className="field-empty-text">Tap + to submit a safety observation</div>
        </div>
      ) : (
        observations.map(obs => {
          const noCount = countNos(obs);
          const areaLabels = getAreaLabels(obs);
          const isReviewed = obs.status === 'reviewed';

          return (
            <div
              key={obs.id}
              className="field-card"
              onClick={() => navigate(`/field/projects/${projectId}/safety-observations/${obs.id}`)}
            >
              <div className="field-card-header">
                <div>
                  <div className="field-card-number">OBS-{obs.number}</div>
                  <div className="field-card-title" style={{ marginTop: 2 }}>
                    {areaLabels.length > 0
                      ? areaLabels.length <= 2
                        ? areaLabels.join(', ')
                        : `${areaLabels.slice(0, 2).join(', ')} +${areaLabels.length - 2} more`
                      : 'Safety Observation'}
                  </div>
                </div>
                <span className={`field-status field-status-${obs.status}`}>
                  {obs.status}
                </span>
              </div>

              {/* Area chips */}
              {areaLabels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {areaLabels.map(label => (
                    <span key={label} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: '#eff6ff', color: '#1a56db', fontWeight: 600,
                    }}>
                      {label}
                    </span>
                  ))}
                </div>
              )}

              <div className="field-card-meta">
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarTodayIcon style={{ fontSize: 13 }} />
                    {formatDate(obs.date_of_observation)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <PersonIcon style={{ fontSize: 13 }} />
                    {obs.observer_name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {obs.stretch_and_flex === true && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>
                      S&amp;F ✓
                    </span>
                  )}
                  {noCount > 0 ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                      <ErrorIcon style={{ fontSize: 14 }} />
                      {noCount} issue{noCount > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                      <CheckCircleIcon style={{ fontSize: 14 }} />
                      Clean
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* FAB */}
      <button
        className="field-fab"
        onClick={() => navigate(`/field/projects/${projectId}/safety-observations/new`)}
        title="New Safety Observation"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldSafetyObservationList;
