import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Feedback, FeedbackComment } from '../../services/feedback';
import { attachmentsApi } from '../../services/attachments';
import { useAuth } from '../../context/AuthContext';
import './FeedbackDetail.css';

interface FeedbackDetailProps {
  feedback: Feedback;
  comments: FeedbackComment[];
  onAddComment: (comment: string) => Promise<void>;
  onUpdateComment?: (commentId: number, comment: string) => Promise<void>;
  onDeleteComment?: (commentId: number) => Promise<void>;
  onUpdateStatus?: (status: string) => Promise<void>;
  onClose: () => void;
}

const FeedbackDetail: React.FC<FeedbackDetailProps> = ({
  feedback,
  comments,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onUpdateStatus,
  onClose
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', 'feedback', feedback.id],
    queryFn: async () => {
      const res = await attachmentsApi.getByEntity('feedback', feedback.id);
      return res.data;
    },
    enabled: !!feedback.id,
  });

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

  const toUtcDate = (s: string) => new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z');

  const formatDate = (dateString: string) => {
    return toUtcDate(dateString).toLocaleString();
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && commentFiles.length === 0) return;

    setIsSubmitting(true);
    try {
      if (newComment.trim()) {
        await onAddComment(newComment);
        setNewComment('');
      }
      if (commentFiles.length > 0) {
        for (const file of commentFiles) {
          await attachmentsApi.upload('feedback', feedback.id, file);
        }
        queryClient.invalidateQueries({ queryKey: ['attachments', 'feedback', feedback.id] });
        setCommentFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setCommentFiles(Array.from(e.target.files));
    }
  };

  const removeSelectedFile = (index: number) => {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartEdit = (comment: FeedbackComment) => {
    setEditingCommentId(comment.id);
    setEditingText(comment.comment);
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!onUpdateComment || !editingText.trim()) return;
    try {
      await onUpdateComment(commentId, editingText);
      setEditingCommentId(null);
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!onDeleteComment) return;
    if (!window.confirm('Delete this comment?')) return;
    try {
      await onDeleteComment(commentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onUpdateStatus) {
      await onUpdateStatus(e.target.value);
    }
  };

  const isAdmin = user?.role === 'admin';

  const canEditComment = (comment: FeedbackComment) => comment.user_id === user?.id;
  const canDeleteComment = (comment: FeedbackComment) => comment.user_id === user?.id || isAdmin;

  const canSubmitComment = newComment.trim().length > 0 || commentFiles.length > 0;

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

        {attachments.length > 0 && (
          <div className="feedback-detail-attachments">
            <h3>Attachments ({attachments.length})</h3>
            <ul className="feedback-attachment-list">
              {attachments.map(att => (
                <li key={att.id} className="feedback-attachment-item">
                  <a href={att.url} target="_blank" rel="noopener noreferrer">
                    {att.original_name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

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
            <div className="comment-form-footer">
              <label className="comment-attach-btn">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  disabled={isSubmitting}
                />
                <span>📎 Attach file</span>
              </label>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSubmitting || !canSubmitComment}
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
            {commentFiles.length > 0 && (
              <ul className="comment-file-list">
                {commentFiles.map((f, i) => (
                  <li key={i} className="comment-file-item">
                    <span>{f.name}</span>
                    <button type="button" className="comment-file-remove" onClick={() => removeSelectedFile(i)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <div className="comments-list">
            {comments.length === 0 ? (
              <p className="no-comments">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="comment">
                  <div className="comment-header">
                    <span className="comment-author">{comment.commenter_name}</span>
                    <div className="comment-header-right">
                      <span className="comment-date">{formatDate(comment.created_at)}</span>
                      {canEditComment(comment) && onUpdateComment && (
                        <button
                          className="comment-action-btn"
                          onClick={() => handleStartEdit(comment)}
                          title="Edit comment"
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteComment(comment) && onDeleteComment && (
                        <button
                          className="comment-action-btn comment-action-delete"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete comment"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="comment-edit-form">
                      <textarea
                        className="form-control"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="comment-edit-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={!editingText.trim()}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="comment-text">{comment.comment}</p>
                  )}
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
