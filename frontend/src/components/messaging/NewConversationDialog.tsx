import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonIcon from '@mui/icons-material/Person';
import api from '../../services/api';
import { UserPresence } from '../../services/directMessages';
import { useAuth } from '../../context/AuthContext';
import PresenceDot from './PresenceDot';

interface NewConversationDialogProps {
  presenceMap: Record<number, UserPresence>;
  onStartDm: (userId: number) => void;
  onCreateGroup: (name: string, memberIds: number[]) => void;
  onClose: () => void;
}

interface UserItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
}

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

const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  presenceMap, onStartDm, onCreateGroup, onClose,
}) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users-for-chat'],
    queryFn: () => api.get<UserItem[]>('/users').then(r => r.data),
  });

  const filteredUsers = (users || []).filter(u => {
    if (u.id === user?.id) return false;
    if (!u.is_active) return false;
    if (!search) return true;
    const name = `${u.first_name} ${u.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
  });

  const handleUserClick = (userId: number) => {
    if (mode === 'dm') {
      onStartDm(userId);
    } else {
      setSelectedUsers(prev =>
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleCreateGroup = () => {
    if (groupName.trim() && selectedUsers.length > 0) {
      onCreateGroup(groupName.trim(), selectedUsers);
    }
  };

  return (
    <div className="new-conversation-dialog">
      <div className="new-conversation-header">
        <h3>{mode === 'dm' ? 'New Message' : 'New Group'}</h3>
        <button className="new-conversation-close" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </button>
      </div>

      <div className="new-conversation-mode-toggle">
        <button
          className={`mode-btn ${mode === 'dm' ? 'active' : ''}`}
          onClick={() => { setMode('dm'); setSelectedUsers([]); }}
        >
          <PersonIcon fontSize="small" /> Direct Message
        </button>
        <button
          className={`mode-btn ${mode === 'group' ? 'active' : ''}`}
          onClick={() => setMode('group')}
        >
          <GroupAddIcon fontSize="small" /> Group Chat
        </button>
      </div>

      {mode === 'group' && (
        <div className="new-conversation-group-name">
          <input
            type="text"
            placeholder="Group name..."
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="group-name-input"
          />
          {selectedUsers.length > 0 && (
            <div className="selected-count">
              {selectedUsers.length} selected
            </div>
          )}
        </div>
      )}

      <div className="new-conversation-search">
        <SearchIcon fontSize="small" style={{ color: '#9ca3af' }} />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="new-conversation-user-list">
        {filteredUsers.map(u => {
          const presence = presenceMap[u.id];
          const isSelected = selectedUsers.includes(u.id);
          return (
            <button
              key={u.id}
              className={`new-conversation-user ${isSelected ? 'selected' : ''}`}
              onClick={() => handleUserClick(u.id)}
            >
              <div className="new-conversation-user-avatar">
                {u.first_name[0]}{u.last_name[0]}
              </div>
              <div className="new-conversation-user-info">
                <span className="new-conversation-user-name">
                  {u.first_name} {u.last_name}
                </span>
                <span className="new-conversation-user-status">
                  {presence?.status === 'online' ? 'Online'
                    : presence?.status === 'away' ? 'Away'
                    : presence?.last_seen_at ? `Active ${timeAgo(presence.last_seen_at)}`
                    : u.last_login_at ? `Active ${timeAgo(u.last_login_at)}`
                    : 'Never logged in'}
                </span>
              </div>
              {presence && <PresenceDot status={presence.status} size={8} />}
              {mode === 'group' && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="new-conversation-checkbox"
                />
              )}
            </button>
          );
        })}
        {filteredUsers.length === 0 && (
          <div className="new-conversation-empty">No users found</div>
        )}
      </div>

      {mode === 'group' && (
        <div className="new-conversation-footer">
          <button
            className="create-group-btn"
            disabled={!groupName.trim() || selectedUsers.length === 0}
            onClick={handleCreateGroup}
          >
            Create Group ({selectedUsers.length} members)
          </button>
        </div>
      )}
    </div>
  );
};

export default NewConversationDialog;
