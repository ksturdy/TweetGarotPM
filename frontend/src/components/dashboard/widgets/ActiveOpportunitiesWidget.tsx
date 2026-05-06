import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import opportunitiesService from '../../../services/opportunities';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { WidgetProps } from '../types';
import { formatCurrency, getMarketGradient, getMarketIcon } from '../utils';

const ActiveOpportunitiesWidget: React.FC<WidgetProps> = ({
  viewScope,
  currentEmployeeId,
  teamMemberEmployeeIds,
}) => {
  const navigate = useNavigate();

  const { data: allOpportunities } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => opportunitiesService.getAll(),
  });

  const opportunities = React.useMemo(() => {
    if (!allOpportunities) return [];
    switch (viewScope) {
      case 'my':
        return allOpportunities.filter((o: any) => Number(o.assigned_to) === Number(currentEmployeeId));
      case 'team':
        return allOpportunities.filter((o: any) => teamMemberEmployeeIds.map(Number).includes(Number(o.assigned_to)));
      case 'company':
      default:
        return allOpportunities;
    }
  }, [allOpportunities, viewScope, currentEmployeeId, teamMemberEmployeeIds]);

  const sortedOpportunities = React.useMemo(() => {
    return [...opportunities]
      .filter((o: any) => {
        const stageName = o.stage_name?.toLowerCase() || '';
        return stageName !== 'won' && stageName !== 'lost';
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });
  }, [opportunities]);

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <HandshakeIcon className="card-title-icon" />
          Active Opportunities
        </h2>
        <Link to="/sales" state={{ myItemsOnly: viewScope === 'my' }} className="card-link">View all</Link>
      </div>
      <div className="dashboard-table-container dashboard-scrollable">
        <table className="sales-table dashboard-compact-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Opportunity</th>
              <th style={{ width: '14%', textAlign: 'center' }}>Value</th>
              <th style={{ width: '16%', textAlign: 'center' }}>Stage</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedOpportunities.length > 0 ? (
              sortedOpportunities.map((opp: any) => (
                <tr
                  key={opp.id}
                  onClick={() => navigate('/sales', { state: { selectedOpportunityId: opp.id } })}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: getMarketGradient(opp.market), width: '32px', height: '32px', fontSize: '0.75rem' }}>
                        {getMarketIcon(opp.market)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{opp.title}</h4>
                        {(opp.facility_location_name || opp.facility_name || opp.client_name) && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {opp.facility_location_name || opp.facility_name || opp.client_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="sales-value-cell" style={{ textAlign: 'center' }}>{formatCurrency(parseFloat(opp.estimated_value) || 0)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`sales-stage-badge ${opp.stage_name?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}>
                      <span className="sales-stage-dot"></span>
                      {opp.stage_name || 'Unknown'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#5a5a72', textAlign: 'center' }}>
                    {opp.updated_at ? new Date(opp.updated_at).toLocaleDateString() : (opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '-')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="empty-table">No opportunities found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActiveOpportunitiesWidget;
