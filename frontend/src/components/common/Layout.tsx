import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ScrollToTop from './ScrollToTop';
import Sidebar from './Sidebar';
import TitanChat from './TitanChat';
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
              <div className="logo-shield">🛡️</div>
              <div className="logo-text">
                <div className="logo-titan">TITAN</div>
              </div>
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
