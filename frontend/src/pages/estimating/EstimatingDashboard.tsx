import React from 'react';
import { Link } from 'react-router-dom';
import './EstimatingDashboard.css';

const EstimatingDashboard: React.FC = () => {
  const modules = [
    {
      name: 'Estimates',
      icon: '📋',
      path: '/estimating/estimates',
      desc: 'Create and manage project estimates',
      color: '#3b82f6',
      stats: { total: 0, draft: 0, pending: 0, approved: 0 },
    },
    {
      name: 'Budgets',
      icon: '💰',
      path: '/estimating/budgets',
      desc: 'Track project budgets and costs',
      color: '#10b981',
      stats: { total: 0, active: 0, overbudget: 0 },
    },
    {
      name: 'Cost Database',
      icon: '📚',
      path: '/estimating/cost-database',
      desc: 'HVAC cost item library & templates',
      color: '#8b5cf6',
      stats: { total: 0, categories: 8 },
    },
  ];

  return (
    <div className="estimating-dashboard">
      <div className="page-header">
        <div>
          <Link to="/" className="breadcrumb-link">&larr; Back to Dashboard</Link>
          <h1 className="page-title">Estimating</h1>
          <p className="page-subtitle">Manage estimates and budgets for your projects</p>
        </div>
      </div>

      <div className="estimating-modules-grid">
        {modules.map((module) => (
          <Link
            key={module.name}
            to={module.path}
            className="estimating-module-card"
            style={{ '--module-color': module.color } as React.CSSProperties}
          >
            <div className="module-header">
              <div className="module-icon-large">{module.icon}</div>
              <div>
                <h2 className="module-title">{module.name}</h2>
                <p className="module-description">{module.desc}</p>
              </div>
            </div>

            <div className="module-stats">
              {module.name === 'Estimates' ? (
                <>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.total}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.draft}</div>
                    <div className="stat-label">Draft</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.pending}</div>
                    <div className="stat-label">Pending</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.approved}</div>
                    <div className="stat-label">Approved</div>
                  </div>
                </>
              ) : module.name === 'Budgets' ? (
                <>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.total}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.active}</div>
                    <div className="stat-label">Active</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.overbudget}</div>
                    <div className="stat-label">Over Budget</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.total}</div>
                    <div className="stat-label">Items</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{module.stats.categories}</div>
                    <div className="stat-label">Categories</div>
                  </div>
                </>
              )}
            </div>

            <div className="module-action">
              <span className="action-text">View {module.name}</span>
              <span className="action-arrow">→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="quick-stats-section">
        <h2 className="section-title">Quick Stats</h2>
        <div className="quick-stats-grid">
          <div className="stat-card card">
            <div className="stat-icon">📊</div>
            <div>
              <div className="stat-value">$0</div>
              <div className="stat-label">Total Estimated Value</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">✅</div>
            <div>
              <div className="stat-value">0%</div>
              <div className="stat-label">Win Rate</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">⏱️</div>
            <div>
              <div className="stat-value">0</div>
              <div className="stat-label">Pending Approval</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">📈</div>
            <div>
              <div className="stat-value">$0</div>
              <div className="stat-label">Budget Variance</div>
            </div>
          </div>
        </div>
      </div>

      <div className="recent-activity-section">
        <h2 className="section-title">Recent Activity</h2>
        <div className="card">
          <div className="empty-state">
            <p>No recent activity</p>
            <p className="empty-state-hint">Start by creating an estimate or budget</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatingDashboard;
