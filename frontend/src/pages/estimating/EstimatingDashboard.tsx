import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { estimatesApi } from '../../services/estimates';
import './EstimatingDashboard.css';

const EstimatingDashboard: React.FC = () => {
  // Fetch estimates data
  const { data: estimates } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => estimatesApi.getAll().then((res) => res.data),
  });

  // Calculate stats from estimates
  const estimateStats = {
    total: estimates?.length || 0,
    inProgress: estimates?.filter((e: any) => e.status === 'in progress').length || 0,
    submitted: estimates?.filter((e: any) => e.status === 'submitted').length || 0,
    awarded: estimates?.filter((e: any) => e.status === 'awarded').length || 0,
    lost: estimates?.filter((e: any) => e.status === 'lost').length || 0,
    cancelled: estimates?.filter((e: any) => e.status === 'cancelled').length || 0,
  };

  const totalEstimatedValue = estimates?.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0) || 0;
  const awardedEstimates = estimates?.filter((e: any) => e.status === 'awarded').length || 0;
  const totalEstimates = estimates?.length || 0;
  const winRate = totalEstimates > 0 ? Math.round((awardedEstimates / totalEstimates) * 100) : 0;

  const modules = [
    {
      name: 'Budgets',
      icon: '💰',
      path: '/estimating/budgets',
      desc: 'Track project budgets and costs',
      color: '#10b981',
      stats: { total: 0, active: 0, overbudget: 0 },
    },
    {
      name: 'Estimates',
      icon: '📋',
      path: '/estimating/estimates',
      desc: 'Create and manage project estimates',
      color: '#3b82f6',
      stats: estimateStats,
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

      {/* Mechanical Design Phases Timeline */}
      <div style={{
        margin: '1.5rem 0',
        padding: '1.25rem 2rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          position: 'relative',
          maxWidth: '1100px',
          margin: '0 auto'
        }}>
          {/* Title */}
          <h2 style={{
            color: 'white',
            textAlign: 'center',
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '1.25rem',
            marginTop: 0
          }}>Pricing Phases of Mechanical Design</h2>

          {/* Phase items container */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: '1rem',
            position: 'relative'
          }}>
            {/* Conceptual label - before line, aligned with circle center */}
            <div style={{
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600',
              minWidth: '75px',
              textAlign: 'right',
              paddingRight: '0.5rem',
              paddingTop: '20px',
              lineHeight: '1'
            }}>Conceptual</div>

            {/* Phases container with line */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              position: 'relative',
              flex: 1,
              maxWidth: '800px'
            }}>
              {/* Background gradient line through center of circles */}
              <div style={{
                position: 'absolute',
                top: '23px',
                left: '25px',
                right: '25px',
                height: '3px',
                background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.8) 100%)',
                borderRadius: '2px',
                zIndex: 0
              }}></div>

              {/* Phase items */}
              {[
                { phase: 'P1', label: 'Cost/SF', color: '#4CAF50', percent: '0%' },
                { phase: 'P2', label: 'Block and Stack', color: '#2196F3', percent: '25%' },
                { phase: 'P3', label: 'Schematic Design', color: '#FF9800', percent: '50%' },
                { phase: 'P4', label: 'Design Development', color: '#9C27B0', percent: '75%' },
                { phase: 'P5', label: 'Construction Drawings', color: '#F44336', percent: '100%' }
              ].map((item, index) => (
                <div key={item.phase} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 1,
                  flex: 1,
                  position: 'relative'
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    border: '3px solid white',
                    marginBottom: '0.4rem'
                  }}>
                    {item.phase}
                  </div>
                  <div style={{
                    color: 'white',
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    fontWeight: '500',
                    maxWidth: '110px',
                    lineHeight: '1.25',
                    marginBottom: '0.5rem',
                    height: '2.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.label}
                  </div>

                  {/* Design Completion % label - only on first item */}
                  {index === 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '0',
                      right: 'calc(100% + 8px)',
                      fontSize: '0.8rem',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      textAlign: 'right',
                      minWidth: '75px',
                      paddingRight: '0.5rem',
                      height: '1.2rem',
                      display: 'flex',
                      alignItems: 'flex-end'
                    }}>
                      Design Completion %
                    </div>
                  )}

                  <div style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    textAlign: 'center',
                    height: '1.2rem',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center'
                  }}>
                    {item.percent}
                  </div>
                </div>
              ))}
            </div>

            {/* Complete label - after line, aligned with circle center */}
            <div style={{
              fontSize: '0.85rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600',
              minWidth: '75px',
              textAlign: 'left',
              paddingLeft: '0.5rem',
              paddingTop: '20px',
              lineHeight: '1'
            }}>Complete</div>
          </div>
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
                    <div className="stat-number">{estimateStats.inProgress}</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{estimateStats.submitted}</div>
                    <div className="stat-label">Submitted</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{estimateStats.awarded}</div>
                    <div className="stat-label">Awarded</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">{estimateStats.lost}</div>
                    <div className="stat-label">Lost</div>
                  </div>
                </>
              ) : module.name === 'Budgets' ? (
                <>
                  <div className="stat-item">
                    <div className="stat-number">0</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">0</div>
                    <div className="stat-label">Active</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">0</div>
                    <div className="stat-label">Over Budget</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-item">
                    <div className="stat-number">0</div>
                    <div className="stat-label">Items</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-number">8</div>
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
              <div className="stat-value">${totalEstimatedValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              <div className="stat-label">Total Estimated Value</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">✅</div>
            <div>
              <div className="stat-value">{winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>
          </div>
          <div className="stat-card card">
            <div className="stat-icon">⏱️</div>
            <div>
              <div className="stat-value">{estimateStats.submitted}</div>
              <div className="stat-label">Submitted</div>
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
