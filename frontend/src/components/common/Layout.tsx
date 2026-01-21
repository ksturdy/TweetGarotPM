import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ScrollToTop from './ScrollToTop';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Only show HR nav if user has HR access (not 'none') or is admin
  const hasHRAccess = user?.role === 'admin' || (user?.hrAccess && user.hrAccess !== 'none');

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/sales', label: 'Sales Pipeline' },
    { path: '/projects', label: 'Projects' },
  ];

  if (hasHRAccess) {
    navItems.push({ path: '/hr', label: 'HR' });
  }

  return (
    <div className="layout">
      <ScrollToTop />
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <div className="logo-shield">🛡️</div>
            <div className="logo-text">
              <div className="logo-titan">TITAN</div>
              <div className="logo-subtitle">BY TWEET GAROT</div>
            </div>
          </Link>
          <nav className="nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="user-menu">
            <Link to="/feedback" className="btn btn-primary btn-sm">
              Feedback
            </Link>
            <span className="user-name">
              {user?.firstName} {user?.lastName}
            </span>
            <button onClick={logout} className="btn btn-secondary btn-sm">
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
};

export default Layout;
