import React from 'react';
import { Link } from 'react-router-dom';
import './AccountManagementList.css';

const AccountManagementList: React.FC = () => {
  const modules = [
    {
      name: 'Customer List',
      icon: '👥',
      path: '/account-management/customers',
      desc: 'Manage customer database and contacts',
      color: '#3b82f6',
    },
    {
      name: 'Contacts',
      icon: '📇',
      path: '/account-management/contacts',
      desc: 'Individual contact management',
      color: '#8b5cf6',
      comingSoon: true,
    },
    {
      name: 'Sales Pipeline',
      icon: '📊',
      path: '/account-management/pipeline',
      desc: 'Track sales opportunities',
      color: '#10b981',
      comingSoon: true,
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
      <div className="page-header">
        <div>
          <Link to="/" className="breadcrumb-link">&larr; Back to Dashboard</Link>
          <h1 className="page-title">Account Management</h1>
          <p className="page-subtitle">Manage customer relationships and sales activities</p>
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
            <div className="stat-value">4</div>
            <div className="stat-label">Total Modules</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-value">1</div>
            <div className="stat-label">Active Modules</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">🚀</div>
          <div>
            <div className="stat-value">3</div>
            <div className="stat-label">Coming Soon</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManagementList;
