import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { takeoffsApi, Takeoff } from '../../services/takeoffs';
import NewTakeoffDialog from '../../components/estimates/NewTakeoffDialog';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import './TakeoffsList.css';

const TakeoffsList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const { data: takeoffs = [], isLoading } = useQuery({
    queryKey: ['takeoffs', statusFilter, searchQuery],
    queryFn: () => takeoffsApi.getAll({ status: statusFilter, search: searchQuery }).then(res => res.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => takeoffsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['takeoffs'] }),
  });

  const formatStatus = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const formatType = (type: string) => type === 'traceover' ? 'Traceover' : 'Manual';

  const formatHours = (val: number) => {
    const n = Math.round(Number(val || 0));
    return n.toLocaleString();
  };

  const getEstimatorInitials = (name?: string): string => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getEstimatorColor = (name?: string): string => {
    if (!name) return '#6b7280';
    const colors = [
      '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const totalBaseHours = takeoffs.reduce((sum: number, t: Takeoff) => sum + Number(t.total_base_hours || 0), 0);
  const totalAdjustedHours = takeoffs.reduce((sum: number, t: Takeoff) => sum + Number(t.total_adjusted_hours || 0), 0);
  const completeCount = takeoffs.filter((t: Takeoff) => t.status === 'complete').length;

  const handleNewTakeoff = (type: 'manual' | 'traceover') => {
    setShowNewDialog(false);
    if (type === 'manual') {
      navigate('/estimating/takeoffs/new');
    } else {
      navigate('/estimating/takeoffs/new?type=traceover');
    }
  };

  if (isLoading) {
    return (
      <div className="to-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading takeoffs...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="to-container">
      {/* Compact Header */}
      <div className="to-page-header">
        <div className="to-page-title">
          <h1>Takeoffs</h1>
        </div>
        <div className="to-header-actions">
          <button
            onClick={() => setShowNewDialog(true)}
            className="to-btn to-btn-primary"
          >
            + New Takeoff
          </button>
        </div>
      </div>

      {/* Compact KPI Strip */}
      <div className="to-kpi-grid">
        <div className="to-kpi-card blue">
          <div className="to-kpi-label">Total Takeoffs</div>
          <div className="to-kpi-value">{takeoffs.length}</div>
        </div>
        <div className="to-kpi-card purple">
          <div className="to-kpi-label">Total Base Hours</div>
          <div className="to-kpi-value">{formatHours(totalBaseHours)}</div>
        </div>
        <div className="to-kpi-card green">
          <div className="to-kpi-label">Total Adjusted Hours</div>
          <div className="to-kpi-value">{formatHours(totalAdjustedHours)}</div>
        </div>
        <div className="to-kpi-card amber">
          <div className="to-kpi-label">Complete</div>
          <div className="to-kpi-value">{completeCount} / {takeoffs.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="to-table-section">
        <div className="to-table-header">
          <div className="to-table-title">
            All Takeoffs
            <span className="to-table-count">{takeoffs.length}</span>
          </div>
          <div className="to-table-controls">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="to-filter-select"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
              <option value="archived">Archived</option>
            </select>
            <div className="to-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {takeoffs.length === 0 ? (
          <div className="to-empty-state">
            <h3>No takeoffs yet</h3>
            <p>Create your first piping takeoff to start estimating labor hours.</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="to-btn to-btn-primary"
            >
              Create Takeoff
            </button>
          </div>
        ) : (
          <table className="to-table">
            <thead>
              <tr>
                <th>TO #</th>
                <th>Name</th>
                <th style={{ textAlign: 'center' }}>Type</th>
                <th style={{ textAlign: 'center' }}>Items</th>
                <th style={{ textAlign: 'right' }}>Base Hrs</th>
                <th style={{ textAlign: 'right' }}>Adj Hrs</th>
                <th style={{ textAlign: 'center' }}>Perf</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Estimator</th>
                <th style={{ textAlign: 'center' }}>Estimate</th>
              </tr>
            </thead>
            <tbody>
              {takeoffs.map((t: Takeoff) => {
                const perfNum = Number(t.performance_factor);
                const perfClass = perfNum < 0 ? 'to-perf-negative' : perfNum > 0 ? 'to-perf-positive' : 'to-perf-neutral';
                return (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/estimating/takeoffs/${t.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="to-number">{t.takeoff_number}</span>
                    </td>
                    <td>
                      <span className="to-name">{t.name}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`to-type-badge ${t.takeoff_type || 'manual'}`}>
                        {formatType(t.takeoff_type || 'manual')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {t.total_items}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="to-value-cell">{formatHours(t.total_base_hours)}</span>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-emerald)' }}>
                      <span className="to-value-cell">{formatHours(t.total_adjusted_hours)}</span>
                    </td>
                    <td style={{ textAlign: 'center' }} className={perfClass}>
                      {perfNum > 0 ? '+' : ''}{t.performance_factor}%
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`to-status-badge ${t.status}`}>
                        <span className="to-status-dot"></span>
                        {formatStatus(t.status)}
                      </span>
                    </td>
                    <td>
                      {t.estimator_name ? (
                        <div className="to-person-cell">
                          <div
                            className="to-person-avatar"
                            style={{ background: getEstimatorColor(t.estimator_name) }}
                          >
                            {getEstimatorInitials(t.estimator_name)}
                          </div>
                          {t.estimator_name}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Unassigned</span>
                      )}
                    </td>
                    <td className="to-date-cell" style={{ textAlign: 'center' }}>
                      {t.estimate_number || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <NewTakeoffDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onSelect={handleNewTakeoff}
      />
    </div>
  );
};

export default TakeoffsList;
