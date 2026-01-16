import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../services/projects';
import './Dashboard.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'titan';
  timestamp: Date;
}

const Dashboard: React.FC = () => {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m Titan, your AI assistant. I can help you with project insights, customer data, scheduling, and answer questions about your business. How can I assist you today?',
      sender: 'titan',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProjects = projects?.filter((p) => p.status === 'active') || [];

  const modules = [
    { name: 'Project Management', icon: '🏗️', path: '/projects', desc: 'RFIs, Submittals, COs', ready: true, count: projects?.length || 0 },
    { name: 'Account Management', icon: '🤝', path: '/account-management', desc: 'Customers & Contacts', ready: true },
    { name: 'Marketing', icon: '🎯', path: '/marketing', desc: 'Proposals, Branding, Events', ready: true },
    { name: 'Estimating', icon: '📐', path: '/estimating', desc: 'Estimates & Budgets', ready: true },
    { name: 'QA/QC', icon: '✅', path: '#', desc: 'Quality Assurance', ready: false },
    { name: 'IT', icon: '💻', path: '#', desc: 'Systems & Support', ready: false },
    { name: 'Accounting', icon: '💵', path: '#', desc: 'AP/AR, Job Costing', ready: false },
    { name: 'Service', icon: '🔧', path: '#', desc: 'Work Orders', ready: false },
    { name: 'Safety', icon: '🦺', path: '#', desc: 'Incidents & Training', ready: false },
    { name: 'HR', icon: '👥', path: '#', desc: 'Employees', ready: false },
    { name: 'Fleet', icon: '🚛', path: '#', desc: 'Vehicles', ready: false },
    { name: 'Inventory', icon: '📦', path: '#', desc: 'Parts & Tools', ready: false },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        'I can help you analyze project data and identify trends. Would you like me to review your active projects?',
        'Based on your system data, I can provide insights on project timelines, budgets, and resource allocation.',
        'I can assist with generating reports, tracking metrics, and providing strategic recommendations.',
        'Let me help you with that. I can analyze trends, review performance metrics, and suggest optimizations.',
        'Great question! I can provide insights on operations, help with data analysis, and answer questions about your projects.',
      ];

      const titanResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: responses[Math.floor(Math.random() * responses.length)],
        sender: 'titan',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, titanResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-layout">
        <div className="main-content">
          <div className="modules-section">
            <h2 className="section-title">Modules</h2>
            <div className="modules-grid">
              {modules.map((module) => (
                <Link
                  key={module.name}
                  to={module.ready ? module.path : '#'}
                  className={`module-tile ${module.ready ? 'ready' : 'disabled'}`}
                  onClick={(e) => !module.ready && e.preventDefault()}
                >
                  {!module.ready && <span className="coming-soon-badge">Coming Soon</span>}
                  <div className="module-icon">{module.icon}</div>
                  <div className="module-name">{module.name}</div>
                  {module.count !== undefined && (
                    <div className="module-count">{module.count}</div>
                  )}
                  {module.desc && <div className="module-desc">{module.desc}</div>}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="chatbot-section">
          <div className="chatbot-card card">
            <div className="chatbot-header">
              <div className="chatbot-title-wrapper">
                <div className="chatbot-avatar">🛡️</div>
                <div>
                  <h2 className="chatbot-title">Ask Titan</h2>
                  <p className="chatbot-status">AI Assistant • Online</p>
                </div>
              </div>
            </div>

            <div className="chatbot-messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.sender === 'user' ? 'message-user' : 'message-titan'}`}
                >
                  <div className="message-content">
                    {message.sender === 'titan' && (
                      <div className="message-avatar">🛡️</div>
                    )}
                    <div className="message-bubble">
                      <p>{message.text}</p>
                      <span className="message-time">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {message.sender === 'user' && (
                      <div className="message-avatar">👤</div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="message message-titan">
                  <div className="message-content">
                    <div className="message-avatar">🛡️</div>
                    <div className="message-bubble typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chatbot-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chatbot-input"
                placeholder="Ask Titan anything about your business..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button type="submit" className="chatbot-send-btn" disabled={!inputValue.trim()}>
                ➤
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="dashboard-footer">
        © {new Date().getFullYear()} Tweet Garot Mechanical • Internal Use Only
      </footer>
    </div>
  );
};

export default Dashboard;