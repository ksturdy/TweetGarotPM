import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contractReviewsApi } from '../../services/contractReviews';
import './ContractReviewList.css';

const ContractReviewList: React.FC = () => {
  const [filters, setFilters] = useState({
    status: '',
    overall_risk: '',
    search: '',
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['contractReviews', filters],
    queryFn: () => contractReviewsApi.getAll(filters).then((res) => res.data),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="contract-review-list">
      <div className="page-header">
        <div>
          <h1>Contract Reviews</h1>
          <p>AI-powered contract risk analysis and legal review queue</p>
        </div>
        <Link to="/risk-management/contract-reviews/upload" className="btn btn-primary">
          Upload Contract
        </Link>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search contracts..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="needs_revision">Needs Revision</option>
          </select>
        </div>

        <div className="filter-group">
          <select
            value={filters.overall_risk}
            onChange={(e) => handleFilterChange('overall_risk', e.target.value)}
            className="filter-select"
          >
            <option value="">All Risk Levels</option>
            <option value="HIGH">High Risk</option>
            <option value="MODERATE">Moderate Risk</option>
            <option value="LOW">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      {!reviews || reviews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No contract reviews found</h3>
          <p>Upload a contract to get started with AI-powered risk analysis</p>
          <Link to="/risk-management/contract-reviews/upload" className="btn btn-primary">
            Upload First Contract
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="reviews-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Project</th>
                <th>GC</th>
                <th>Value</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review: any) => (
                <tr key={review.id}>
                  <td>
                    <div className="contract-cell">
                      <div className="contract-name">{review.file_name}</div>
                      {review.needs_legal_review && (
                        <span className="legal-flag">⚠️ Legal Review Required</span>
                      )}
                    </div>
                  </td>
                  <td>{review.project_name || '—'}</td>
                  <td>{review.general_contractor || '—'}</td>
                  <td>
                    {review.contract_value
                      ? `$${review.contract_value.toLocaleString()}`
                      : '—'}
                  </td>
                  <td>
                    {review.overall_risk ? (
                      <span className={`badge risk-${review.overall_risk.toLowerCase()}`}>
                        {review.overall_risk}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <span className={`badge status-${review.status}`}>
                      {review.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="date-cell">
                      <div>{new Date(review.created_at).toLocaleDateString()}</div>
                      <div className="uploaded-by">{review.uploaded_by_name}</div>
                    </div>
                  </td>
                  <td>
                    <Link
                      to={`/risk-management/contract-reviews/${review.id}`}
                      className="btn-link"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ContractReviewList;
