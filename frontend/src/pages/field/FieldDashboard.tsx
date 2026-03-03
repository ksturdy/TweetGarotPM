import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import api from '../../services/api';

interface Project {
  id: number;
  name: string;
  number: string;
  status: string;
  client: string;
}

const FieldDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get<Project[]>('/projects');
      return res.data;
    },
  });

  const activeProjects = projects.filter(p =>
    p.status === 'active' || p.status === 'in_progress' || p.status === 'Open'
  );

  const filtered = search
    ? activeProjects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.number.toLowerCase().includes(search.toLowerCase()) ||
        (p.client && p.client.toLowerCase().includes(search.toLowerCase()))
      )
    : activeProjects;

  if (isLoading) {
    return <div className="field-loading">Loading projects...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Select a Job</h1>
      <p className="field-page-subtitle">Choose a project to access field tools</p>

      <div className="field-search">
        <SearchIcon className="field-search-icon" />
        <input
          type="text"
          className="field-search-input"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.map(project => (
        <div
          key={project.id}
          className="field-card"
          onClick={() => navigate(`/field/projects/${project.id}`)}
        >
          <div className="field-card-header">
            <div>
              <div className="field-card-number">{project.number}</div>
              <div className="field-card-title">{project.name}</div>
            </div>
            <FolderIcon style={{ color: '#6b7280', fontSize: 20 }} />
          </div>
          {project.client && (
            <div className="field-card-subtitle">{project.client}</div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="field-empty">
          <FolderIcon />
          <div className="field-empty-title">No projects found</div>
          <div className="field-empty-text">
            {search ? 'Try a different search term' : 'No active projects available'}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldDashboard;
