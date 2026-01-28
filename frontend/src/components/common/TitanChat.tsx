import React, { useState, useRef, useEffect } from 'react';
import { chatService } from '../../services/chat';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import './TitanChat.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'titan';
  timestamp: Date;
}

const TitanChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm Titan, your AI assistant. I can help you with project insights, customer data, scheduling, and answer questions about your business. How can I assist you today?",
      sender: 'titan',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep open if there's an active conversation (more than the initial message)
  const hasActiveConversation = messages.length > 1;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        if (!hasActiveConversation) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, hasActiveConversation]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Only auto-close if no active conversation
    if (!hasActiveConversation && !isTyping) {
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 300);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = inputValue;
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await chatService.sendMessage(messageText, messages);

      const titanResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        sender: 'titan',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, titanResponse]);
    } catch (error: any) {
      console.error('Chat error:', error);

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: error.response?.data?.error || 'Sorry, I encountered an error. Please try again.',
        sender: 'titan',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        text: "Hello! I'm Titan, your AI assistant. I can help you with project insights, customer data, scheduling, and answer questions about your business. How can I assist you today?",
        sender: 'titan',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div
      ref={chatRef}
      className={`titan-chat ${isOpen ? 'open' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className="titan-chat-trigger" onClick={() => setIsOpen(!isOpen)}>
        <span className="titan-chat-icon">🛡️</span>
        <span className="titan-chat-label">Ask Titan</span>
        {hasActiveConversation && <span className="titan-chat-badge" />}
      </button>

      {isOpen && (
        <div className="titan-chat-panel">
          <div className="titan-chat-header">
            <div className="titan-chat-header-info">
              <span className="titan-chat-avatar">🛡️</span>
              <div>
                <h3 className="titan-chat-title">Ask Titan</h3>
                <p className="titan-chat-status">AI Assistant • Online</p>
              </div>
            </div>
            <div className="titan-chat-header-actions">
              {hasActiveConversation && (
                <button
                  className="titan-chat-clear"
                  onClick={handleClearChat}
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                className="titan-chat-close"
                onClick={handleClose}
                title="Close"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
          </div>

          <div className="titan-chat-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`titan-message ${message.sender === 'user' ? 'titan-message-user' : 'titan-message-ai'}`}
              >
                <div className="titan-message-content">
                  {message.sender === 'titan' && (
                    <div className="titan-message-avatar">🛡️</div>
                  )}
                  <div className="titan-message-bubble">
                    <p>{message.text}</p>
                    <span className="titan-message-time">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="titan-message titan-message-ai">
                <div className="titan-message-content">
                  <div className="titan-message-avatar">🛡️</div>
                  <div className="titan-message-bubble titan-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="titan-chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="titan-chat-input"
              placeholder="Ask Titan anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="titan-chat-send"
              disabled={!inputValue.trim()}
            >
              <SendIcon fontSize="small" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default TitanChat;
