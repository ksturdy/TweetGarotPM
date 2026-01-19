import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractReviewsApi } from '../../services/contractReviews';
import './RiskManagementDashboard.css';

const RiskManagementDashboard: React.FC = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['contractReviewStats'],
    queryFn: () => contractReviewsApi.getStats().then((res) => res.data),
  });

  const { data: recentReviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['contractReviews', 'recent'],
    queryFn: () => contractReviewsApi.getAll().then((res) => res.data.slice(0, 5)),
  });

  const { data: pendingReviews, isLoading: pendingLoading } = useQuery({
    queryKey: ['contractReviews', 'pending'],
    queryFn: () =>
      contractReviewsApi.getAll({ status: 'pending' }).then((res) => res.data.slice(0, 5)),
  });

  const isLoading = statsLoading || reviewsLoading || pendingLoading;

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="risk-dashboard">
      <div className="page-header">
        <h1>Risk Management</h1>
        <p>Contract review and risk analysis</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <div className="stat-label">Total Reviews</div>
            <div className="stat-value">{stats?.total || 0}</div>
          </div>
        </div>

        <div className="stat-card yellow">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-label">Pending Review</div>
            <div className="stat-value">{stats?.pending || 0}</div>
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-label">High Risk</div>
            <div className="stat-value">{stats?.high_risk || 0}</div>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-label">Approved</div>
            <div className="stat-value">{stats?.approved || 0}</div>
          </div>
        </div>
      </div>

      {/* Module Navigation */}
      <div className="modules-section">
        <h2>Risk Management Modules</h2>
        <div className="modules-grid">
          <Link to="/risk-management/contract-reviews" className="module-card ready">
            <div className="module-icon">📄</div>
            <h3>Contract Reviews</h3>
            <p>AI-powered contract risk analysis</p>
            <div className="module-badge">{stats?.total || 0} Reviews</div>
          </Link>

          <div className="module-card disabled">
            <span className="coming-soon">Coming Soon</span>
            <div className="module-icon">📊</div>
            <h3>Risk Register</h3>
            <p>Project risk tracking and mitigation</p>
          </div>

          <div className="module-card disabled">
            <span className="coming-soon">Coming Soon</span>
            <div className="module-icon">🛡️</div>
            <h3>Insurance Tracking</h3>
            <p>Certificate and policy management</p>
          </div>

          <div className="module-card disabled">
            <span className="coming-soon">Coming Soon</span>
            <div className="module-icon">⚖️</div>
            <h3>Claims Management</h3>
            <p>Track and manage legal claims</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-content">
        <div className="dashboard-column">
          <div className="card">
            <div className="card-header">
              <h3>Recent Contract Reviews</h3>
              <Link to="/risk-management/contract-reviews" className="btn btn-sm btn-secondary">
                View All
              </Link>
            </div>
            <div className="card-body">
              {!recentReviews || recentReviews.length === 0 ? (
                <div className="empty-state">
                  <p>No contract reviews yet</p>
                  <Link to="/risk-management/contract-reviews/upload" className="btn btn-primary">
                    Upload Contract
                  </Link>
                </div>
              ) : (
                <div className="review-list">
                  {recentReviews.map((review: any) => (
                    <Link
                      key={review.id}
                      to={`/risk-management/contract-reviews/${review.id}`}
                      className="review-item"
                    >
                      <div className="review-info">
                        <div className="review-name">{review.file_name}</div>
                        <div className="review-meta">
                          {review.project_name && (
                            <span className="review-project">{review.project_name}</span>
                          )}
                          {review.contract_value && (
                            <span className="review-value">
                              ${review.contract_value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="review-badges">
                        {review.overall_risk && (
                          <span className={`badge risk-${review.overall_risk.toLowerCase()}`}>
                            {review.overall_risk}
                          </span>
                        )}
                        <span className={`badge status-${review.status}`}>{review.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-column">
          <div className="card">
            <div className="card-header">
              <h3>Pending Legal Review</h3>
              {stats && stats.needs_legal_review > 0 && (
                <span className="badge badge-warning">{stats.needs_legal_review}</span>
              )}
            </div>
            <div className="card-body">
              {!pendingReviews || pendingReviews.length === 0 ? (
                <div className="empty-state">
                  <p>No pending reviews</p>
                </div>
              ) : (
                <div className="review-list">
                  {pendingReviews.map((review: any) => (
                    <Link
                      key={review.id}
                      to={`/risk-management/contract-reviews/${review.id}`}
                      className="review-item"
                    >
                      <div className="review-info">
                        <div className="review-name">{review.file_name}</div>
                        <div className="review-meta">
                          <span className="review-date">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {review.overall_risk && (
                        <span className={`badge risk-${review.overall_risk.toLowerCase()}`}>
                          {review.overall_risk}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Contract Value Summary</h3>
            </div>
            <div className="card-body">
              <div className="value-summary">
                <div className="value-item">
                  <span className="value-label">Total Value Under Review</span>
                  <span className="value-amount">
                    ${(stats?.total_contract_value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="value-item">
                  <span className="value-label">Average Contract Value</span>
                  <span className="value-amount">
                    ${(stats?.avg_contract_value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskManagementDashboard;
