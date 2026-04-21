import React, { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { DmConversation, UserPresence } from '../../services/directMessages';
import { useAuth } from '../../context/AuthContext';
import PresenceDot from './PresenceDot';

interface GroupInfoDialogProps {
  conversation: DmConversation;
  presenceMap: Record<number, UserPresence>;
  onUpdateName: (name: string) => void;
  onClose: () => void;
}

const GroupInfoDialog: React.FC<GroupInfoDialogProps> = ({
  conversation, presenceMap, onUpdateName, onClose,
}) => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(conversation.group_name || '');

  const handleSaveName = () => {
    if (nameValue.trim()) {
      onUpdateName(nameValue.trim());
      setEditing(false);
    }
  };

  return (
    <div className="group-info-dialog">
      <div className="group-info-header">
        <h3>Group Info</h3>
        <button className="group-info-close" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </button>
      </div>

      <div className="group-info-name-section">
        {editing ? (
          <div className="group-info-name-edit">
            <input
              type="text"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); }}
            />
            <button onClick={handleSaveName} title="Save">
              <CheckIcon fontSize="small" />
            </button>
          </div>
        ) : (
          <div className="group-info-name-display">
            <span>{conversation.group_name || 'Unnamed Group'}</span>
            <button onClick={() => setEditing(true)} title="Edit name">
              <EditIcon fontSize="small" />
            </button>
          </div>
        )}
      </div>

      <div className="group-info-members">
        <h4>Members ({conversation.participants.length})</h4>
        {conversation.participants.map(p => {
          const presence = presenceMap[p.id];
          const isMe = p.id === user?.id;
          return (
            <div key={p.id} className="group-info-member">
              <div className="group-info-member-avatar">
                {p.first_name[0]}{p.last_name[0]}
              </div>
              <span className="group-info-member-name">
                {p.first_name} {p.last_name}
                {isMe && <span className="group-info-you"> (you)</span>}
              </span>
              {presence && <PresenceDot status={presence.status} size={8} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GroupInfoDialog;
