import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, ActivityItem } from '../../../services/dashboard';
import HistoryIcon from '@mui/icons-material/History';
import { WidgetProps } from '../types';
import { formatTimeAgo, getActivityIcon, getActivityLabel, getActivityPath } from '../utils';

const RecentActivityWidget: React.FC<WidgetProps> = () => {
  const navigate = useNavigate();

  const { data: recentActivity = [] } = useQuery<ActivityItem[]>({
    queryKey: ['recent-activity'],
    queryFn: () => dashboardApi.getRecentActivity(30),
  });

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <HistoryIcon className="card-title-icon" />
          Recent Activity
        </h2>
      </div>
      <div className="activity-feed">
        {recentActivity.length > 0 ? (
          recentActivity.map((item, index) => (
            <Link
              key={`${item.type}-${item.entityId}-${index}`}
              to={getActivityPath(item)}
              className="activity-feed-item"
              {...(item.type === 'opportunity' ? {
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  navigate('/sales', { state: { selectedOpportunityId: item.entityId } });
                }
              } : {})}
            >
              <div className={`activity-feed-icon ${item.type}`}>
                {getActivityIcon(item.type)}
              </div>
              <div className="activity-feed-body">
                <div className="activity-feed-text">
                  <strong>{item.actorName || 'Someone'}</strong>
                  {' '}{item.action === 'created' ? 'created' : 'updated'}{' '}
                  {getActivityLabel(item.type).toLowerCase()}
                  {' '}<strong>{item.title}</strong>
                </div>
                {item.parentName && (
                  <div className="activity-feed-project">{item.parentName}</div>
                )}
              </div>
              <div className="activity-feed-time">
                {formatTimeAgo(item.timestamp)}
              </div>
            </Link>
          ))
        ) : (
          <div className="activity-feed-empty">No recent activity</div>
        )}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
