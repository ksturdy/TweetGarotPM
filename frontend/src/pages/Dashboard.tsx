import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../services/projects';
import opportunitiesService from '../services/opportunities';
import { estimatesApi } from '../services/estimates';
import CalculateIcon from '@mui/icons-material/Calculate';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useAuth } from '../context/AuthContext';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import './Dashboard.css';
import '../styles/SalesPipeline.css';

type ViewScope = 'my' | 'team' | 'company';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  // Fetch all estimates for filtering
  const { data: estimatesResponse } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => estimatesApi.getAll(),
  });
  const allEstimates = estimatesResponse?.data || [];

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

  // Sort opportunities by most recent (created_at or updated_at) - show ALL opportunities
  const recentOpportunities = React.useMemo(() => {
    if (!allOpportunities) return [];
    return [...allOpportunities]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [allOpportunities]);

  // Sort estimates by most recent (created_at or updated_at)
  const recentEstimates = React.useMemo(() => {
    if (!allEstimates) return [];
    return [...allEstimates]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [allEstimates]);

  // Mock data for attention items (would come from API in real implementation)
  const attentionItems = viewScope === 'my' ? [
    { id: 1, type: 'rfi', message: 'RFI #42 overdue by 3 days', project: 'ABC Tower', path: '/projects/1/rfis', severity: 'high' },
    { id: 2, type: 'submittal', message: 'Submittal review due tomorrow', project: 'XYZ Hospital', path: '/projects/2/submittals', severity: 'medium' },
  ] : [
    { id: 1, type: 'rfi', message: 'RFI #42 overdue by 3 days', project: 'ABC Tower', path: '/projects/1/rfis', severity: 'high' },
    { id: 2, type: 'submittal', message: 'Submittal review due tomorrow', project: 'XYZ Hospital', path: '/projects/2/submittals', severity: 'medium' },
    { id: 3, type: 'report', message: 'Daily report not submitted', project: 'DEF Building', path: '/projects/3/daily-reports', severity: 'low' },
  ];

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
          {/* Recent Opportunities */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">
                <HandshakeIcon className="card-title-icon" />
                Recent Opportunities
              </h2>
              <Link to="/sales" className="card-link">View all</Link>
            </div>
            <div className="dashboard-table-container">
              <table className="sales-table dashboard-compact-table">
                <thead>
                  <tr>
                    <th>Project / Opportunity</th>
                    <th>Company</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th>Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOpportunities.length > 0 ? (
                    recentOpportunities.map((opp: any) => (
                      <tr
                        key={opp.id}
                        onClick={() => navigate('/sales', { state: { selectedOpportunityId: opp.id } })}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div className="sales-project-cell">
                            <div className="sales-project-icon" style={{ background: 'linear-gradient(135deg, #F37B03, #ff9500)', width: '32px', height: '32px', fontSize: '0.75rem' }}>
                              🤝
                            </div>
                            <div className="sales-project-info">
                              <h4>{opp.title}</h4>
                            </div>
                          </div>
                        </td>
                        <td>{opp.customer_name || '-'}</td>
                        <td className="sales-value-cell">{formatCurrency(parseFloat(opp.estimated_value) || 0)}</td>
                        <td>
                          <span className={`sales-stage-badge ${opp.stage_name?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}>
                            <span className="sales-stage-dot"></span>
                            {opp.stage_name || 'Unknown'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-table">No opportunities found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Estimates */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">
                <CalculateIcon className="card-title-icon" />
                Recent Estimates
              </h2>
              <Link to="/estimating" className="card-link">View all</Link>
            </div>
            <div className="dashboard-table-container">
              <table className="sales-table dashboard-compact-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Project Name</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEstimates.length > 0 ? (
                    recentEstimates.map((estimate: any) => (
                      <tr
                        key={estimate.id}
                        onClick={() => window.location.href = `/estimating/estimates/${estimate.id}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span style={{ color: '#3b82f6', fontWeight: 500 }}>{estimate.estimate_number}</span>
                        </td>
                        <td>
                          <div className="sales-project-cell">
                            <div className="sales-project-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', width: '32px', height: '32px', fontSize: '0.75rem' }}>
                              📊
                            </div>
                            <div className="sales-project-info">
                              <h4>{estimate.project_name || 'Untitled'}</h4>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(parseFloat(estimate.total_cost) || 0)}
                        </td>
                        <td>
                          <span className={`sales-stage-badge ${estimate.status?.toLowerCase().replace(/\s+/g, '-') || 'in-progress'}`}>
                            <span className="sales-stage-dot"></span>
                            {estimate.status || 'In Progress'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-table">No estimates found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
