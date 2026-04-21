import React from 'react';
import GroupsIcon from '@mui/icons-material/Groups';
import { DmConversation, UserPresence } from '../../services/directMessages';
import { useAuth } from '../../context/AuthContext';
import PresenceDot from './PresenceDot';

interface ConversationListProps {
  conversations: DmConversation[];
  presenceMap: Record<number, UserPresence>;
  selectedId: number | null;
  onSelect: (conv: DmConversation) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations, presenceMap, selectedId, onSelect,
}) => {
  const { user } = useAuth();

  function getDisplayName(conv: DmConversation): string {
    if (conv.is_group && conv.group_name) return conv.group_name;
    const other = conv.participants.find(p => p.id !== user?.id);
    return other ? `${other.first_name} ${other.last_name}` : 'Unknown';
  }

  function getOtherUserId(conv: DmConversation): number | null {
    if (conv.is_group) return null;
    const other = conv.participants.find(p => p.id !== user?.id);
    return other?.id ?? null;
  }

  if (conversations.length === 0) {
    return (
      <div className="chat-empty-state">
        <p>No conversations yet</p>
        <p className="chat-empty-hint">Start a new message to begin chatting</p>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conv) => {
        const otherId = getOtherUserId(conv);
        const presence = otherId ? presenceMap[otherId] : null;
        const unread = Number(conv.unread_count) || 0;

        return (
          <button
            key={conv.id}
            className={`conversation-item ${selectedId === conv.id ? 'selected' : ''} ${unread > 0 ? 'unread' : ''}`}
            onClick={() => onSelect(conv)}
          >
            <div className="conversation-avatar">
              {conv.is_group ? (
                <GroupsIcon fontSize="small" style={{ color: '#6b7280' }} />
              ) : (
                <div className="conversation-avatar-initials">
                  {getDisplayName(conv).split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
              {!conv.is_group && presence && (
                <span className="conversation-presence">
                  <PresenceDot status={presence.status} size={10} />
                </span>
              )}
            </div>
            <div className="conversation-info">
              <div className="conversation-name-row">
                <span className="conversation-name">{getDisplayName(conv)}</span>
                {conv.last_message_at && (
                  <span className="conversation-time">{timeAgo(conv.last_message_at)}</span>
                )}
              </div>
              <div className="conversation-preview-row">
                <span className="conversation-preview">
                  {conv.last_message_body
                    ? (conv.last_message_body.length > 40
                        ? conv.last_message_body.slice(0, 40) + '...'
                        : conv.last_message_body)
                    : !conv.is_group && presence
                      ? (presence.status === 'online' ? 'Online'
                        : presence.status === 'away' ? 'Away'
                        : presence.last_seen_at ? `Active ${timeAgo(presence.last_seen_at)}`
                        : 'No messages yet')
                      : 'No messages yet'}
                </span>
                {unread > 0 && (
                  <span className="conversation-unread-badge">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ConversationList;
