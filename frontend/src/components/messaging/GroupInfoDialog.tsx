import React from 'react';
import { DmConversation, UserPresence } from '../../services/directMessages';
import { useAuth } from '../../context/AuthContext';
import PresenceDot from './PresenceDot';

interface GroupInfoDialogProps {
  conversation: DmConversation;
  presenceMap: Record<number, UserPresence>;
  onClose: () => void;
}

const GroupInfoDialog: React.FC<GroupInfoDialogProps> = ({
  conversation, presenceMap, onClose,
}) => {
  const { user } = useAuth();

  return (
    <div className="group-info-dialog">
      <div className="group-info-header" />

      <div className="group-info-members">
        <h4>Participants ({conversation.participants.length})</h4>
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
