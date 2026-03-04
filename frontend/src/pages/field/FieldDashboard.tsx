import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import api from '../../services/api';
import { favoritesService } from '../../services/favorites';

interface Project {
  id: number;
  name: string;
  number: string;
  status: string;
  client: string;
}

const FieldDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.get<Project[]>('/projects');
      return res.data;
    },
  });

  const { data: favoritedIds = [] } = useQuery({
    queryKey: ['favorites', 'project'],
    queryFn: () => favoritesService.getFavoritedIds('project'),
  });

  const toggleFavorite = useMutation({
    mutationFn: (projectId: number) => favoritesService.toggle('project', projectId),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', 'project'] });
      const previous = queryClient.getQueryData<number[]>(['favorites', 'project']) || [];
      const updated = previous.includes(projectId)
        ? previous.filter(id => id !== projectId)
        : [...previous, projectId];
      queryClient.setQueryData(['favorites', 'project'], updated);
      return { previous };
    },
    onError: (_err, _projectId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites', 'project'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', 'project'] });
    },
  });

  const activeProjects = projects.filter(p =>
    p.status === 'active' || p.status === 'in_progress' || p.status === 'Open'
  );

  const filtered = useMemo(() => {
    let list = activeProjects;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.number.toLowerCase().includes(s) ||
        (p.client && p.client.toLowerCase().includes(s))
      );
    }
    return list.sort((a, b) => {
      const aFav = favoritedIds.includes(a.id) ? 1 : 0;
      const bFav = favoritedIds.includes(b.id) ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav;
      return b.number.localeCompare(a.number);
    });
  }, [activeProjects, search, favoritedIds]);

  if (isLoading) {
    return <div className="field-loading">Loading projects...</div>;
  }

  const hasFavorites = filtered.some(p => favoritedIds.includes(p.id));

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

      {filtered.map((project, index) => {
        const isFav = favoritedIds.includes(project.id);
        const showDivider = hasFavorites && !isFav && index > 0 && favoritedIds.includes(filtered[index - 1].id);

        return (
          <React.Fragment key={project.id}>
            {showDivider && (
              <div style={{ borderTop: '2px solid #e5e7eb', margin: '8px 0' }} />
            )}
            <div
              className="field-card"
              onClick={() => navigate(`/field/projects/${project.id}`)}
              style={isFav ? { borderLeft: '3px solid #f59e0b' } : undefined}
            >
              <div className="field-card-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="field-card-number">{project.number}</div>
                  <div className="field-card-title">{project.name}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate(project.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFav ? (
                    <StarIcon style={{ color: '#f59e0b', fontSize: 22 }} />
                  ) : (
                    <StarBorderIcon style={{ color: '#d1d5db', fontSize: 22 }} />
                  )}
                </button>
              </div>
              {project.client && (
                <div className="field-card-subtitle">{project.client}</div>
              )}
            </div>
          </React.Fragment>
        );
      })}

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
