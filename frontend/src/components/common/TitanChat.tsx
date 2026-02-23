import React, { useState, useEffect, useRef } from 'react';
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
  const hasToken = !!localStorage.getItem('token');

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Debug: log every render with message count
  console.log(`🔥 Render - isOpen: ${isOpen}, hasToken: ${hasToken}, messages: ${messages.length}`, messages);

  // DOM mutation observer to detect external manipulation
  useEffect(() => {
    if (!isOpen || !messagesContainerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log('🔍 DOM Mutation detected:', mutation.type, mutation);
        if (mutation.type === 'attributes') {
          console.log('  Attribute changed:', mutation.attributeName,
            'on element:', mutation.target);
        }
      });
    });

    observer.observe(messagesContainerRef.current, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeOldValue: true,
    });

    return () => observer.disconnect();
  }, [isOpen]);

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

  // Don't render if not authenticated
  if (!hasToken) {
    return null;
  }

  return (
    <div className="titan-chat">
      <button
        className="titan-chat-trigger"
        onClick={() => {
          console.log(`🖱️ Toggle button clicked: ${isOpen} → ${!isOpen}`);
          setIsOpen(!isOpen);
        }}
      >
        <span className="titan-chat-icon">🛡️</span>
        <span className="titan-chat-label">Ask Titan</span>
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
              <button
                className="titan-chat-close"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>
          </div>

          <div className="titan-chat-messages" ref={messagesContainerRef}>
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
          </div>

          <form className="titan-chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="titan-chat-input"
              placeholder="Ask Titan anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
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
