import React, { useState, useEffect } from 'react';
import { Feedback, FeedbackComment } from '../../services/feedback';
import { useAuth } from '../../context/AuthContext';
import './FeedbackDetail.css';

interface FeedbackDetailProps {
  feedback: Feedback;
  comments: FeedbackComment[];
  onAddComment: (comment: string) => Promise<void>;
  onUpdateStatus?: (status: string) => Promise<void>;
  onClose: () => void;
}

const FeedbackDetail: React.FC<FeedbackDetailProps> = ({
  feedback,
  comments,
  onAddComment,
  onUpdateStatus,
  onClose
}) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(newComment);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onUpdateStatus) {
      await onUpdateStatus(e.target.value);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="feedback-detail">
      <div className="feedback-detail-header">
        <button className="close-btn" onClick={onClose}>✕</button>
        <div className="feedback-detail-title-row">
          <span className="feedback-detail-type-icon">{getTypeIcon(feedback.type)}</span>
          <h2>{feedback.title}</h2>
        </div>
        <div className="feedback-detail-meta">
          <span
            className="feedback-detail-status"
            style={{ backgroundColor: getStatusColor(feedback.status) }}
          >
            {feedback.status.replace('_', ' ')}
          </span>
          <span className="feedback-detail-priority priority-{feedback.priority}">
            {feedback.priority}
          </span>
        </div>
      </div>

      <div className="feedback-detail-body">
        <div className="feedback-detail-info">
          <div className="info-row">
            <span className="info-label">Module:</span>
            <span className="info-value">
              {feedback.module}
              {feedback.submodule && ` → ${feedback.submodule}`}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Submitted by:</span>
            <span className="info-value">{feedback.submitter_name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Created:</span>
            <span className="info-value">{formatDate(feedback.created_at)}</span>
          </div>
          {feedback.completed_at && (
            <div className="info-row">
              <span className="info-label">Completed:</span>
              <span className="info-value">{formatDate(feedback.completed_at)}</span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Votes:</span>
            <span className="info-value">{feedback.votes_count}</span>
          </div>
        </div>

        {isAdmin && onUpdateStatus && (
          <div className="admin-controls">
            <label htmlFor="status-select">Update Status:</label>
            <select
              id="status-select"
              value={feedback.status}
              onChange={handleStatusChange}
              className="form-control"
            >
              <option value="submitted">Submitted</option>
              <option value="read">Read</option>
              <option value="under_review">Under Review</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        )}

        <div className="feedback-detail-description">
          <h3>Description</h3>
          <p>{feedback.description}</p>
        </div>

        <div className="feedback-detail-comments">
          <h3>Comments ({comments.length})</h3>

          <form onSubmit={handleSubmitComment} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="form-control"
              rows={3}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting || !newComment.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>

          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="comment">
                  <div className="comment-header">
                    <span className="comment-author">{comment.commenter_name}</span>
                    <span className="comment-date">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="comment-text">{comment.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDetail;
