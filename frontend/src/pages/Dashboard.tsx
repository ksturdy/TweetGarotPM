import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../services/projects';
import opportunitiesService from '../services/opportunities';
import { estimatesApi } from '../services/estimates';
import { dashboardApi, AttentionItem } from '../services/dashboard';
import { employeesApi } from '../services/employees';
import { teamsApi } from '../services/teams';
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

// Helper function to get market icon
const getMarketIcon = (market?: string): string => {
  const marketIcons: { [key: string]: string } = {
    'Healthcare': '🏥',
    'Education': '🏫',
    'Commercial': '🏢',
    'Industrial': '🏭',
    'Retail': '🏬',
    'Government': '🏛️',
    'Hospitality': '🏨',
    'Data Center': '💾'
  };
  return marketIcons[market || ''] || '🏢';
};

// Helper function to get market gradient
const getMarketGradient = (market?: string): string => {
  const marketGradients: { [key: string]: string } = {
    'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
    'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
    'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
    'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
    'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
  };
  return marketGradients[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
};

// Helper function to get time-based greeting
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewScope, setViewScope] = useState<ViewScope>('my');

  // Scroll to top when Dashboard mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  // Fetch the current user's employee record (for manager_id filtering)
  const { data: currentEmployeeResponse } = useQuery({
    queryKey: ['current-employee', user?.id],
    queryFn: () => user?.id ? employeesApi.getByUserId(user.id).then(res => res.data) : Promise.resolve(null),
    enabled: !!user?.id,
  });
  const currentEmployeeId = currentEmployeeResponse?.data?.id;

  // Fetch team member IDs (for "My Team" filtering)
  // employeeIds: for project filtering (manager_id references employees)
  // userIds: for opportunity/estimate filtering (assigned_to/estimator_id reference users)
  // names: for matching estimates by estimator_name text field
  const { data: teamMemberIdsResponse } = useQuery({
    queryKey: ['my-team-member-ids'],
    queryFn: () => teamsApi.getMyTeamMemberIds(),
    enabled: !!user?.id,
  });
  const teamMemberEmployeeIds = teamMemberIdsResponse?.data?.data?.employeeIds || [];
  const teamMemberUserIds = teamMemberIdsResponse?.data?.data?.userIds || [];
  const teamMemberNames = teamMemberIdsResponse?.data?.data?.names || [];

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
        // Filter to user's projects only (manager_id references employees)
        // Use Number() to handle type mismatches between string/number IDs
        return allProjects.filter((p: any) => Number(p.manager_id) === Number(currentEmployeeId));
      case 'team':
        // Filter to projects managed by any team member
        return allProjects.filter((p: any) => teamMemberEmployeeIds.map(Number).includes(Number(p.manager_id)));
      case 'company':
      default:
        return allProjects;
    }
  }, [allProjects, viewScope, currentEmployeeId, teamMemberEmployeeIds]);

  // Filter opportunities based on view scope
  const opportunities = React.useMemo(() => {
    if (!allOpportunities) return [];

    switch (viewScope) {
      case 'my':
        // Filter to user's opportunities only
        return allOpportunities.filter((o: any) => o.assigned_to === user?.id);
      case 'team':
        // Filter to opportunities assigned to any team member (using user IDs)
        return allOpportunities.filter((o: any) => teamMemberUserIds.map(Number).includes(Number(o.assigned_to)));
      case 'company':
      default:
        return allOpportunities;
    }
  }, [allOpportunities, viewScope, user?.id, teamMemberUserIds]);

  // Filter estimates based on view scope
  const estimates = React.useMemo(() => {
    if (!allEstimates) return [];

    // Current user's full name for matching estimator_name
    const currentUserName = user ? `${user.firstName} ${user.lastName}` : '';

    switch (viewScope) {
      case 'my':
        // Filter to user's estimates based on who is the assigned estimator
        // If an estimator is assigned (estimator_id or estimator_name), use that
        // Only fall back to created_by if no estimator is assigned
        return allEstimates.filter((e: any) => {
          const hasAssignedEstimator = e.estimator_id || e.estimator_name;

          if (hasAssignedEstimator) {
            // Check if current user is the assigned estimator
            return Number(e.estimator_id) === Number(currentEmployeeId) ||
              (e.estimator_name && currentUserName && e.estimator_name.toLowerCase() === currentUserName.toLowerCase());
          } else {
            // No estimator assigned - show if user created it
            return Number(e.created_by) === Number(user?.id);
          }
        });
      case 'team':
        // Filter to estimates by any team member
        return allEstimates.filter((e: any) => {
          const hasAssignedEstimator = e.estimator_id || e.estimator_name;

          if (hasAssignedEstimator) {
            // Check if a team member is the assigned estimator
            return teamMemberEmployeeIds.map(Number).includes(Number(e.estimator_id)) ||
              (e.estimator_name && teamMemberNames.some((name: string) => name.toLowerCase() === e.estimator_name.toLowerCase()));
          } else {
            // No estimator assigned - show if a team member created it
            return teamMemberUserIds.map(Number).includes(Number(e.created_by));
          }
        });
      case 'company':
      default:
        return allEstimates;
    }
  }, [allEstimates, viewScope, user, currentEmployeeId, teamMemberEmployeeIds, teamMemberUserIds, teamMemberNames]);

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

  // Sort filtered opportunities by most recent (created_at or updated_at)
  const recentOpportunities = React.useMemo(() => {
    if (!opportunities) return [];
    return [...opportunities]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [opportunities]);

  // Sort filtered estimates by most recent (created_at or updated_at)
  const recentEstimates = React.useMemo(() => {
    if (!estimates) return [];
    return [...estimates]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [estimates]);

  // Fetch attention items based on view scope
  const { data: attentionItems = [] } = useQuery<AttentionItem[]>({
    queryKey: ['attention-items', viewScope],
    queryFn: () => dashboardApi.getAttentionItems(viewScope),
  });

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
            <h1>{getGreeting()}, {user?.firstName || 'User'}</h1>
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
                      <div className="attention-meta">
                        <span className="attention-project">{item.project}</span>
                        {item.responsiblePerson && (
                          <span className="attention-responsible">
                            <PersonIcon style={{ fontSize: '14px', marginRight: '4px', verticalAlign: 'middle' }} />
                            {item.responsiblePerson}
                          </span>
                        )}
                      </div>
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
                    <th>Manager</th>
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
                        {project.manager_name ? (
                          <div className="project-manager">
                            <PersonIcon style={{ fontSize: '14px', marginRight: '4px', color: '#8888a0', verticalAlign: 'middle' }} />
                            <span>{project.manager_name}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#8888a0' }}>-</span>
                        )}
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
                      <td colSpan={4} className="empty-table">
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
                    <th style={{ width: '26%' }}>Project / Opportunity</th>
                    <th style={{ width: '20%' }}>Customer</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Value</th>
                    <th style={{ width: '12%' }}>Stage</th>
                    <th style={{ width: '12%' }}>Date</th>
                    <th style={{ width: '20%' }}>Salesperson</th>
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
                            <div className="sales-project-icon" style={{ background: getMarketGradient(opp.market), width: '32px', height: '32px', fontSize: '0.75rem' }}>
                              {getMarketIcon(opp.market)}
                            </div>
                            <div className="sales-project-info">
                              <h4>{opp.title}</h4>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1a1a2e' }}>
                              {opp.facility_customer_name || opp.facility_name || opp.client_name || '-'}
                            </span>
                            {(opp.customer_name || opp.owner || opp.client_company) && (
                              <span style={{ fontSize: '0.75rem', color: '#5a5a72' }}>
                                {opp.customer_name || opp.owner || opp.client_company}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sales-value-cell">{formatCurrency(parseFloat(opp.estimated_value) || 0)}</td>
                        <td>
                          <span className={`sales-stage-badge ${opp.stage_name?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}>
                            <span className="sales-stage-dot"></span>
                            {opp.stage_name || 'Unknown'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>
                          {opp.updated_at ? new Date(opp.updated_at).toLocaleDateString() : (opp.created_at ? new Date(opp.created_at).toLocaleDateString() : '-')}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>{opp.assigned_to_name || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-table">No opportunities found</td>
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
                    <th style={{ width: '26%' }}>Project / Estimate</th>
                    <th style={{ width: '20%' }}>Customer</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Value</th>
                    <th style={{ width: '12%' }}>Status</th>
                    <th style={{ width: '12%' }}>Date</th>
                    <th style={{ width: '20%' }}>Estimator</th>
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
                          <div className="sales-project-cell">
                            <div className="sales-project-icon" style={{ background: getMarketGradient(estimate.building_type), width: '32px', height: '32px', fontSize: '0.75rem' }}>
                              {getMarketIcon(estimate.building_type)}
                            </div>
                            <div className="sales-project-info">
                              <h4>{estimate.project_name || 'Untitled'}</h4>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1a1a2e' }}>
                              {estimate.customer_facility || estimate.facility_name || '-'}
                            </span>
                            {(estimate.customer_owner || estimate.customer_name) && (
                              <span style={{ fontSize: '0.75rem', color: '#5a5a72' }}>
                                {estimate.customer_owner || estimate.customer_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="sales-value-cell">
                          {formatCurrency(parseFloat(estimate.total_cost) || 0)}
                        </td>
                        <td>
                          <span className={`sales-stage-badge ${estimate.status?.toLowerCase().replace(/\s+/g, '-') || 'in-progress'}`}>
                            <span className="sales-stage-dot"></span>
                            {(!estimate.status || estimate.status.toLowerCase() === 'in progress') ? 'Bidding' : estimate.status.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>
                          {estimate.updated_at ? new Date(estimate.updated_at).toLocaleDateString() : (estimate.created_at ? new Date(estimate.created_at).toLocaleDateString() : '-')}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#5a5a72' }}>{estimate.estimator_name || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-table">No estimates found</td>
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
