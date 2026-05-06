import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { tradeShowsApi, TRADE_SHOW_STATUS_OPTIONS, TradeShow } from '../../../services/tradeShows';
import { WidgetProps } from '../types';

const formatDateRange = (start?: string | null, end?: string | null): string => {
  if (!start && !end) return '-';
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end || '');
};

const formatLocation = (show: TradeShow): string => {
  const parts = [show.city, show.state].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : (show.venue || '-');
};

const TradeShowsWidget: React.FC<WidgetProps> = ({
  viewScope,
  currentUserId,
  teamMemberUserIds,
}) => {
  const navigate = useNavigate();

  const { data: allShows = [] } = useQuery<TradeShow[]>({
    queryKey: ['trade-shows'],
    queryFn: () => tradeShowsApi.getAll().then(res => res.data),
  });

  const visibleShows = React.useMemo(() => {
    const upcoming = allShows.filter(s =>
      s.status === 'upcoming' || s.status === 'registered' || s.status === 'in_progress'
    );

    const scoped = (() => {
      switch (viewScope) {
        case 'my':
          return upcoming.filter(s =>
            Number(s.sales_lead_id) === Number(currentUserId) ||
            Number(s.coordinator_id) === Number(currentUserId)
          );
        case 'team':
          return upcoming.filter(s => {
            const teamIds = teamMemberUserIds.map(Number);
            return teamIds.includes(Number(s.sales_lead_id)) ||
              teamIds.includes(Number(s.coordinator_id));
          });
        case 'company':
        default:
          return upcoming;
      }
    })();

    return [...scoped].sort((a, b) => {
      const dateA = a.event_start_date ? new Date(a.event_start_date).getTime() : Infinity;
      const dateB = b.event_start_date ? new Date(b.event_start_date).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [allShows, viewScope, currentUserId, teamMemberUserIds]);

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <StorefrontIcon className="card-title-icon" />
          Trade Shows
        </h2>
        <Link to="/marketing/trade-shows" className="card-link">View all</Link>
      </div>
      <div className="dashboard-table-container dashboard-scrollable">
        <table className="sales-table dashboard-compact-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Event</th>
              <th style={{ width: '22%' }}>Dates</th>
              <th style={{ width: '20%' }}>Location</th>
              <th style={{ width: '18%', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleShows.length > 0 ? (
              visibleShows.map(show => {
                const statusOpt = TRADE_SHOW_STATUS_OPTIONS.find(o => o.value === show.status);
                return (
                  <tr
                    key={show.id}
                    onClick={() => navigate(`/marketing/trade-shows/${show.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className="sales-project-info">
                        <h4>{show.name}</h4>
                        {show.booth_number && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            Booth {show.booth_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>
                      {formatDateRange(show.event_start_date, show.event_end_date)}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>
                      {formatLocation(show)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="sales-stage-badge"
                        style={{
                          background: `${statusOpt?.color || '#6b7280'}20`,
                          color: statusOpt?.color || '#6b7280',
                        }}
                      >
                        <span className="sales-stage-dot" style={{ background: statusOpt?.color || '#6b7280' }}></span>
                        {statusOpt?.label || show.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="empty-table">No upcoming trade shows</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeShowsWidget;
