import React, { useState } from 'react';
import { Feedback, FeedbackVote } from '../../services/feedback';
import { useAuth } from '../../context/AuthContext';
import './FeedbackList.css';

interface FeedbackListProps {
  feedbackItems: Feedback[];
  userVotes: Map<number, FeedbackVote | null>;
  onVote: (feedbackId: number, voteType: 'up' | 'down') => void;
  onRemoveVote: (feedbackId: number) => void;
  onSelectFeedback: (feedback: Feedback) => void;
  selectedFeedbackId?: number;
}

const FeedbackList: React.FC<FeedbackListProps> = ({
  feedbackItems,
  userVotes,
  onVote,
  onRemoveVote,
  onSelectFeedback,
  selectedFeedbackId
}) => {
  const { user } = useAuth();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#6c757d';
      case 'read': return '#17a2b8';
      case 'under_review': return '#ffc107';
      case 'in_progress': return '#007bff';
      case 'completed': return '#28a745';
      case 'on_hold': return '#fd7e14';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return '🐛';
      case 'enhancement': return '✨';
      case 'feature_request': return '🚀';
      case 'improvement': return '📈';
      default: return '💡';
    }
  };

  const handleVoteClick = (feedbackId: number, voteType: 'up' | 'down') => {
    const currentVote = userVotes.get(feedbackId);

    if (currentVote?.vote_type === voteType) {
      // If clicking the same vote type, remove the vote
      onRemoveVote(feedbackId);
    } else {
      // Otherwise, add or change the vote
      onVote(feedbackId, voteType);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="feedback-list">
      {feedbackItems.length === 0 ? (
        <div className="feedback-empty">
          <p>No feedback found. Be the first to submit!</p>
        </div>
      ) : (
        feedbackItems.map((feedback) => {
          const userVote = userVotes.get(feedback.id);
          const isSelected = selectedFeedbackId === feedback.id;

          return (
            <div
              key={feedback.id}
              className={`feedback-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectFeedback(feedback)}
            >
              <div className="feedback-content">
                <div className="feedback-header">
                  <span className="feedback-type-icon">{getTypeIcon(feedback.type)}</span>
                  <h3 className="feedback-title">{feedback.title}</h3>
                  <span
                    className="feedback-status-badge"
                    style={{ backgroundColor: getStatusColor(feedback.status) }}
                  >
                    {feedback.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="feedback-meta">
                  <span className="feedback-module">{feedback.module}</span>
                  <span className="feedback-separator">•</span>
                  <span className="feedback-date">{formatDate(feedback.created_at)}</span>
                  {feedback.comments_count > 0 && (
                    <>
                      <span className="feedback-separator">•</span>
                      <span className="feedback-comments">💬 {feedback.comments_count}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="feedback-vote-section">
                <button
                  className={`vote-btn vote-up ${userVote?.vote_type === 'up' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVoteClick(feedback.id, 'up');
                  }}
                  title="Thumbs up"
                >
                  👍
                  <span className="vote-count">{feedback.upvotes || 0}</span>
                </button>
                <button
                  className={`vote-btn vote-down ${userVote?.vote_type === 'down' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVoteClick(feedback.id, 'down');
                  }}
                  title="Thumbs down"
                >
                  👎
                  <span className="vote-count">{feedback.downvotes || 0}</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default FeedbackList;
