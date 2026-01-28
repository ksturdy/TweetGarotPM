import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../services/projects';
import opportunitiesService from '../services/opportunities';
import { chatService } from '../services/chat';
import { useAuth } from '../context/AuthContext';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import './Dashboard.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'titan';
  timestamp: Date;
}

type ViewScope = 'my' | 'team' | 'company';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [viewScope, setViewScope] = useState<ViewScope>('my');

  // Scroll to top when Dashboard mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  // Fetch all projects for filtering
  const { data: allProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  // Fetch all opportunities for filtering
  const { data: allOpportunities } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => opportunitiesService.getAll(),
  });

  // Filter projects based on view scope
  const projects = React.useMemo(() => {
    if (!allProjects) return [];

    switch (viewScope) {
      case 'my':
        return allProjects.filter((p: any) => p.manager_id === user?.id);
      case 'team':
        // For now, team view shows all (can be enhanced with team membership)
        return allProjects;
      case 'company':
      default:
        return allProjects;
    }
  }, [allProjects, viewScope, user?.id]);

  // Filter opportunities based on view scope
  const opportunities = React.useMemo(() => {
    if (!allOpportunities) return [];

    switch (viewScope) {
      case 'my':
        return allOpportunities.filter((o: any) => o.assigned_to === user?.id);
      case 'team':
        // For now, team view shows all (can be enhanced with team membership)
        return allOpportunities;
      case 'company':
      default:
        return allOpportunities;
    }
  }, [allOpportunities, viewScope, user?.id]);

  // Chat state
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

  // Computed values from filtered data
  const activeProjects = projects?.filter((p: any) => p.status === 'active') || [];
  const totalProjects = projects?.length || 0;

  const pipelineValue = opportunities?.reduce((sum: number, opp: any) => {
    const stageName = opp.stage_name?.toLowerCase() || '';
    if (stageName !== 'won' && stageName !== 'lost') {
      return sum + (parseFloat(opp.estimated_value) || 0);
    }
    return sum;
  }, 0) || 0;

  const openOpportunities = opportunities?.filter((o: any) => {
    const stageName = o.stage_name?.toLowerCase() || '';
    return stageName !== 'won' && stageName !== 'lost';
  }).length || 0;

  // Mock data for attention items (would come from API in real implementation)
  const attentionItems = viewScope === 'my' ? [
    { id: 1, type: 'rfi', message: 'RFI #42 overdue by 3 days', project: 'ABC Tower', path: '/projects/1/rfis', severity: 'high' },
    { id: 2, type: 'submittal', message: 'Submittal review due tomorrow', project: 'XYZ Hospital', path: '/projects/2/submittals', severity: 'medium' },
  ] : [
    { id: 1, type: 'rfi', message: 'RFI #42 overdue by 3 days', project: 'ABC Tower', path: '/projects/1/rfis', severity: 'high' },
    { id: 2, type: 'submittal', message: 'Submittal review due tomorrow', project: 'XYZ Hospital', path: '/projects/2/submittals', severity: 'medium' },
    { id: 3, type: 'report', message: 'Daily report not submitted', project: 'DEF Building', path: '/projects/3/daily-reports', severity: 'low' },
  ];

  // Mock recent activity
  const recentActivity = [
    { id: 1, action: 'RFI #45 submitted', user: 'John Smith', project: 'ABC Tower', time: '2 hours ago' },
    { id: 2, action: 'Change Order #7 approved', user: 'Sarah Garcia', project: 'XYZ Hospital', time: '4 hours ago', amount: '$12,500' },
    { id: 3, action: 'New opportunity added', user: 'Mike Johnson', project: 'HVAC Retrofit', time: '5 hours ago' },
    { id: 4, action: 'Submittal marked approved', user: 'Emily Martinez', project: 'DEF Building', time: '6 hours ago' },
    { id: 5, action: 'Daily report submitted', user: 'Bob Wilson', project: 'GHI Complex', time: 'Yesterday' },
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

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getViewLabel = () => {
    switch (viewScope) {
      case 'my': return 'your';
      case 'team': return "your team's";
      case 'company': return 'company-wide';
    }
  };

  if (projectsLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      {/* Welcome Header with View Toggle */}
      <div className="dashboard-header-row">
        <div className="dashboard-welcome">
          <div className="welcome-text">
            <h1>Welcome back, {user?.firstName || 'User'}</h1>
            <p>Here's what's happening with {getViewLabel()} projects today.</p>
          </div>
        </div>

        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewScope === 'my' ? 'active' : ''}`}
            onClick={() => setViewScope('my')}
          >
            <PersonIcon fontSize="small" />
            <span>My Work</span>
          </button>
          <button
            className={`view-toggle-btn ${viewScope === 'team' ? 'active' : ''}`}
            onClick={() => setViewScope('team')}
          >
            <GroupsIcon fontSize="small" />
            <span>My Team</span>
          </button>
          <button
            className={`view-toggle-btn ${viewScope === 'company' ? 'active' : ''}`}
            onClick={() => setViewScope('company')}
          >
            <BusinessIcon fontSize="small" />
            <span>Company</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-blue">
            <FolderIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{activeProjects.length}</div>
            <div className="kpi-label">Active Projects</div>
          </div>
          <Link to="/projects" className="kpi-link">
            <ArrowForwardIcon fontSize="small" />
          </Link>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-orange">
            <TrendingUpIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{formatCurrency(pipelineValue)}</div>
            <div className="kpi-label">Pipeline Value</div>
          </div>
          <Link to="/sales" className="kpi-link">
            <ArrowForwardIcon fontSize="small" />
          </Link>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-green">
            <AssignmentIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{openOpportunities}</div>
            <div className="kpi-label">Open Opportunities</div>
          </div>
          <Link to="/sales" className="kpi-link">
            <ArrowForwardIcon fontSize="small" />
          </Link>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-icon-purple">
            <InventoryIcon />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{totalProjects}</div>
            <div className="kpi-label">Total Projects</div>
          </div>
          <Link to="/projects" className="kpi-link">
            <ArrowForwardIcon fontSize="small" />
          </Link>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="dashboard-left">
          {/* Needs Attention */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">
                <WarningAmberIcon className="card-title-icon warning" />
                Needs Attention
              </h2>
              <span className="attention-count">{attentionItems.length}</span>
            </div>
            <div className="attention-list">
              {attentionItems.length > 0 ? (
                attentionItems.map((item) => (
                  <Link key={item.id} to={item.path} className={`attention-item severity-${item.severity}`}>
                    <div className="attention-content">
                      <div className="attention-message">{item.message}</div>
                      <div className="attention-project">{item.project}</div>
                    </div>
                    <ArrowForwardIcon className="attention-arrow" fontSize="small" />
                  </Link>
                ))
              ) : (
                <div className="empty-attention">
                  <CheckCircleIcon className="empty-icon" />
                  <p>All caught up! No items need attention.</p>
                </div>
              )}
            </div>
          </div>

          {/* Active Projects */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">
                <FolderIcon className="card-title-icon" />
                Active Projects
              </h2>
              <Link to="/projects" className="card-link">View all</Link>
            </div>
            <div className="projects-table-container">
              <table className="projects-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.slice(0, 5).map((project: any) => (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projects/${project.id}`} className="project-name-link">
                          {project.name}
                        </Link>
                        <div className="project-client">{project.client}</div>
                      </td>
                      <td>
                        <span className={`status-badge status-${project.status}`}>
                          {project.status}
                        </span>
                      </td>
                      <td>
                        <div className="progress-bar-container">
                          <div className="progress-bar-wrapper">
                            <div
                              className="progress-bar"
                              style={{ width: `${project.percentComplete || 0}%` }}
                            />
                          </div>
                          <span className="progress-text">{project.percentComplete || 0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeProjects.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty-table">
                        {viewScope === 'my' ? 'No projects assigned to you' : 'No active projects'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="dashboard-right">
          {/* Recent Activity */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">
                <AccessTimeIcon className="card-title-icon" />
                Recent Activity
              </h2>
            </div>
            <div className="activity-list">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-content">
                    <div className="activity-action">{activity.action}</div>
                    <div className="activity-meta">
                      <span className="activity-user">{activity.user}</span>
                      <span className="activity-separator">•</span>
                      <span className="activity-project">{activity.project}</span>
                    </div>
                    <div className="activity-time">{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Titan Chat */}
          <div className="dashboard-card chat-card">
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
                placeholder="Ask Titan anything..."
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
    </div>
  );
};

export default Dashboard;
