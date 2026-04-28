import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { OpportunityComment } from '../../services/opportunities';
import { useAuth } from '../../context/AuthContext';
import MentionTextarea from './MentionTextarea';
import MentionText from './MentionText';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface CommentThreadProps {
  opportunityId: number;
  employees?: Array<{ id: number; first_name: string; last_name: string; job_title?: string | null }>;
}

function extractMentionIds(text: string): number[] {
  const regex = /@\[([^\]]+)\]\((\d+)\)/g;
  const ids: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    ids.push(parseInt(match[2], 10));
  }
  return ids;
}

const CommentThread: React.FC<CommentThreadProps> = ({ opportunityId, employees = [] }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['opportunities', opportunityId, 'comments'],
    queryFn: () => opportunitiesService.getComments(opportunityId),
    staleTime: 30000,
  });

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments.length]);

  const addMutation = useMutation({
    mutationFn: ({ comment, mentionedUserIds }: { comment: string; mentionedUserIds: number[] }) =>
      opportunitiesService.addComment(opportunityId, comment, true, mentionedUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', opportunityId, 'comments'] });
      // Auto-follow is handled server-side; refresh follow status
      queryClient.invalidateQueries({ queryKey: ['opportunities', opportunityId, 'follow'] });
      setNewComment('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ commentId, comment }: { commentId: number; comment: string }) =>
      opportunitiesService.updateComment(opportunityId, commentId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', opportunityId, 'comments'] });
      setEditingId(null);
      setEditText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) =>
      opportunitiesService.deleteComment(opportunityId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', opportunityId, 'comments'] });
    },
  });

  const handlePost = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    const mentionedUserIds = extractMentionIds(trimmed);
    addMutation.mutate({ comment: trimmed, mentionedUserIds });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  };

  const startEdit = (comment: OpportunityComment) => {
    setEditingId(comment.id);
    setEditText(comment.comment);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editText.trim()) return;
    updateMutation.mutate({ commentId: editingId, comment: editText.trim() });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="comment-thread">
      <div className="comment-thread-header">
        <span className="comment-thread-title">Comments</span>
        {comments.length > 0 && (
          <span className="comment-count-badge">{comments.length}</span>
        )}
      </div>

      <div className="comment-list" ref={listRef}>
        {isLoading ? (
          <div className="comment-empty">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="comment-empty">No comments yet</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-avatar">
                {getInitials(comment.commenter_name)}
              </div>
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-author">{comment.commenter_name}</span>
                  <span className="comment-time">{formatRelativeTime(comment.created_at)}</span>
                  {user?.id === comment.user_id && editingId !== comment.id && (
                    <div className="comment-actions">
                      <button onClick={() => startEdit(comment)} title="Edit">
                        <EditIcon style={{ fontSize: 14 }} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        title="Delete"
                      >
                        <DeleteIcon style={{ fontSize: 14 }} />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="comment-edit-area">
                    <MentionTextarea
                      value={editText}
                      onChange={setEditText}
                      employees={employees}
                      rows={2}
                      autoFocus
                    />
                    <div className="comment-edit-actions">
                      <button className="btn-sm-secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn-sm-primary"
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <MentionText text={comment.comment} className="comment-text" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="comment-input-area">
        <MentionTextarea
          value={newComment}
          onChange={setNewComment}
          onKeyDown={handleKeyDown}
          employees={employees}
          placeholder="Add a comment... Use @ to mention someone"
          rows={2}
        />
        <div className="comment-input-footer">
          <span className="comment-hint">Enter to post, Shift+Enter for new line</span>
          <button
            className="btn-sm-primary"
            onClick={handlePost}
            disabled={!newComment.trim() || addMutation.isPending}
          >
            {addMutation.isPending ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentThread;
