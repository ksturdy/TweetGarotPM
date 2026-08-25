import React, { useState, useMemo } from 'react';
import { Feedback, FeedbackVote } from '../../services/feedback';
import { useAuth } from '../../context/AuthContext';
import './FeedbackList.css';

type SortCol = 'id' | 'created_at' | 'title' | 'submitter_name' | 'status' | 'module' | 'upvotes';
type SortDir = 'asc' | 'desc';

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
  const [sortCol, setSortCol] = useState<SortCol>('id');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    return [...feedbackItems].sort((a, b) => {
      let av: any = (a as any)[sortCol] ?? '';
      let bv: any = (b as any)[sortCol] ?? '';
      if (sortCol === 'upvotes') { av = Number(av); bv = Number(bv); }
      else if (sortCol === 'id') { av = Number(av); bv = Number(bv); }
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [feedbackItems, sortCol, sortDir]);

  const SortTh: React.FC<{ col: SortCol; children: React.ReactNode; className?: string }> = ({ col, children, className }) => (
    <th className={className} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span className="th-inner">
        {children}
        <span className={`sort-indicator ${sortCol === col ? 'active' : ''}`}>
          {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </span>
    </th>
  );

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
      onRemoveVote(feedbackId);
    } else {
      onVote(feedbackId, voteType);
    }
  };

  const toUtcDate = (s: string) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z');

  const formatDate = (dateString: string) => {
    const date = toUtcDate(dateString);
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
        <table className="feedback-table">
          <thead>
            <tr>
              <SortTh col="id">#</SortTh>
              <SortTh col="created_at">Date</SortTh>
              <SortTh col="title">Title</SortTh>
              <SortTh col="submitter_name">Submitted By</SortTh>
              <SortTh col="status">Status</SortTh>
              <SortTh col="module">Module</SortTh>
              <SortTh col="upvotes">Votes</SortTh>
            </tr>
          </thead>
          <tbody>
            {sorted.map((feedback) => {
              const userVote = userVotes.get(feedback.id);
              const isSelected = selectedFeedbackId === feedback.id;

              return (
                <tr
                  key={feedback.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onSelectFeedback(feedback)}
                >
                  <td className="col-number">#{feedback.id}</td>
                  <td className="col-date">{formatDate(feedback.created_at)}</td>
                  <td className="col-title">
                    <div className="title-inner">
                      <span className="feedback-type-icon">{getTypeIcon(feedback.type)}</span>
                      <span className="feedback-title">{feedback.title}</span>
                      {feedback.comments_count > 0 && (
                        <span className="feedback-comments">💬 {feedback.comments_count}</span>
                      )}
                    </div>
                  </td>
                  <td className="col-submitter">{(feedback as any).submitter_name || '—'}</td>
                  <td className="col-status">
                    <span
                      className="feedback-status-badge"
                      style={{ backgroundColor: getStatusColor(feedback.status) }}
                    >
                      {feedback.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="col-module">
                    <span className="feedback-module">{feedback.module}</span>
                  </td>
                  <td className="col-votes">
                    <button
                      className={`vote-btn vote-up ${userVote?.vote_type === 'up' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoteClick(feedback.id, 'up');
                      }}
                      title="Thumbs up"
                    >
                      👍 <span className="vote-count">{feedback.upvotes || 0}</span>
                    </button>
                    <button
                      className={`vote-btn vote-down ${userVote?.vote_type === 'down' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoteClick(feedback.id, 'down');
                      }}
                      title="Thumbs down"
                    >
                      👎 <span className="vote-count">{feedback.downvotes || 0}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FeedbackList;
