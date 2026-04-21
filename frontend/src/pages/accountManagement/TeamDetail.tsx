import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { teamsApi, Team, TeamMember, TeamDashboard } from '../../services/teams';
import { employeesApi, AssignableEmployee } from '../../services/employees';
import OpportunityModal from '../../components/opportunities/OpportunityModal';
import { Opportunity } from '../../services/opportunities';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import SearchableSelect from '../../components/SearchableSelect';
import '../../styles/SalesPipeline.css';

// --- Helper functions matching ProjectList.tsx and SalesPipeline.tsx ---

const getMarketIcon = (market?: string): string => {
  const marketIcons: { [key: string]: string } = {
    'MFG-Food': '🍔', 'Health Care': '🏥', 'MFG-Other': '🏭', 'MFG-Paper': '📄',
    'Amusement/Recreation': '🎢', 'Educational': '🏫', 'Manufacturing': '🏭',
    'Commercial': '🏢', 'Office': '🏢', 'Power': '⚡', 'Lodging': '🏨',
    'Religious': '⛪', 'Public Safety': '🚔', 'Transportation': '🚚',
    'Communication': '📡', 'Conservation/Development': '🌲',
    'Sewage/Waste Disposal': '♻️', 'Highway/Street': '🛣️',
    'Water Supply': '💧', 'Residential': '🏠',
    'Healthcare': '🏥', 'Education': '🏫', 'Industrial': '🏭',
    'Retail': '🏬', 'Government': '🏛️', 'Hospitality': '🏨', 'Data Center': '💾'
  };
  return marketIcons[market || ''] || '🏢';
};

const getMarketGradient = (market?: string): string => {
  const marketGradients: { [key: string]: string } = {
    'MFG-Food': 'linear-gradient(135deg, #f97316, #eab308)',
    'Health Care': 'linear-gradient(135deg, #10b981, #06b6d4)',
    'MFG-Other': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'MFG-Paper': 'linear-gradient(135deg, #64748b, #94a3b8)',
    'Amusement/Recreation': 'linear-gradient(135deg, #ec4899, #f43f5e)',
    'Educational': 'linear-gradient(135deg, #f59e0b, #f97316)',
    'Manufacturing': 'linear-gradient(135deg, #6366f1, #3b82f6)',
    'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'Office': 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'Power': 'linear-gradient(135deg, #eab308, #f59e0b)',
    'Lodging': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
    'Religious': 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    'Public Safety': 'linear-gradient(135deg, #ef4444, #f97316)',
    'Transportation': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'Communication': 'linear-gradient(135deg, #14b8a6, #06b6d4)',
    'Conservation/Development': 'linear-gradient(135deg, #22c55e, #10b981)',
    'Sewage/Waste Disposal': 'linear-gradient(135deg, #84cc16, #22c55e)',
    'Highway/Street': 'linear-gradient(135deg, #64748b, #475569)',
    'Water Supply': 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
    'Residential': 'linear-gradient(135deg, #a855f7, #ec4899)',
    'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
    'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
    'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
    'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
    'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
  };
  return marketGradients[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
};

const getStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    'Open': '#10b981', 'Soft-Closed': '#f59e0b', 'Hard-Closed': '#6b7280',
    active: '#10b981', on_hold: '#f59e0b', completed: '#3b82f6', cancelled: '#ef4444'
  };
  return colors[status] || '#6b7280';
};

const getProjectIcon = (status: string): string => {
  const icons: { [key: string]: string } = {
    'Open': '🏗️', 'Soft-Closed': '📋', 'Hard-Closed': '✅',
    active: '🏗️', on_hold: '⏸️', completed: '✅', cancelled: '❌'
  };
  return icons[status] || '📋';
};

const getProjectGradient = (status: string): string => {
  const gradients: { [key: string]: string } = {
    'Open': 'linear-gradient(135deg, #10b981, #06b6d4)',
    'Soft-Closed': 'linear-gradient(135deg, #f59e0b, #f97316)',
    'Hard-Closed': 'linear-gradient(135deg, #6b7280, #4b5563)',
    active: 'linear-gradient(135deg, #10b981, #06b6d4)',
    on_hold: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
    completed: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    cancelled: 'linear-gradient(135deg, #ef4444, #dc2626)'
  };
  return gradients[status] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
};

const getManagerColor = (name: string): string => {
  const colors = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getManagerInitials = (name?: string): string => {
  if (!name) return 'UN';
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, confirm } = useTitanFeedback();
  const teamId = parseInt(id || '0');

  const [activeTab, setActiveTab] = useState<'members' | 'projects' | 'opportunities' | 'customers' | 'estimates'>('members');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeSearchText, setEmployeeSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  // Fetch team details
  const { data: team, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['teams', teamId],
    queryFn: async (): Promise<Team> => {
      const response = await teamsApi.getById(teamId);
      return response.data.data;
    },
    enabled: !!teamId,
  });

  // Fetch team members
  const { data: members = [] } = useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: async (): Promise<TeamMember[]> => {
      const response = await teamsApi.getMembers(teamId);
      return response.data.data;
    },
    enabled: !!teamId,
  });

  // Fetch team dashboard metrics (filtered)
  const { data: dashboard } = useQuery({
    queryKey: ['teams', teamId, 'dashboard', statusFilter],
    queryFn: async (): Promise<TeamDashboard> => {
      const response = await teamsApi.getDashboard(teamId, statusFilter);
      return response.data.data;
    },
    enabled: !!teamId,
  });

  // Fetch team opportunities (filtered)
  const { data: opportunities = [] } = useQuery({
    queryKey: ['teams', teamId, 'opportunities', statusFilter],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getOpportunities(teamId, statusFilter);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'opportunities',
  });

  // Fetch team customers (filtered)
  const { data: customers = [] } = useQuery({
    queryKey: ['teams', teamId, 'customers', statusFilter],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getCustomers(teamId, statusFilter);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'customers',
  });

  // Fetch team estimates (filtered)
  const { data: estimates = [] } = useQuery({
    queryKey: ['teams', teamId, 'estimates', statusFilter],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getEstimates(teamId, statusFilter);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'estimates',
  });

  // Fetch team projects (filtered)
  const { data: projects = [] } = useQuery({
    queryKey: ['teams', teamId, 'projects', statusFilter],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getProjects(teamId, statusFilter);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'projects',
  });

  // Fetch all employees for adding members
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees', 'assignable'],
    queryFn: async () => {
      const response = await employeesApi.getAssignable();
      return response.data.data as AssignableEmployee[];
    },
  });

  const availableEmployees = allEmployees.filter(
    (emp: AssignableEmployee) => !members.some((m: TeamMember) => m.employee_id === emp.id)
  );

  const addMemberMutation = useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: number; role: string }) =>
      teamsApi.addMember(teamId, employeeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
      setShowAddMemberModal(false);
      setSelectedEmployeeId('');
      setEmployeeSearchText('');
      setSelectedRole('member');
    },
    onError: (error: any) => {
      toast.error(`Failed to add member: ${error.response?.data?.error || error.message}`);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (employeeId: number) => teamsApi.removeMember(teamId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId] });
    },
    onError: (error: any) => {
      toast.error(`Failed to remove member: ${error.response?.data?.error || error.message}`);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: number; role: string }) =>
      teamsApi.updateMemberRole(teamId, employeeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update role: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleAddMember = () => {
    if (!selectedEmployeeId) return;
    addMemberMutation.mutate({ employeeId: parseInt(selectedEmployeeId), role: selectedRole });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (isLoadingTeam) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading team...</div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Team not found</h2>
          <Link to="/account-management/teams">Back to Teams</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/account-management/teams" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Teams
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: team.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                }}
              >
                {team.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1>{team.name}</h1>
                <div className="sales-subtitle">{team.description || 'No description'}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          {/* Active / All filter toggle */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <button
              onClick={() => setStatusFilter('active')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: statusFilter === 'active' ? team.color : 'white',
                color: statusFilter === 'active' ? 'white' : '#6b7280',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderLeft: '1px solid #e5e7eb',
                background: statusFilter === 'all' ? team.color : 'white',
                color: statusFilter === 'all' ? 'white' : '#6b7280',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>💼</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value">{dashboard?.opportunities.total || 0}</div>
            <div className="sales-kpi-label">Opportunities</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
              {formatCurrency(dashboard?.opportunities.total_value || 0)} pipeline
            </div>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>🏗️</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value">{dashboard?.projects.total || 0}</div>
            <div className="sales-kpi-label">Projects</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
              {dashboard?.projects.active || 0} active
            </div>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>👥</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value">{dashboard?.customers.total || 0}</div>
            <div className="sales-kpi-label">Customers</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
              {dashboard?.customers.active || 0} active
            </div>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>📋</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value">{dashboard?.estimates.total || 0}</div>
            <div className="sales-kpi-label">Estimates</div>
            <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px' }}>
              {dashboard?.estimates.pending || 0} pending
            </div>
          </div>
        </div>
        <div className="sales-kpi-card">
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>💰</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value">{formatCurrency(dashboard?.projects.total_value || 0)}</div>
            <div className="sales-kpi-label">Contract Value</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
              {formatCurrency(dashboard?.opportunities.won_value || 0)} won opps
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
        {(['members', 'projects', 'opportunities', 'customers', 'estimates'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === tab ? team.color : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {tab === 'members' && `Members (${members.length})`}
            {tab === 'projects' && `Projects (${dashboard?.projects.total || 0})`}
            {tab === 'opportunities' && `Opportunities (${dashboard?.opportunities.total || 0})`}
            {tab === 'customers' && `Customers (${dashboard?.customers.total || 0})`}
            {tab === 'estimates' && `Estimates (${dashboard?.estimates.total || 0})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="sales-table-section">
        {/* Members Tab */}
        {activeTab === 'members' && (
          <>
            <div className="sales-table-header">
              <div className="sales-table-title">Team Members</div>
              <button
                className="sales-btn sales-btn-primary"
                onClick={() => setShowAddMemberModal(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Member
              </button>
            </div>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Job Title</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th style={{ width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.length > 0 ? (
                  members.map((member: TeamMember) => (
                    <tr key={member.id}>
                      <td>
                        <div className="sales-salesperson-cell">
                          <div
                            className="sales-salesperson-avatar"
                            style={{ background: team.color }}
                          >
                            {`${member.first_name[0]}${member.last_name[0]}`.toUpperCase()}
                          </div>
                          {member.first_name} {member.last_name}
                        </div>
                      </td>
                      <td>{member.email}</td>
                      <td>{member.job_title || '-'}</td>
                      <td>{member.department_name || '-'}</td>
                      <td>
                        <select
                          value={member.role}
                          onChange={(e) => updateRoleMutation.mutate({ employeeId: member.employee_id, role: e.target.value })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb',
                            background: member.role === 'lead' ? 'rgba(99, 102, 241, 0.1)' : 'white',
                            color: member.role === 'lead' ? '#6366f1' : '#374151',
                            fontWeight: member.role === 'lead' ? 600 : 400,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="member">Member</option>
                          <option value="lead">Lead</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={async () => {
                            const ok = await confirm({ message: `Remove ${member.first_name} ${member.last_name} from the team?`, danger: true });
                            if (ok) {
                              removeMemberMutation.mutate(member.employee_id);
                            }
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      No members yet. Add team members to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Projects Tab - matches ProjectList styling */}
        {activeTab === 'projects' && (
          <>
            <div className="sales-table-header">
              <div className="sales-table-title">Team Projects</div>
            </div>
            <div className="sales-table-scroll-wrapper">
              <table className="sales-table">
                <colgroup>
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '0' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '55px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '85px' }} />
                  <col style={{ width: '140px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Project</th>
                    <th>Contract Value</th>
                    <th>GM%</th>
                    <th>Backlog</th>
                    <th>% Complete</th>
                    <th>Status</th>
                    <th>Dept</th>
                    <th>Project Manager</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.length > 0 ? (
                    projects.map((proj: any) => (
                      <tr
                        key={proj.id}
                        onClick={() => navigate(`/projects/${proj.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ fontWeight: 500, color: '#6366f1', fontSize: '0.8rem' }}>{proj.project_number || '-'}</td>
                        <td>
                          <div className="sales-project-cell">
                            <div className="sales-project-icon" style={{ background: proj.market ? getMarketGradient(proj.market) : getProjectGradient(proj.status) }}>
                              {proj.market ? getMarketIcon(proj.market) : getProjectIcon(proj.status)}
                            </div>
                            <div className="sales-project-info">
                              <h4>{proj.name}</h4>
                              <span>{proj.owner_name || proj.customer_name || proj.client || 'No client specified'}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {proj.contract_value ? `$${Math.round(Number(proj.contract_value)).toLocaleString()}` : '-'}
                        </td>
                        <td style={{
                          fontWeight: 600,
                          color: proj.gross_margin_percent != null
                            ? Number(proj.gross_margin_percent) > 0 ? '#10b981' : Number(proj.gross_margin_percent) < 0 ? '#ef4444' : 'inherit'
                            : 'inherit'
                        }}>
                          {proj.gross_margin_percent != null ? `${Math.round(Number(proj.gross_margin_percent) * 100)}%` : '-'}
                        </td>
                        <td>{proj.backlog ? `$${Math.round(Number(proj.backlog)).toLocaleString()}` : '-'}</td>
                        <td>{proj.percent_complete != null ? `${Math.round(Number(proj.percent_complete) * 100)}%` : '-'}</td>
                        <td>
                          <span className={`sales-stage-badge ${proj.status?.toLowerCase().replace('-', '_')}`}>
                            <span className="sales-stage-dot" style={{ background: getStatusColor(proj.status) }}></span>
                            {proj.status?.includes('-') ? proj.status : proj.status || 'Unknown'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {proj.department_number || proj.department_name || '-'}
                        </td>
                        <td>
                          {proj.manager_name ? (
                            <div className="sales-salesperson-cell">
                              <div className="sales-salesperson-avatar" style={{ background: getManagerColor(proj.manager_name), width: '24px', height: '24px', fontSize: '0.6rem' }}>
                                {getManagerInitials(proj.manager_name)}
                              </div>
                              {proj.manager_name}
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        No projects found for this team.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Opportunities Tab - matches SalesPipeline styling */}
        {activeTab === 'opportunities' && (
          <>
            <div className="sales-table-header">
              <div className="sales-table-title">Team Opportunities</div>
            </div>
            <div className="sales-table-scroll-wrapper">
              <table className="sales-table">
                <colgroup>
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '160px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Opportunity</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Value</th>
                    <th>Stage</th>
                    <th>Salesperson</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length > 0 ? (
                    opportunities.map((opp: any) => (
                      <tr
                        key={opp.id}
                        onClick={() => {
                          setSelectedOpportunity(opp as Opportunity);
                          setIsOpportunityModalOpen(true);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="sales-date-cell">
                          {opp.last_activity_at
                            ? new Date(opp.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '-'}
                        </td>
                        <td>
                          <div className="sales-project-cell">
                            <div className="sales-project-icon" style={{ background: getMarketGradient(opp.market) }}>
                              {getMarketIcon(opp.market)}
                            </div>
                            <div className="sales-project-info">
                              <h4>{opp.title}</h4>
                            </div>
                          </div>
                        </td>
                        <td>{opp.customer_name || opp.owner || '-'}</td>
                        <td>{opp.facility_location_name || opp.facility_name || '-'}</td>
                        <td className="sales-value-cell">{formatCurrencyShort(opp.estimated_value || 0)}</td>
                        <td>
                          <span
                            className="sales-stage-badge"
                            style={{ background: `${opp.stage_color}20`, color: opp.stage_color }}
                          >
                            <span className="sales-stage-dot" style={{ background: opp.stage_color }}></span>
                            {opp.stage_name}
                          </span>
                        </td>
                        <td>
                          {opp.assigned_to_name ? (
                            <div className="sales-salesperson-cell">
                              <div className="sales-salesperson-avatar" style={{ background: getManagerColor(opp.assigned_to_name), width: '24px', height: '24px', fontSize: '0.6rem' }}>
                                {getManagerInitials(opp.assigned_to_name)}
                              </div>
                              {opp.assigned_to_name}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                        No opportunities found for this team.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <>
            <div className="sales-table-header">
              <div className="sales-table-title">Team Customers</div>
            </div>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Owner</th>
                  <th>Account Manager</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {customers.length > 0 ? (
                  customers.map((customer: any) => (
                    <tr
                      key={customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 500 }}>{customer.name || customer.customer_facility}</td>
                      <td>{customer.customer_owner || '-'}</td>
                      <td>{customer.account_manager || '-'}</td>
                      <td>{customer.city && customer.state ? `${customer.city}, ${customer.state}` : '-'}</td>
                      <td>
                        <span className={`sales-stage-badge ${customer.active_customer ? 'active' : 'inactive'}`}>
                          <span className="sales-stage-dot" style={{ background: customer.active_customer ? '#10b981' : '#6b7280' }}></span>
                          {customer.active_customer ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {customer.customer_score ? (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: customer.customer_score >= 80 ? 'rgba(16, 185, 129, 0.1)' : customer.customer_score >= 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: customer.customer_score >= 80 ? '#10b981' : customer.customer_score >= 60 ? '#f59e0b' : '#ef4444',
                          }}>
                            {Math.round(customer.customer_score)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      No customers found for this team.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* Estimates Tab */}
        {activeTab === 'estimates' && (
          <>
            <div className="sales-table-header">
              <div className="sales-table-title">Team Estimates</div>
            </div>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Estimate #</th>
                  <th>Project Name</th>
                  <th>Customer</th>
                  <th>Total Cost</th>
                  <th>Bid Date</th>
                  <th>Status</th>
                  <th>Estimator</th>
                </tr>
              </thead>
              <tbody>
                {estimates.length > 0 ? (
                  estimates.map((est: any) => (
                    <tr
                      key={est.id}
                      onClick={() => navigate(`/estimating/${est.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 500, color: '#6366f1' }}>{est.estimate_number}</td>
                      <td>{est.project_name}</td>
                      <td>{est.customer_name || '-'}</td>
                      <td>{formatCurrency(est.total_cost || 0)}</td>
                      <td>{est.bid_date ? new Date(est.bid_date).toLocaleDateString() : '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: est.status === 'won' ? 'rgba(16, 185, 129, 0.1)' :
                                     est.status === 'lost' ? 'rgba(239, 68, 68, 0.1)' :
                                     'rgba(245, 158, 11, 0.1)',
                          color: est.status === 'won' ? '#10b981' :
                                 est.status === 'lost' ? '#ef4444' :
                                 '#f59e0b',
                          textTransform: 'capitalize',
                        }}>
                          {est.status}
                        </span>
                      </td>
                      <td>{est.estimator_full_name || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                      No estimates found for this team.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAddMemberModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '450px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px' }}>
              Add Team Member
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>
                Select Employee *
              </label>
              <SearchableSelect
                options={availableEmployees.map((emp: AssignableEmployee) => ({
                  value: emp.id.toString(),
                  label: `${emp.first_name} ${emp.last_name}${emp.job_title ? ` - ${emp.job_title}` : ''}`,
                }))}
                value={selectedEmployeeId}
                onChange={(value) => setSelectedEmployeeId(value)}
                placeholder="Search for employee..."
              />
              {availableEmployees.length === 0 && (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '8px' }}>
                  All employees are already in this team.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>
                Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.875rem',
                  background: 'white',
                }}
              >
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedEmployeeId('');
                  setEmployeeSearchText('');
                  setSelectedRole('member');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!selectedEmployeeId || addMemberMutation.isPending}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedEmployeeId ? team.color : '#d1d5db',
                  color: 'white',
                  cursor: selectedEmployeeId ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                }}
              >
                {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opportunity Modal */}
      {isOpportunityModalOpen && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={() => {
            setIsOpportunityModalOpen(false);
            setSelectedOpportunity(null);
          }}
          onSave={() => {
            setIsOpportunityModalOpen(false);
            setSelectedOpportunity(null);
            queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'opportunities'] });
            queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'dashboard'] });
          }}
        />
      )}
    </div>
  );
};

export default TeamDetailPage;
