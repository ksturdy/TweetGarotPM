import React from 'react';
import { Link } from 'react-router-dom';
import './EstimatingDashboard.css';
import '../../styles/SalesPipeline.css';

const EstimatingDashboard: React.FC = () => {
  const modules = [
    {
      name: 'Budget Generator',
      icon: '🤖',
      path: '/estimating/budget-generator',
      desc: 'AI-powered budgets from historical data',
      color: '#10b981',
      stats: { label1: 'Projects', value1: '492+', label2: 'AI Model', value2: 'Titan' },
    },
    {
      name: 'Cost Database',
      icon: '📚',
      path: '/estimating/cost-database',
      desc: 'HVAC cost item library & templates',
      color: '#8b5cf6',
      stats: { label1: 'Items', value1: '0', label2: 'Categories', value2: '8' },
    },
  ];

  return (
    <div className="estimating-dashboard">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Dashboard
            </Link>
            <h1>💰 Estimating</h1>
            <div className="sales-subtitle">Budget generation and cost management tools</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      {/* Mechanical Design Phases Timeline */}
      <div className="phase-timeline-banner">
        <h2>Pricing Phases of Mechanical Design</h2>
        <div className="phase-timeline-container">
          <div className="phase-timeline-label start">Conceptual</div>

          <div className="phase-items-container">
            <div className="phase-timeline-line"></div>

            {[
              { phase: 'P1', label: 'Cost/SF', color: '#4CAF50', percent: '0%' },
              { phase: 'P2', label: 'Block and Stack', color: '#2196F3', percent: '25%' },
              { phase: 'P3', label: 'Schematic Design', color: '#FF9800', percent: '50%' },
              { phase: 'P4', label: 'Design Development', color: '#9C27B0', percent: '75%' },
              { phase: 'P5', label: 'Construction Drawings', color: '#F44336', percent: '100%' }
            ].map((item) => (
              <div key={item.phase} className="phase-item">
                <div className="phase-circle" style={{ background: item.color }}>
                  {item.phase}
                </div>
                <div className="phase-label">{item.label}</div>
                <div className="phase-percent">{item.percent}</div>
              </div>
            ))}
          </div>

          <div className="phase-timeline-label end">Complete</div>
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
              <div className="stat-item">
                <div className="stat-number">{module.stats.value1}</div>
                <div className="stat-label">{module.stats.label1}</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{module.stats.value2}</div>
                <div className="stat-label">{module.stats.label2}</div>
              </div>
            </div>

            <div className="module-action">
              <span className="action-text">View {module.name}</span>
              <span className="action-arrow">→</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="quick-stats-section">
        <h2 className="section-title">Budget Overview</h2>
        <div className="quick-stats-grid">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <div className="stat-value">$0</div>
              <div className="stat-label">Total Budget</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-info">
              <div className="stat-value">0</div>
              <div className="stat-label">Active Budgets</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value">0</div>
              <div className="stat-label">On Track</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
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
            <p className="empty-state-hint">Start by creating a budget</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatingDashboard;
