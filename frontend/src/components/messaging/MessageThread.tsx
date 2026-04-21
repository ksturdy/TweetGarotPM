import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dmApi, DmMessage } from '../../services/directMessages';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import MessageInput from './MessageInput';

interface MessageThreadProps {
  conversationId: number;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function shouldShowDateSeparator(current: DmMessage, prev: DmMessage | null): boolean {
  if (!prev) return true;
  const d1 = new Date(current.created_at).toDateString();
  const d2 = new Date(prev.created_at).toDateString();
  return d1 !== d2;
}

const MessageThread: React.FC<MessageThreadProps> = ({ conversationId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [realtimeMessages, setRealtimeMessages] = useState<DmMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  // Fetch initial messages
  const { data: initialMessages, isLoading } = useQuery({
    queryKey: ['dm-messages', conversationId],
    queryFn: () => dmApi.getMessages(conversationId, { limit: 50 }).then(r => r.data),
  });

  // Mark as read when conversation opens
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.emit('dm:read', { conversationId });
      socket.emit('dm:join', { conversationId });
    }
    queryClient.invalidateQueries({ queryKey: ['dm-unread-count'] });

    return () => {
      if (socket) {
        socket.emit('dm:leave', { conversationId });
      }
    };
  }, [conversationId, queryClient]);

  // Listen for real-time messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReceive = (data: { conversationId: number; message: DmMessage }) => {
      if (data.conversationId === conversationId) {
        setRealtimeMessages(prev => [...prev, data.message]);
        // Mark as read immediately since we're viewing this conversation
        socket.emit('dm:read', { conversationId });
        queryClient.invalidateQueries({ queryKey: ['dm-unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      }
    };

    const handleTyping = (data: { conversationId: number; userId: number; isTyping: boolean }) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          if (data.isTyping) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
      }
    };

    socket.on('dm:receive', handleReceive);
    socket.on('dm:typing', handleTyping);

    return () => {
      socket.off('dm:receive', handleReceive);
      socket.off('dm:typing', handleTyping);
    };
  }, [conversationId, user?.id, queryClient]);

  // Reset realtime messages when conversation changes
  useEffect(() => {
    setRealtimeMessages([]);
    setTypingUsers(new Set());
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [initialMessages, realtimeMessages]);

  const allMessages = [...(initialMessages || [])];
  // Add realtime messages, avoiding duplicates
  for (const rm of realtimeMessages) {
    if (!allMessages.find(m => m.id === rm.id)) {
      allMessages.push(rm);
    }
  }

  if (isLoading) {
    return <div className="message-thread-loading">Loading messages...</div>;
  }

  return (
    <div className="message-thread">
      <div className="message-thread-messages" ref={listRef}>
        {allMessages.length === 0 && (
          <div className="message-thread-empty">
            No messages yet. Say hello!
          </div>
        )}
        {allMessages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const prev = i > 0 ? allMessages[i - 1] : null;
          const showDate = shouldShowDateSeparator(msg, prev);

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="message-date-separator">
                  <span>{formatDateSeparator(msg.created_at)}</span>
                </div>
              )}
              <div className={`message-bubble-row ${isMe ? 'outgoing' : 'incoming'}`}>
                <div className={`message-bubble ${isMe ? 'outgoing' : 'incoming'}`}>
                  {!isMe && (
                    <div className="message-sender-name">
                      {msg.sender_first_name} {msg.sender_last_name}
                    </div>
                  )}
                  <div className="message-body">{msg.body}</div>
                  <div className="message-time">{formatTime(msg.created_at)}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="message-typing-indicator">
            <span className="typing-dots">
              <span /><span /><span />
            </span>
            Someone is typing...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <MessageInput conversationId={conversationId} />
    </div>
  );
};

export default MessageThread;
