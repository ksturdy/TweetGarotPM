import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BuildIcon from '@mui/icons-material/Build';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import HomeIcon from '@mui/icons-material/Home';
import api from '../../services/api';
import '../../styles/Field.css';

interface Project {
  id: number;
  name: string;
  number: string;
}

const FieldLayout: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Swap manifest so "Add to Home Screen" on iOS saves /field as the start URL
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const original = link?.getAttribute('href') || '';
    link?.setAttribute('href', '/manifest-field.json');
    // Also update apple-mobile-web-app-title for the home screen name
    const titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const originalTitle = titleMeta?.getAttribute('content') || '';
    titleMeta?.setAttribute('content', 'Titan Field');
    return () => {
      link?.setAttribute('href', original);
      titleMeta?.setAttribute('content', originalTitle);
    };
  }, []);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.get<Project>(`/projects/${projectId}`);
      return res.data;
    },
    enabled: !!projectId,
  });

  const isProjectSelected = !!projectId;
  const currentPath = location.pathname;

  const getActiveTab = () => {
    if (currentPath.includes('/daily-reports')) return 'daily-reports';
    if (currentPath.includes('/purchase-orders')) return 'purchase-orders';
    if (currentPath.includes('/fitting-orders') || currentPath.includes('sm-fitting') || currentPath.includes('piping-fitting') || currentPath.includes('plumbing-fitting')) return 'fitting';
    if (currentPath.includes('/safety-jsa')) return 'safety';
    return 'home';
  };

  const activeTab = getActiveTab();

  const handleBack = () => {
    if (!isProjectSelected) {
      navigate('/');
    } else {
      const pathParts = currentPath.split('/');
      // If we're on a detail/form page, go back to the list
      if (pathParts.length > 5) {
        navigate(pathParts.slice(0, 5).join('/'));
      } else if (pathParts.length > 4) {
        navigate(`/field/projects/${projectId}`);
      } else {
        navigate('/field');
      }
    }
  };

  const navTo = (path: string) => {
    if (!projectId) return;
    navigate(`/field/projects/${projectId}/${path}`);
  };

  return (
    <div className="field-container">
      <header className="field-header">
        <div className="field-header-left">
          <button className="field-header-back" onClick={handleBack}>
            <ArrowBackIcon style={{ fontSize: 20 }} />
          </button>
          {isProjectSelected && project ? (
            <span className="field-header-title">{project.number} - {project.name}</span>
          ) : (
            <span className="field-header-brand">TITAN FIELD</span>
          )}
        </div>
        <div className="field-header-right">
          {isProjectSelected && (
            <button className="field-project-selector" onClick={() => navigate('/field')}>
              Switch Job
            </button>
          )}
        </div>
      </header>

      <main className="field-content">
        <Outlet />
      </main>

      {isProjectSelected && (
        <nav className="field-bottom-nav">
          <button className={`field-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => navigate(`/field/projects/${projectId}`)}>
            <HomeIcon />
            <span>Home</span>
          </button>
          <button className={`field-nav-item ${activeTab === 'daily-reports' ? 'active' : ''}`} onClick={() => navTo('daily-reports')}>
            <DescriptionIcon />
            <span>Daily</span>
          </button>
          <button className={`field-nav-item ${activeTab === 'purchase-orders' ? 'active' : ''}`} onClick={() => navTo('purchase-orders')}>
            <ShoppingCartIcon />
            <span>POs</span>
          </button>
          <button className={`field-nav-item ${activeTab === 'fitting' ? 'active' : ''}`} onClick={() => navigate(`/field/projects/${projectId}`)}>
            <BuildIcon />
            <span>Fitting</span>
          </button>
          <button className={`field-nav-item ${activeTab === 'safety' ? 'active' : ''}`} onClick={() => navTo('safety-jsa')}>
            <HealthAndSafetyIcon />
            <span>Safety</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default FieldLayout;
