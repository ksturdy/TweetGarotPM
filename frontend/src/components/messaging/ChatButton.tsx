import React, { useEffect } from 'react';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ChatIcon from '@mui/icons-material/Chat';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dmApi } from '../../services/directMessages';
import { getSocket } from '../../services/socket';
import './ChatButton.css';

interface ChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const ChatButton: React.FC<ChatButtonProps> = ({ onClick, isOpen }) => {
  const queryClient = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['dm-unread-count'],
    queryFn: () => dmApi.getUnreadCount().then(r => r.data),
    refetchInterval: 30000,
  });

  // Listen for real-time messages to bump unread count
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReceive = () => {
      queryClient.invalidateQueries({ queryKey: ['dm-unread-count'] });
    };

    socket.on('dm:receive', handleReceive);
    return () => { socket.off('dm:receive', handleReceive); };
  }, [queryClient]);

  const unreadCount = countData?.count ?? 0;

  return (
    <button
      className={`chat-button-btn ${isOpen ? 'active' : ''}`}
      onClick={onClick}
      title="Messages"
    >
      {unreadCount > 0 ? (
        <ChatIcon fontSize="small" />
      ) : (
        <ChatBubbleOutlineIcon fontSize="small" />
      )}
      {unreadCount > 0 && (
        <span className="chat-button-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default ChatButton;
