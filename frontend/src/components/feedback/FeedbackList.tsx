import React, { useState, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Feedback, FeedbackVote, FeedbackVoters, feedbackService } from '../../services/feedback';
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

interface VoterPopupState {
  feedbackId: number;
  type: 'up' | 'down';
  voters: { id: number; name: string }[];
  loading: boolean;
  x: number;
  y: number;
}

const VoterPopup: React.FC<{ popup: VoterPopupState }> = ({ popup }) => {
  const { voters, loading, type, x, y } = popup;

  return ReactDOM.createPortal(
    <div
      className="voter-popup"
      style={{ position: 'fixed', left: x, top: y }}
    >
      <div className="voter-popup-arrow" />
      <div className="voter-popup-header">
        <span className="voter-popup-icon">{type === 'up' ? '👍' : '👎'}</span>
        <span>{type === 'up' ? 'Liked by' : 'Disliked by'}</span>
      </div>
      <div className="voter-popup-body">
        {loading ? (
          <div className="voter-popup-empty">Loading…</div>
        ) : voters.length === 0 ? (
          <div className="voter-popup-empty">No votes yet</div>
        ) : (
          voters.map(v => (
            <div key={v.id} className="voter-popup-item">{v.name}</div>
          ))
        )}
      </div>
    </div>,
    document.body
  );
};

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
  const [voterPopup, setVoterPopup] = useState<VoterPopupState | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voterCacheRef = useRef<Map<number, FeedbackVoters>>(new Map());

  const handleVoteMouseEnter = (feedbackId: number, type: 'up' | 'down', e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 8;
    hoverTimerRef.current = setTimeout(async () => {
      setVoterPopup({ feedbackId, type, voters: [], loading: true, x, y });
      try {
        let data = voterCacheRef.current.get(feedbackId);
        if (!data) {
          data = await feedbackService.getVoters(feedbackId);
          voterCacheRef.current.set(feedbackId, data);
        }
        setVoterPopup({ feedbackId, type, voters: type === 'up' ? data.up : data.down, loading: false, x, y });
      } catch {
        setVoterPopup(null);
      }
    }, 250);
  };

  const handleVoteMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setVoterPopup(null);
  };

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
      case 'in_testing': return '#8b5cf6';
      case 'completed': return '#28a745';
      case 'on_hold': return '#fd7e14';
      case 'rejected': return '#dc3545';
      case 'future_enhancement': return '#3f51b5';
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
    voterCacheRef.current.delete(feedbackId);
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
      {voterPopup && <VoterPopup popup={voterPopup} />}
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
                    <div className="vote-wrap">
                      <div
                        className="vote-btn-wrap"
                        onMouseEnter={(e) => handleVoteMouseEnter(feedback.id, 'up', e)}
                        onMouseLeave={handleVoteMouseLeave}
                      >
                        <button
                          className={`vote-btn vote-up ${userVote?.vote_type === 'up' ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleVoteClick(feedback.id, 'up'); }}
                        >
                          👍 <span className="vote-count">{feedback.upvotes || 0}</span>
                        </button>
                      </div>
                      <div
                        className="vote-btn-wrap"
                        onMouseEnter={(e) => handleVoteMouseEnter(feedback.id, 'down', e)}
                        onMouseLeave={handleVoteMouseLeave}
                      >
                        <button
                          className={`vote-btn vote-down ${userVote?.vote_type === 'down' ? 'active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleVoteClick(feedback.id, 'down'); }}
                        >
                          👎 <span className="vote-count">{feedback.downvotes || 0}</span>
                        </button>
                      </div>
                    </div>
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
