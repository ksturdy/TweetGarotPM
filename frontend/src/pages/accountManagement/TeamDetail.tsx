import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { teamsApi, Team, TeamMember, TeamDashboard } from '../../services/teams';
import { employeesApi, Employee } from '../../services/employees';
import OpportunityModal from '../../components/opportunities/OpportunityModal';
import { Opportunity } from '../../services/opportunities';
import '../../styles/SalesPipeline.css';

const TeamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const teamId = parseInt(id || '0');

  const [activeTab, setActiveTab] = useState<'members' | 'opportunities' | 'customers' | 'estimates'>('members');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
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

  // Fetch team dashboard metrics
  const { data: dashboard } = useQuery({
    queryKey: ['teams', teamId, 'dashboard'],
    queryFn: async (): Promise<TeamDashboard> => {
      const response = await teamsApi.getDashboard(teamId);
      return response.data.data;
    },
    enabled: !!teamId,
  });

  // Fetch team opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['teams', teamId, 'opportunities'],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getOpportunities(teamId);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'opportunities',
  });

  // Fetch team customers
  const { data: customers = [] } = useQuery({
    queryKey: ['teams', teamId, 'customers'],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getCustomers(teamId);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'customers',
  });

  // Fetch team estimates
  const { data: estimates = [] } = useQuery({
    queryKey: ['teams', teamId, 'estimates'],
    queryFn: async (): Promise<any[]> => {
      const response = await teamsApi.getEstimates(teamId);
      return response.data.data;
    },
    enabled: !!teamId && activeTab === 'estimates',
  });

  // Fetch all employees for adding members
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await employeesApi.getAll();
      return response.data.data as Employee[];
    },
  });

  // Filter out employees already in the team
  const availableEmployees = allEmployees.filter(
    (emp: Employee) => !members.some((m: TeamMember) => m.employee_id === emp.id)
  );

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: number; role: string }) =>
      teamsApi.addMember(teamId, employeeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowAddMemberModal(false);
      setSelectedEmployeeId('');
      setSelectedRole('member');
    },
    onError: (error: any) => {
      alert(`Failed to add member: ${error.response?.data?.error || error.message}`);
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (employeeId: number) => teamsApi.removeMember(teamId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (error: any) => {
      alert(`Failed to remove member: ${error.response?.data?.error || error.message}`);
    },
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ employeeId, role }: { employeeId: number; role: string }) =>
      teamsApi.updateMemberRole(teamId, employeeId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'members'] });
    },
    onError: (error: any) => {
      alert(`Failed to update role: ${error.response?.data?.error || error.message}`);
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
          <span className={`sales-stage-badge ${team.is_active ? 'active' : 'inactive'}`}>
            <span className="sales-stage-dot" style={{ background: team.is_active ? '#10b981' : '#6b7280' }}></span>
            {team.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Dashboard KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>🏆</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value">{dashboard?.opportunities.won || 0}</div>
            <div className="sales-kpi-label">Won Opportunities</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>
              {formatCurrency(dashboard?.opportunities.won_value || 0)} won
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
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
        {(['members', 'opportunities', 'customers', 'estimates'] as const).map((tab) => (
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
            {tab === 'members' && `👥 Members (${members.length})`}
            {tab === 'opportunities' && `💼 Opportunities (${dashboard?.opportunities.total || 0})`}
            {tab === 'customers' && `🏢 Customers (${dashboard?.customers.total || 0})`}
            {tab === 'estimates' && `📋 Estimates (${dashboard?.estimates.total || 0})`}
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
                          onClick={() => {
                            if (window.confirm(`Remove ${member.first_name} ${member.last_name} from the team?`)) {
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

        {/* Opportunities Tab */}
        {activeTab === 'opportunities' && (
          <>
            <div className="sales-table-header">
              <div className="sales-table-title">Team Opportunities</div>
            </div>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Opportunity Name</th>
                  <th>Company</th>
                  <th>Facility/Location Name</th>
                  <th>Value</th>
                  <th>Stage</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
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
                      <td style={{ fontWeight: 500 }}>{opp.title}</td>
                      <td>{opp.customer_id ? (opp.customer_name || '-') : (opp.owner || '-')}</td>
                      <td>{opp.facility_customer_id ? (opp.facility_customer_name || '-') : (opp.facility_name || '-')}</td>
                      <td>{formatCurrency(opp.estimated_value || 0)}</td>
                      <td>
                        <span
                          className="sales-stage-badge"
                          style={{ background: `${opp.stage_color}20`, color: opp.stage_color }}
                        >
                          <span className="sales-stage-dot" style={{ background: opp.stage_color }}></span>
                          {opp.stage_name}
                        </span>
                      </td>
                      <td>{opp.assigned_to_name || '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: opp.priority === 'high' || opp.priority === 'urgent' ? '#fef2f2' : '#f3f4f6',
                          color: opp.priority === 'high' || opp.priority === 'urgent' ? '#ef4444' : '#6b7280',
                        }}>
                          {opp.priority || 'normal'}
                        </span>
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
                      <td style={{ fontWeight: 500 }}>{customer.customer_facility}</td>
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
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.875rem',
                  background: 'white',
                }}
              >
                <option value="">Select an employee</option>
                {availableEmployees.map((emp: Employee) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} {emp.job_title ? `- ${emp.job_title}` : ''}
                  </option>
                ))}
              </select>
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
