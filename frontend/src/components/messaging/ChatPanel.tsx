import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { dmApi, DmConversation, UserPresence } from '../../services/directMessages';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import NewConversationDialog from './NewConversationDialog';
import GroupInfoDialog from './GroupInfoDialog';
import PresenceDot from './PresenceDot';
import './ChatPanel.css';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ChatPanelProps {
  onClose: () => void;
}

type View = 'list' | 'thread' | 'new' | 'group-info';

const ChatPanel: React.FC<ChatPanelProps> = ({ onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('list');
  const [selectedConversation, setSelectedConversation] = useState<DmConversation | null>(null);

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => dmApi.getConversations().then(r => r.data),
  });

  // Fetch presence
  const { data: presenceData = [] } = useQuery({
    queryKey: ['dm-presence'],
    queryFn: () => dmApi.getPresence().then(r => r.data),
    refetchInterval: 30000,
  });

  // Build presence map
  const presenceMap: Record<number, UserPresence> = {};
  for (const p of presenceData) {
    presenceMap[p.user_id] = p;
  }

  // Listen for real-time presence updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlePresence = (data: { userId: number; status: 'online' | 'away' | 'offline' }) => {
      queryClient.invalidateQueries({ queryKey: ['dm-presence'] });
    };

    const handleReceive = () => {
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
    };

    socket.on('presence:update', handlePresence);
    socket.on('dm:receive', handleReceive);

    return () => {
      socket.off('presence:update', handlePresence);
      socket.off('dm:receive', handleReceive);
    };
  }, [queryClient]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Check if clicked on the chat button itself
        const target = e.target as HTMLElement;
        if (target.closest('.chat-button-btn')) return;
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSelectConversation = useCallback((conv: DmConversation) => {
    setSelectedConversation(conv);
    setView('thread');
  }, []);

  const handleStartDm = useCallback(async (recipientId: number) => {
    try {
      const res = await dmApi.findOrCreateDm(recipientId);
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      setSelectedConversation(res.data);
      setView('thread');
    } catch (err) {
      console.error('[ChatPanel] Start DM failed:', err);
    }
  }, [queryClient]);

  const handleCreateGroup = useCallback(async (name: string, memberIds: number[]) => {
    try {
      const res = await dmApi.createGroup(name, memberIds);
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      setSelectedConversation(res.data);
      setView('thread');
    } catch (err) {
      console.error('[ChatPanel] Create group failed:', err);
    }
  }, [queryClient]);

  const handleUpdateGroupName = useCallback(async (name: string) => {
    if (!selectedConversation) return;
    try {
      await dmApi.updateGroupName(selectedConversation.id, name);
      queryClient.invalidateQueries({ queryKey: ['dm-conversations'] });
      setSelectedConversation(prev => prev ? { ...prev, group_name: name } : null);
    } catch (err) {
      console.error('[ChatPanel] Update group name failed:', err);
    }
  }, [selectedConversation, queryClient]);

  function getConversationTitle(conv: DmConversation): string {
    if (conv.is_group && conv.group_name) return conv.group_name;
    const other = conv.participants.find(p => p.id !== user?.id);
    return other ? `${other.first_name} ${other.last_name}` : 'Conversation';
  }

  function getOtherPresence(conv: DmConversation): UserPresence | null {
    if (conv.is_group) return null;
    const other = conv.participants.find(p => p.id !== user?.id);
    return other ? presenceMap[other.id] || null : null;
  }

  return (
    <div className="chat-panel" ref={panelRef}>
      {/* Header */}
      <div className="chat-panel-header">
        {view === 'thread' && selectedConversation ? (
          <>
            <button className="chat-panel-back" onClick={() => setView('list')}>
              <ArrowBackIcon fontSize="small" />
            </button>
            <div className="chat-panel-title-section">
              <span className="chat-panel-title">{getConversationTitle(selectedConversation)}</span>
              {!selectedConversation.is_group && getOtherPresence(selectedConversation) && (
                <span className="chat-panel-status">
                  <PresenceDot status={getOtherPresence(selectedConversation)!.status} size={8} />
                  <span className="chat-panel-status-text">
                    {getOtherPresence(selectedConversation)!.status === 'online' ? 'Online'
                      : getOtherPresence(selectedConversation)!.status === 'away' ? 'Away'
                      : getOtherPresence(selectedConversation)!.last_seen_at
                        ? `Active ${timeAgo(getOtherPresence(selectedConversation)!.last_seen_at!)}`
                        : 'Offline'}
                  </span>
                </span>
              )}
              {selectedConversation.is_group && (
                <span className="chat-panel-member-count">
                  {selectedConversation.participants.length} members
                </span>
              )}
            </div>
            {selectedConversation.is_group && (
              <button className="chat-panel-info" onClick={() => setView('group-info')}>
                <InfoOutlinedIcon fontSize="small" />
              </button>
            )}
          </>
        ) : view === 'new' ? (
          <>
            <button className="chat-panel-back" onClick={() => setView('list')}>
              <ArrowBackIcon fontSize="small" />
            </button>
            <span className="chat-panel-title">New Conversation</span>
          </>
        ) : view === 'group-info' ? (
          <>
            <button className="chat-panel-back" onClick={() => setView('thread')}>
              <ArrowBackIcon fontSize="small" />
            </button>
            <span className="chat-panel-title">Group Info</span>
          </>
        ) : (
          <>
            <span className="chat-panel-title">Messages</span>
            <button className="chat-panel-new" onClick={() => setView('new')} title="New conversation">
              <AddIcon fontSize="small" />
            </button>
          </>
        )}
      </div>

      {/* Body */}
      <div className="chat-panel-body">
        {view === 'list' && (
          <ConversationList
            conversations={conversations}
            presenceMap={presenceMap}
            selectedId={null}
            onSelect={handleSelectConversation}
          />
        )}

        {view === 'thread' && selectedConversation && (
          <MessageThread conversationId={selectedConversation.id} />
        )}

        {view === 'new' && (
          <NewConversationDialog
            presenceMap={presenceMap}
            onStartDm={handleStartDm}
            onCreateGroup={handleCreateGroup}
            onClose={() => setView('list')}
          />
        )}

        {view === 'group-info' && selectedConversation && (
          <GroupInfoDialog
            conversation={selectedConversation}
            presenceMap={presenceMap}
            onUpdateName={handleUpdateGroupName}
            onClose={() => setView('thread')}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
