import React from 'react';
import { Link } from 'react-router-dom';
import './AccountManagementList.css';
import '../../styles/SalesPipeline.css';

const AccountManagementList: React.FC = () => {
  const modules = [
    {
      name: 'Teams',
      icon: '👥',
      path: '/account-management/teams',
      desc: 'Manage sales and project teams',
      color: '#6366f1',
    },
    {
      name: 'Customers',
      icon: '👥',
      path: '/account-management/customers',
      desc: 'Accounts Receivable',
      color: '#3b82f6',
    },
    {
      name: 'Vendors & Subcontractors',
      icon: '🏗️',
      path: '/account-management/vendors',
      desc: 'Accounts Payable',
      color: '#f97316',
    },
    {
      name: 'Contacts',
      icon: '📇',
      path: '/account-management/contacts',
      desc: 'Individual contact management',
      color: '#8b5cf6',
    },
    {
      name: 'Sales Pipeline',
      icon: '💰',
      path: '/sales',
      desc: 'Track sales opportunities',
      color: '#10b981',
      comingSoon: false,
    },
    {
      name: 'Account Reports',
      icon: '📈',
      path: '/account-management/reports',
      desc: 'Account performance and analytics',
      color: '#f59e0b',
      comingSoon: true,
    },
  ];

  return (
    <div className="account-management-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Dashboard
            </Link>
            <h1>🏢 Account Management</h1>
            <div className="sales-subtitle">Manage customers, teams, and vendors</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      <div className="account-management-grid">
        {modules.map((module) => (
          <Link
            key={module.name}
            to={module.comingSoon ? '#' : module.path}
            className={`account-management-card ${module.comingSoon ? 'coming-soon' : ''}`}
            style={{ '--module-color': module.color } as React.CSSProperties}
            onClick={(e) => module.comingSoon && e.preventDefault()}
          >
            <div className="module-icon-wrapper">
              <div className="module-icon">{module.icon}</div>
            </div>
            <div className="module-content">
              <h3 className="module-name">{module.name}</h3>
              <p className="module-desc">{module.desc}</p>
              {module.comingSoon && <span className="coming-soon-badge">Coming Soon</span>}
            </div>
            {!module.comingSoon && <div className="module-arrow">→</div>}
          </Link>
        ))}
      </div>

      <div className="account-stats">
        <div className="stat-card card">
          <div className="stat-icon">🎯</div>
          <div>
            <div className="stat-value">6</div>
            <div className="stat-label">Total Modules</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-value">5</div>
            <div className="stat-label">Active Modules</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">🚀</div>
          <div>
            <div className="stat-value">1</div>
            <div className="stat-label">Coming Soon</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManagementList;
