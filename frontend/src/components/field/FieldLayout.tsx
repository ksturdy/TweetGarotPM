import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BuildIcon from '@mui/icons-material/Build';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import HomeIcon from '@mui/icons-material/Home';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
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
      // Already on field dashboard — nowhere to go back to
      return;
    }
    const pathParts = currentPath.split('/');
    // If we're on a detail/form page, go back to the list
    if (pathParts.length > 5) {
      navigate(pathParts.slice(0, 5).join('/'));
    } else if (pathParts.length > 4) {
      navigate(`/field/projects/${projectId}`);
    } else {
      navigate('/field');
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
          {isProjectSelected && (
            <button className="field-header-back" onClick={handleBack}>
              <ArrowBackIcon style={{ fontSize: 20 }} />
            </button>
          )}
          {isProjectSelected && project ? (
            <span className="field-header-title">{project.number} - {project.name}</span>
          ) : (
            <span className="field-header-brand">
              <svg className="field-header-shield" width="24" height="28" viewBox="0 0 32 36" fill="none">
                <path d="M16 2L2 8V16C2 24.8 8.2 32.8 16 35V2Z" fill="#3B7DD8"/>
                <path d="M16 2L30 8V16C30 24.8 23.8 32.8 16 35V2Z" fill="#7CB8F2"/>
                <path d="M16 2L2 8V16C2 24.8 8.2 32.8 16 35C23.8 32.8 30 24.8 30 16V8L16 2Z" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"/>
              </svg>
              <span className="field-header-brand-text">TITAN <span className="field-header-brand-sub">FIELD</span></span>
            </span>
          )}
        </div>
        <div className="field-header-right">
          {isProjectSelected ? (
            <button className="field-project-selector field-header-switch" onClick={() => navigate('/field')}>
              Switch Job
            </button>
          ) : (
            <button className="field-project-selector field-header-switch" onClick={() => navigate('/')}>
              Main App
            </button>
          )}
        </div>
      </header>

      <div className="field-body">
        {isProjectSelected && (
          <aside className="field-sidebar">
            <button className={`field-sidebar-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => navigate(`/field/projects/${projectId}`)}>
              <HomeIcon />
              <span className="field-sidebar-label">Home</span>
            </button>
            <button className={`field-sidebar-item ${activeTab === 'daily-reports' ? 'active' : ''}`} onClick={() => navTo('daily-reports')}>
              <DescriptionIcon />
              <span className="field-sidebar-label">Daily Reports</span>
            </button>
            <button className={`field-sidebar-item ${activeTab === 'purchase-orders' ? 'active' : ''}`} onClick={() => navTo('purchase-orders')}>
              <ShoppingCartIcon />
              <span className="field-sidebar-label">POs</span>
            </button>
            <button className={`field-sidebar-item ${activeTab === 'fitting' ? 'active' : ''}`} onClick={() => navigate(`/field/projects/${projectId}`)}>
              <BuildIcon />
              <span className="field-sidebar-label">Fitting</span>
            </button>
            <button className={`field-sidebar-item ${activeTab === 'safety' ? 'active' : ''}`} onClick={() => navTo('safety-jsa')}>
              <HealthAndSafetyIcon />
              <span className="field-sidebar-label">Safety</span>
            </button>
            <div className="field-sidebar-spacer" />
            <button className="field-sidebar-item field-sidebar-switch" onClick={() => navigate('/field')}>
              <SwapHorizIcon />
              <span className="field-sidebar-label">Switch Job</span>
            </button>
          </aside>
        )}

        <main className="field-content">
          <Outlet />
        </main>
      </div>

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
