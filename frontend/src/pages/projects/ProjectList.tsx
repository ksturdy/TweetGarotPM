import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, Project } from '../../services/projects';

const ProjectList: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [projectNameFilter, setProjectNameFilter] = useState<string>('');
  const [pmFilter, setPmFilter] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Project | 'manager_name'>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: allProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  // Client-side filtering
  const filteredProjects = allProjects?.filter((project: Project) => {
    if (statusFilter && project.status !== statusFilter) return false;
    if (clientFilter && !project.client?.toLowerCase().includes(clientFilter.toLowerCase())) return false;
    if (projectNameFilter && !project.name?.toLowerCase().includes(projectNameFilter.toLowerCase())) return false;
    if (pmFilter && !project.manager_name?.toLowerCase().includes(pmFilter.toLowerCase())) return false;
    return true;
  });

  // Client-side sorting
  const projects = filteredProjects?.sort((a, b) => {
    let aValue = a[sortField as keyof Project];
    let bValue = b[sortField as keyof Project];

    // Handle null/undefined values
    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';

    // Convert to lowercase for string comparison
    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
    if (typeof bValue === 'string') bValue = bValue.toLowerCase();

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof Project | 'manager_name') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Project | 'manager_name') => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      on_hold: 'badge-warning',
      completed: 'badge-info',
      cancelled: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Projects</h1>
        <Link to="/projects/new" className="btn btn-primary">
          New Project
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Status</label>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Client</label>
            <input
              type="text"
              className="form-input"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder="Search client..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by Project Name</label>
            <input
              type="text"
              className="form-input"
              value={projectNameFilter}
              onChange={(e) => setProjectNameFilter(e.target.value)}
              placeholder="Search project name..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Filter by PM</label>
            <input
              type="text"
              className="form-input"
              value={pmFilter}
              onChange={(e) => setPmFilter(e.target.value)}
              placeholder="Search PM..."
            />
          </div>
        </div>
      </div>

      <div className="card">
        <table className="table" style={{ tableLayout: 'auto' }}>
          <colgroup>
            <col style={{ width: '120px' }} />
            <col style={{ width: 'auto', minWidth: '200px' }} />
            <col style={{ width: 'auto', minWidth: '200px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '150px' }} />
          </colgroup>
          <thead>
            <tr>
              <th
                onClick={() => handleSort('number')}
                style={{ cursor: 'pointer', userSelect: 'none', resize: 'horizontal', overflow: 'hidden' }}
              >
                Number{getSortIcon('number')}
              </th>
              <th
                onClick={() => handleSort('name')}
                style={{ cursor: 'pointer', userSelect: 'none', resize: 'horizontal', overflow: 'hidden' }}
              >
                Project Name{getSortIcon('name')}
              </th>
              <th
                onClick={() => handleSort('client')}
                style={{ cursor: 'pointer', userSelect: 'none', resize: 'horizontal', overflow: 'hidden' }}
              >
                Client{getSortIcon('client')}
              </th>
              <th
                onClick={() => handleSort('status')}
                style={{ cursor: 'pointer', userSelect: 'none', resize: 'horizontal', overflow: 'hidden' }}
              >
                Status{getSortIcon('status')}
              </th>
              <th
                onClick={() => handleSort('manager_name')}
                style={{ cursor: 'pointer', userSelect: 'none', resize: 'horizontal', overflow: 'hidden' }}
              >
                PM{getSortIcon('manager_name')}
              </th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((project: Project) => (
              <tr key={project.id}>
                <td>
                  <Link to={`/projects/${project.id}`}>{project.number}</Link>
                </td>
                <td>
                  <Link to={`/projects/${project.id}`}>{project.name}</Link>
                </td>
                <td>{project.client}</td>
                <td>
                  <span className={getStatusBadge(project.status)}>
                    {project.status.replace('_', ' ')}
                  </span>
                </td>
                <td>{project.manager_name || '-'}</td>
              </tr>
            ))}
            {projects?.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No projects found
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
