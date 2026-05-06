import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { estimatesApi } from '../../../services/estimates';
import CalculateIcon from '@mui/icons-material/Calculate';
import { WidgetProps } from '../types';
import { formatCurrency, getMarketGradient, getMarketIcon } from '../utils';

const RecentEstimatesWidget: React.FC<WidgetProps> = ({
  viewScope,
  currentEmployeeId,
  currentUserId,
  currentUserName,
  teamMemberEmployeeIds,
  teamMemberUserIds,
  teamMemberNames,
}) => {
  const { data: estimatesResponse } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => estimatesApi.getAll(),
  });
  const allEstimates = estimatesResponse?.data || [];

  const estimates = React.useMemo(() => {
    if (!allEstimates) return [];

    switch (viewScope) {
      case 'my':
        return allEstimates.filter((e: any) => {
          const hasAssignedEstimator = e.estimator_id || e.estimator_name;
          if (hasAssignedEstimator) {
            return Number(e.estimator_id) === Number(currentEmployeeId) ||
              (e.estimator_name && currentUserName && e.estimator_name.toLowerCase() === currentUserName.toLowerCase());
          } else {
            return Number(e.created_by) === Number(currentUserId);
          }
        });
      case 'team':
        return allEstimates.filter((e: any) => {
          const hasAssignedEstimator = e.estimator_id || e.estimator_name;
          if (hasAssignedEstimator) {
            return teamMemberEmployeeIds.map(Number).includes(Number(e.estimator_id)) ||
              (e.estimator_name && teamMemberNames.some((name: string) => name.toLowerCase() === e.estimator_name.toLowerCase()));
          } else {
            return teamMemberUserIds.map(Number).includes(Number(e.created_by));
          }
        });
      case 'company':
      default:
        return allEstimates;
    }
  }, [allEstimates, viewScope, currentEmployeeId, currentUserId, currentUserName, teamMemberEmployeeIds, teamMemberUserIds, teamMemberNames]);

  const sortedEstimates = React.useMemo(() => {
    return [...estimates].sort((a: any, b: any) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [estimates]);

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <CalculateIcon className="card-title-icon" />
          Recent Estimates
        </h2>
        <Link to="/estimating" state={{ myItemsOnly: viewScope === 'my' }} className="card-link">View all</Link>
      </div>
      <div className="dashboard-table-container dashboard-scrollable">
        <table className="sales-table dashboard-compact-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Project / Estimate</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Value</th>
              <th style={{ width: '15%' }}>Status</th>
              <th style={{ width: '15%' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedEstimates.length > 0 ? (
              sortedEstimates.map((estimate: any) => (
                <tr
                  key={estimate.id}
                  onClick={() => window.location.href = `/estimating/estimates/${estimate.id}`}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: getMarketGradient(estimate.building_type), width: '32px', height: '32px', fontSize: '0.75rem' }}>
                        {getMarketIcon(estimate.building_type)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{estimate.project_name || 'Untitled'}</h4>
                        {(estimate.customer_name || estimate.facility_name) && (
                          <span style={{ fontSize: '0.75rem', color: '#5a5a72' }}>
                            {estimate.customer_name || estimate.facility_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="sales-value-cell">
                    {formatCurrency(parseFloat(estimate.total_cost) || 0)}
                  </td>
                  <td>
                    <span className={`sales-stage-badge ${estimate.status?.toLowerCase().replace(/\s+/g, '-') || 'in-progress'}`}>
                      <span className="sales-stage-dot"></span>
                      {(!estimate.status || estimate.status.toLowerCase() === 'in progress') ? 'Bidding' : estimate.status.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>
                    {estimate.updated_at ? new Date(estimate.updated_at).toLocaleDateString() : (estimate.created_at ? new Date(estimate.created_at).toLocaleDateString() : '-')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="empty-table">No estimates found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentEstimatesWidget;
