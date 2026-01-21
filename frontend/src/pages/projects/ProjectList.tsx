import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, Project } from '../../services/projects';
import '../../styles/SalesPipeline.css';

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

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

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      active: '#10b981',
      on_hold: '#f59e0b',
      completed: '#3b82f6',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  // Helper function to get project icon based on status
  const getProjectIcon = (status: string): string => {
    const icons: { [key: string]: string } = {
      active: '🏗️',
      on_hold: '⏸️',
      completed: '✅',
      cancelled: '❌'
    };
    return icons[status] || '📋';
  };

  // Helper function to get project gradient based on status
  const getProjectGradient = (status: string): string => {
    const gradients: { [key: string]: string } = {
      active: 'linear-gradient(135deg, #10b981, #06b6d4)',
      on_hold: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
      completed: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      cancelled: 'linear-gradient(135deg, #ef4444, #dc2626)'
    };
    return gradients[status] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
  };

  // Helper function to get manager initials
  const getManagerInitials = (name?: string): string => {
    if (!name) return 'UN';
    return name.split(' ').map(n => n[0]).join('');
  };

  // Helper function to get manager color
  const getManagerColor = (name: string): string => {
    const colors = [
      '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Filter projects based on search term
  const filteredProjects = (projects || []).filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.client && project.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (project.manager_name && project.manager_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'number':
        aValue = a.number.toLowerCase();
        bValue = b.number.toLowerCase();
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'client':
        aValue = (a.client || '').toLowerCase();
        bValue = (b.client || '').toLowerCase();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'manager':
        aValue = (a.manager_name || '').toLowerCase();
        bValue = (b.manager_name || '').toLowerCase();
        break;
      case 'start_date':
        aValue = a.start_date ? new Date(a.start_date).getTime() : 0;
        bValue = b.start_date ? new Date(b.start_date).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading projects...</div>
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
            <h1>📊 Projects</h1>
            <div className="sales-subtitle">Manage construction projects and tracking</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => navigate('/projects/new')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Projects</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="sales-filter-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter
            </button>
          </div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('start_date')}>
                Start Date <span className="sales-sort-icon">{sortColumn === 'start_date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('name')}>
                Project <span className="sales-sort-icon">{sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('client')}>
                Client <span className="sales-sort-icon">{sortColumn === 'client' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('number')}>
                Number <span className="sales-sort-icon">{sortColumn === 'number' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>
                Status <span className="sales-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('manager')}>
                Project Manager <span className="sales-sort-icon">{sortColumn === 'manager' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.length > 0 ? (
              sortedProjects.map((project: Project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{project.start_date ? new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: project.market ? getMarketGradient(project.market) : getProjectGradient(project.status) }}>
                        {project.market ? getMarketIcon(project.market) : getProjectIcon(project.status)}
                      </div>
                      <div className="sales-project-info">
                        <h4>{project.name}</h4>
                        <span>{project.address || 'No address specified'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{project.client || '-'}</td>
                  <td>{project.number}</td>
                  <td>
                    <span className={`sales-stage-badge ${project.status}`}>
                      <span className="sales-stage-dot" style={{ background: getStatusColor(project.status) }}></span>
                      {project.status.replace('_', ' ').charAt(0).toUpperCase() + project.status.replace('_', ' ').slice(1)}
                    </span>
                  </td>
                  <td>
                    <div className="sales-salesperson-cell">
                      <div
                        className="sales-salesperson-avatar"
                        style={{ background: getManagerColor(project.manager_name || 'Unassigned') }}
                      >
                        {getManagerInitials(project.manager_name)}
                      </div>
                      {project.manager_name || 'Unassigned'}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  <div>
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ margin: '0 auto 16px', opacity: 0.4 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No projects found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first project'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectList;
