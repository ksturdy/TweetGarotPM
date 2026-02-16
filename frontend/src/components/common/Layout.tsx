import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ScrollToTop from './ScrollToTop';
import Sidebar from './Sidebar';
import TitanChat from './TitanChat';
import FeedbackIcon from '@mui/icons-material/Feedback';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, tenant, logout } = useAuth();

  // Get tenant branding
  const logoUrl = tenant?.settings?.branding?.logo_url;
  const companyName = tenant?.settings?.branding?.company_name || tenant?.name;

  return (
    <div className="layout">
      <ScrollToTop />
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="logo-default">
              <div className="logo-shield">
                <svg width="32" height="36" viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 2L2 8V16C2 24.8 8.2 32.8 16 35C23.8 32.8 30 24.8 30 16V8L16 2Z" fill="url(#shield-gradient)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                  <defs>
                    <linearGradient id="shield-gradient" x1="2" y1="2" x2="30" y2="35" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#4A90E2"/>
                      <stop offset="50%" stopColor="#5CA3F5"/>
                      <stop offset="100%" stopColor="#4A90E2"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="logo-text">
                <div className="logo-titan">TITAN</div>
              </div>
            </Link>
            <Link to="/feedback" className="header-feedback-btn" title="Send Feedback">
              <FeedbackIcon fontSize="small" />
              <span>Feedback</span>
            </Link>
          </div>
          <div className="header-center">
            <TitanChat />
          </div>
          <div className="header-right">
            <div className="user-menu">
              <span className="user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <button onClick={logout} className="btn btn-header btn-sm">
                Logout
              </button>
            </div>
            {logoUrl && (
              <img src={logoUrl} alt={companyName || 'Company logo'} className="company-logo-image" />
            )}
          </div>
        </div>
      </header>
      <div className="layout-body">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
