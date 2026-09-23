import React from 'react';
import { useQuery } from '@tanstack/react-query';
import opportunitiesService, { OpportunityHistoryEntry } from '../../services/opportunities';
import '../../styles/OpportunityHistory.css';

interface OpportunityHistoryProps {
  opportunityId: number;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

const OpportunityHistory: React.FC<OpportunityHistoryProps> = ({ opportunityId }) => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['opportunities', opportunityId, 'history'],
    queryFn: () => opportunitiesService.getHistory(opportunityId),
  });

  if (isLoading) {
    return <div className="opp-history-empty">Loading history...</div>;
  }

  if (history.length === 0) {
    return <div className="opp-history-empty">No history yet.</div>;
  }

  return (
    <div className="opp-history">
      {history.map((entry: OpportunityHistoryEntry, index: number) => (
        <div key={entry.id} className="opp-history-entry">
          <div className="opp-history-line">
            {index < history.length - 1 && <div className="opp-history-connector" />}
          </div>
          <div className={`opp-history-avatar ${entry.event_type === 'created' ? 'created' : 'updated'}`}>
            {getInitials(entry.user_name)}
          </div>
          <div className="opp-history-body">
            <div className="opp-history-header">
              <span className="opp-history-user">{entry.user_name || 'System'}</span>
              <span className="opp-history-action">
                {entry.event_type === 'created' ? 'created this opportunity' : 'made changes'}
              </span>
            </div>
            <div className="opp-history-time">{formatDateTime(entry.created_at)}</div>
            {entry.changes && entry.changes.length > 0 && (
              <div className="opp-history-changes">
                {entry.changes.map((change, i) => (
                  <div key={i} className="opp-history-change-row">
                    <span className="opp-history-field">{change.field}</span>
                    <span className="opp-history-old">{change.old}</span>
                    <span className="opp-history-arrow">→</span>
                    <span className="opp-history-new">{change.new}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OpportunityHistory;
