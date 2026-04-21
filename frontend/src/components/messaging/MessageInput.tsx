import React, { useState, useRef, useCallback } from 'react';
import SendIcon from '@mui/icons-material/Send';
import { getSocket } from '../../services/socket';

interface MessageInputProps {
  conversationId: number;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ conversationId, disabled }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const emitTyping = useCallback((isTyping: boolean) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('dm:typing', { conversationId, isTyping });
    }
  }, [conversationId]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    emitTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => emitTyping(false), 2000);
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;

    const socket = getSocket();
    if (!socket) return;

    setSending(true);
    emitTyping(false);

    socket.emit('dm:send', { conversationId, body }, (response: any) => {
      if (response?.ok) {
        setText('');
        inputRef.current?.focus();
      } else {
        console.error('[MessageInput] Send failed:', response?.error);
      }
      setSending(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-input-wrapper">
      <textarea
        ref={inputRef}
        className="message-input-textarea"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled || sending}
      />
      <button
        className="message-send-btn"
        onClick={handleSend}
        disabled={!text.trim() || sending || disabled}
        title="Send"
      >
        <SendIcon fontSize="small" />
      </button>
    </div>
  );
};

export default MessageInput;
