import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { teamsApi, Team } from '../../services/teams';
import { employeesApi, Employee } from '../../services/employees';
import '../../styles/SalesPipeline.css';

const TeamList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortColumn, setSortColumn] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team_lead_id: '',
    color: '#6366f1',
    is_active: true,
  });

  // Fetch teams
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<Team[]> => {
      const response = await teamsApi.getAll();
      return response.data.data;
    },
  });

  // Fetch employees for team lead selection
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: async (): Promise<Employee[]> => {
      const response = await employeesApi.getAll();
      return response.data.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error: any) => {
      alert(`Failed to create team: ${error.response?.data?.error || error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => teamsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditingTeam(null);
      resetForm();
    },
    onError: (error: any) => {
      alert(`Failed to update team: ${error.response?.data?.error || error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: teamsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (error: any) => {
      alert(`Failed to delete team: ${error.response?.data?.error || error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      team_lead_id: '',
      color: '#6366f1',
      is_active: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description || undefined,
      team_lead_id: formData.team_lead_id ? parseInt(formData.team_lead_id) : undefined,
      color: formData.color,
      is_active: formData.is_active,
    };

    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    setFormData({
      name: team.name,
      description: team.description || '',
      team_lead_id: team.team_lead_id?.toString() || '',
      color: team.color,
      is_active: team.is_active,
    });
    setShowCreateModal(true);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this team?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter teams
  const filteredTeams = teams.filter((team: Team) => {
    const matchesSearch = !searchTerm ||
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.team_lead_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && team.is_active) ||
      (filterStatus === 'inactive' && !team.is_active);

    return matchesSearch && matchesStatus;
  });

  // Sort teams
  const sortedTeams = [...filteredTeams].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'team_lead_name':
        aValue = (a.team_lead_name || '').toLowerCase();
        bValue = (b.team_lead_name || '').toLowerCase();
        break;
      case 'member_count':
        aValue = a.member_count || 0;
        bValue = b.member_count || 0;
        break;
      case 'status':
        aValue = a.is_active ? 1 : 0;
        bValue = b.is_active ? 1 : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Color options for team
  const colorOptions = [
    { value: '#6366f1', label: 'Indigo' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
  ];

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading teams...</div>
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
            <Link to="/account-management" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Account Management
            </Link>
            <h1>👥 Teams</h1>
            <div className="sales-subtitle">Manage sales and project teams</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => {
              setEditingTeam(null);
              resetForm();
              setShowCreateModal(true);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Team
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', width: '36px', height: '36px', fontSize: '1rem' }}>👥</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{teams.length}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Total Teams</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', width: '36px', height: '36px', fontSize: '1rem' }}>✅</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{teams.filter((t: Team) => t.is_active).length}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Active Teams</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', width: '36px', height: '36px', fontSize: '1rem' }}>👤</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{teams.reduce((sum: number, t: Team) => sum + (t.member_count || 0), 0)}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Total Members</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', width: '36px', height: '36px', fontSize: '1rem' }}>📊</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>
              {teams.length > 0 ? Math.round(teams.reduce((sum: number, t: Team) => sum + (t.member_count || 0), 0) / teams.length) : 0}
            </div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Avg Team Size</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Teams</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="sales-filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}></th>
              <th className="sales-sortable" onClick={() => handleSort('name')}>
                Team Name <span className="sales-sort-icon">{sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th>Description</th>
              <th className="sales-sortable" onClick={() => handleSort('team_lead_name')}>
                Team Lead <span className="sales-sort-icon">{sortColumn === 'team_lead_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('member_count')}>
                Members <span className="sales-sort-icon">{sortColumn === 'member_count' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>
                Status <span className="sales-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.length > 0 ? (
              sortedTeams.map((team) => (
                <tr
                  key={team.id}
                  onClick={() => navigate(`/account-management/teams/${team.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: team.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{team.name}</div>
                  </td>
                  <td style={{ color: '#6b7280' }}>{team.description || '-'}</td>
                  <td>
                    {team.team_lead_name ? (
                      <div className="sales-salesperson-cell">
                        <div
                          className="sales-salesperson-avatar"
                          style={{ background: team.color }}
                        >
                          {team.team_lead_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        {team.team_lead_name}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>No lead assigned</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      background: 'rgba(99, 102, 241, 0.1)',
                      color: '#6366f1',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                    }}>
                      👤 {team.member_count || 0}
                    </span>
                  </td>
                  <td>
                    <span className={`sales-stage-badge ${team.is_active ? 'active' : 'inactive'}`}>
                      <span className="sales-stage-dot" style={{ background: team.is_active ? '#10b981' : '#6b7280' }}></span>
                      {team.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => handleEdit(team, e)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                          background: 'white',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDelete(team.id, e)}
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
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  <div>
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.4 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No teams found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Create your first team to get started'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Team Modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px' }}>
              {editingTeam ? 'Edit Team' : 'Create New Team'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>
                  Team Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                  }}
                  placeholder="Enter team name"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                  placeholder="Enter team description"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>
                  Team Lead
                </label>
                <select
                  value={formData.team_lead_id}
                  onChange={(e) => setFormData({ ...formData, team_lead_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.875rem',
                    background: 'white',
                  }}
                >
                  <option value="">Select team lead</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} {emp.job_title ? `- ${emp.job_title}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#374151' }}>
                  Team Color
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: color.value,
                        border: formData.color === color.value ? '3px solid #1f2937' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                      }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontWeight: 500, color: '#374151' }}>Active Team</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTeam(null);
                    resetForm();
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
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6366f1',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingTeam
                    ? 'Update Team'
                    : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamList;
