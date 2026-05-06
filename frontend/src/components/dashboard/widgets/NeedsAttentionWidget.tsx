import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, AttentionItem } from '../../../services/dashboard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PersonIcon from '@mui/icons-material/Person';
import { WidgetProps } from '../types';

const NeedsAttentionWidget: React.FC<WidgetProps> = ({ viewScope }) => {
  const { data: attentionItems = [] } = useQuery<AttentionItem[]>({
    queryKey: ['attention-items', viewScope],
    queryFn: () => dashboardApi.getAttentionItems(viewScope),
  });

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          <WarningAmberIcon className="card-title-icon warning" />
          Needs Attention
        </h2>
        <span className="attention-count">{attentionItems.length}</span>
      </div>
      <div className="attention-list">
        {attentionItems.length > 0 ? (
          attentionItems.map((item) => (
            <Link key={item.id} to={item.path} className={`attention-item severity-${item.severity}`}>
              <div className="attention-content">
                <div className="attention-message">{item.message}</div>
                <div className="attention-meta">
                  <span className="attention-project">{item.project}</span>
                  {item.responsiblePerson && (
                    <span className="attention-responsible">
                      <PersonIcon style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }} />
                      {item.responsiblePerson}
                    </span>
                  )}
                </div>
              </div>
              <ArrowForwardIcon className="attention-arrow" fontSize="small" />
            </Link>
          ))
        ) : (
          <div className="empty-attention">
            <CheckCircleIcon className="empty-icon" />
            <p>All caught up! No items need attention.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NeedsAttentionWidget;
