import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import GrainIcon from '@mui/icons-material/Grain';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import api from '../../services/api';
import { favoritesService } from '../../services/favorites';
import { useAuth } from '../../context/AuthContext';

interface Project {
  id: number;
  name: string;
  number: string;
  status: string;
  client: string;
}

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
}

const getWeatherIcon = (icon: string) => {
  if (icon.includes('01') || icon.includes('02')) return <WbSunnyIcon />;
  if (icon.includes('09') || icon.includes('10')) return <GrainIcon />;
  if (icon.includes('11')) return <ThunderstormIcon />;
  if (icon.includes('13')) return <AcUnitIcon />;
  return <CloudIcon />;
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const FieldDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Fetch weather based on user's location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=0c67e87767e7e64e9c1ce88f1a3e3c9c`
          );
          if (res.ok) {
            const data = await res.json();
            setWeather({
              temp: Math.round(data.main.temp),
              description: data.weather[0].description,
              icon: data.weather[0].icon,
              city: data.name,
            });
          }
        } catch {
          // Weather is non-critical
        }
      },
      () => {},
      { timeout: 5000 }
    );
  }, []);

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
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2332 0%, #2a3f5f 100%)',
        borderRadius: 12,
        padding: '20px 18px',
        marginBottom: 16,
        color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {getGreeting()}, {user?.firstName || 'there'}
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
              {dateStr}
            </div>
          </div>
          {weather && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '8px 12px',
            }}>
              <span style={{ display: 'flex', fontSize: 22, opacity: 0.9 }}>
                {getWeatherIcon(weather.icon)}
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>
                  {weather.temp}&deg;F
                </div>
                <div style={{ fontSize: 10, opacity: 0.7, textTransform: 'capitalize' }}>
                  {weather.city}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Getting Started */}
      <div style={{
        background: '#f0f7ff',
        border: '1px solid #bfdbfe',
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 16,
        fontSize: 13,
        color: '#1e40af',
        lineHeight: 1.5,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
          Getting Started
        </div>
        Select a job below to access daily reports, purchase orders, fitting orders, and safety JSAs. Star your frequent jobs for quick access.
      </div>

      {/* Search */}
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
