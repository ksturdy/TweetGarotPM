import React from 'react';
import { Opportunity } from '../../services/opportunities';
import '../../styles/OpportunityCard.css';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onDragStart: (e: React.DragEvent, opportunity: Opportunity) => void;
  onTouchStart: (e: React.TouchEvent, opportunity: Opportunity) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onClick: (opportunity: Opportunity) => void;
  isDragging: boolean;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onDragStart,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onClick,
  isDragging
}) => {
  const formatCurrency = (value?: number) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '';
    }
  };

  return (
    <div
      className={`opportunity-card ${isDragging ? 'dragging' : ''} ${getPriorityClass(opportunity.priority)}`}
      draggable
      onDragStart={(e) => onDragStart(e, opportunity)}
      onTouchStart={(e) => onTouchStart(e, opportunity)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={() => onClick(opportunity)}
    >
      {/* Priority Indicator */}
      {opportunity.priority && opportunity.priority !== 'medium' && (
        <div className="card-priority">
          <span className="priority-icon">{getPriorityIcon(opportunity.priority)}</span>
        </div>
      )}

      {/* Card Header */}
      <div className="card-header">
        <h4 className="card-title">{opportunity.title}</h4>
        {opportunity.estimated_value && (
          <span className="card-value">{formatCurrency(opportunity.estimated_value)}</span>
        )}
      </div>

      {/* Client Info */}
      <div className="card-client">
        <span className="client-icon">👤</span>
        <div className="client-info">
          <span className="client-name">{opportunity.client_name}</span>
          {opportunity.client_company && (
            <span className="client-company">{opportunity.client_company}</span>
          )}
        </div>
      </div>

      {/* Card Meta */}
      <div className="card-meta">
        {opportunity.project_type && (
          <span className="meta-tag">{opportunity.project_type}</span>
        )}
        {opportunity.location && (
          <span className="meta-location">📍 {opportunity.location}</span>
        )}
      </div>

      {/* Card Footer */}
      <div className="card-footer">
        <div className="footer-left">
          {opportunity.assigned_to_name && (
            <div className="assigned-to">
              <span className="avatar">
                {opportunity.assigned_to_name.split(' ').map(n => n[0]).join('')}
              </span>
              <span className="assigned-name">{opportunity.assigned_to_name.split(' ')[0]}</span>
            </div>
          )}
        </div>

        <div className="footer-right">
          {opportunity.open_tasks_count && opportunity.open_tasks_count > 0 && (
            <span className="tasks-badge">
              ✓ {opportunity.open_tasks_count}
            </span>
          )}
          {opportunity.last_activity_at && (
            <span className="last-activity">
              {formatDate(opportunity.last_activity_at)}
            </span>
          )}
        </div>
      </div>

      {/* Swipe Indicator for Mobile */}
      <div className="swipe-indicator">
        <span className="swipe-arrow">←</span>
        <span className="swipe-text">Swipe to move</span>
        <span className="swipe-arrow">→</span>
      </div>
    </div>
  );
};

export default OpportunityCard;
