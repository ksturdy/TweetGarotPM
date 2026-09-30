import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { itemCommentsApi } from '../../services/itemComments';
import { employeesApi } from '../../services/employees';
import MentionTextarea from '../opportunities/MentionTextarea';
import MentionText from '../opportunities/MentionText';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

interface ItemCommentFlyoutProps {
  projectId: number;
  entityType: string;
  entityKey: string;
  link: string;
  title: string;
  rowLabel: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onCountChange?: (key: string, count: number) => void;
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

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const ItemCommentFlyout: React.FC<ItemCommentFlyoutProps> = ({
  projectId,
  entityType,
  entityKey,
  link,
  title,
  rowLabel,
  anchorEl,
  onClose,
  onCountChange,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, arrowTop: 0, openLeft: false });

  const queryKey = ['item-comments', projectId, entityType, entityKey];

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      itemCommentsApi.getByEntityKey(projectId, entityType, entityKey).then(r => r.data),
    staleTime: 15000,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'assignable'],
    queryFn: () => employeesApi.getAssignable().then(r => (r.data as any)?.data ?? []),
    staleTime: 300000,
  });
  const employees = employeesData ?? [];

  const addMutation = useMutation({
    mutationFn: (payload: { comment: string; mentioned_user_ids: number[] }) =>
      itemCommentsApi.create(projectId, {
        entity_type: entityType,
        entity_key: entityKey,
        comment: payload.comment,
        link,
        mentioned_user_ids: payload.mentioned_user_ids,
        row_label: rowLabel,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['item-comment-counts', projectId, entityType] });
      onCountChange?.(entityKey, comments.length + 1);
      setNewComment('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => itemCommentsApi.delete(projectId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['item-comment-counts', projectId, entityType] });
      onCountChange?.(entityKey, Math.max(0, comments.length - 1));
    },
  });

  const handlePost = () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    addMutation.mutate({ comment: trimmed, mentioned_user_ids: extractMentionIds(trimmed) });
  };

  // Position the flyout relative to the anchor element
  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const flyoutWidth = 360;
    const flyoutHeight = 420;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.top;
    let left = rect.right + gap;
    let openLeft = false;

    if (left + flyoutWidth > viewportWidth - 8) {
      left = rect.left - flyoutWidth - gap;
      openLeft = true;
    }
    if (top + flyoutHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - flyoutHeight - 8);
    }

    const arrowTop = rect.top + rect.height / 2 - top;
    setPos({ top, left, arrowTop, openLeft });
  }, [anchorEl]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        flyoutRef.current &&
        !flyoutRef.current.contains(e.target as Node) &&
        anchorEl &&
        !anchorEl.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [anchorEl, onClose]);

  if (!anchorEl) return null;

  const flyout = (
    <div
      ref={flyoutRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: 360,
        zIndex: 9500,
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
        border: '1.5px solid #e65c00',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 480,
        overflow: 'hidden',
      }}
    >
      {/* Arrow notch */}
      {!pos.openLeft ? (
        <div style={{
          position: 'absolute',
          left: -9,
          top: Math.max(12, pos.arrowTop - 8),
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderRight: '9px solid #e65c00',
        }} />
      ) : (
        <div style={{
          position: 'absolute',
          right: -9,
          top: Math.max(12, pos.arrowTop - 8),
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          borderLeft: '9px solid #e65c00',
        }} />
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e2a4a 0%, #2d3f6e 100%)',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '8px 8px 0 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Comments</span>
          <span style={{
            background: '#e65c00',
            color: '#fff',
            borderRadius: 10,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 700,
          }}>
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Close"
        >
          <CloseIcon style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Comment list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {isLoading ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Loading...
          </div>
        ) : comments.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No comments yet. Be the first to add one.
          </div>
        ) : (
          comments.map(comment => (
            <div
              key={comment.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 14px',
                borderLeft: '3px solid #e65c00',
                marginBottom: 6,
                marginLeft: 8,
                marginRight: 8,
                borderRadius: '0 6px 6px 0',
                background: '#f8fafc',
              }}
            >
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e2a4a, #2d3f6e)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {getInitials(comment.commenter_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                    {comment.commenter_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {formatRelativeTime(comment.created_at)}
                    </span>
                    {user?.id === comment.user_id && (
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                        title="Delete comment"
                      >
                        <DeleteIcon style={{ fontSize: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
                <MentionText text={comment.comment} className="" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid #e2e8f0',
        padding: '10px 12px',
        background: '#f8fafc',
        borderRadius: '0 0 8px 8px',
        flexShrink: 0,
      }}>
        <MentionTextarea
          value={newComment}
          onChange={setNewComment}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handlePost();
            }
          }}
          employees={employees}
          placeholder="Add a comment… @ to mention someone"
          rows={2}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Enter to post · Shift+Enter for new line</span>
          <button
            onClick={handlePost}
            disabled={!newComment.trim() || addMutation.isPending}
            style={{
              background: newComment.trim() ? '#e65c00' : '#cbd5e1',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: newComment.trim() ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {addMutation.isPending ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(flyout, document.body);
};

export default ItemCommentFlyout;
