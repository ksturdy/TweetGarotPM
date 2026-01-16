import React from 'react';
import { Link } from 'react-router-dom';
import './EstimatesList.css';

const EstimatesList: React.FC = () => {
  // Placeholder data - will be replaced with API calls
  const estimates: any[] = [];

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'badge-info',
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger',
      won: 'badge-success',
      lost: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/estimating">&larr; Back to Estimating</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Estimates</h1>
        <Link to="/estimating/estimates/new" className="btn btn-primary">
          New Estimate
        </Link>
      </div>

      <div className="estimates-filters card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Status</label>
            <select className="form-input" style={{ width: 'auto' }}>
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search estimates..."
              style={{ width: '300px' }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Project Name</th>
              <th>Client</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Estimator</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {estimates?.map((estimate) => (
              <tr key={estimate.id}>
                <td><Link to={`/estimating/estimates/${estimate.id}`}>{estimate.number}</Link></td>
                <td>{estimate.project_name}</td>
                <td>{estimate.client}</td>
                <td>${estimate.total_amount?.toLocaleString()}</td>
                <td><span className={getStatusBadge(estimate.status)}>{estimate.status}</span></td>
                <td>{new Date(estimate.created_at).toLocaleDateString()}</td>
                <td>{estimate.estimator_name}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      to={`/estimating/estimates/${estimate.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      View
                    </Link>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => alert('PDF generation coming soon')}
                    >
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {estimates?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                      No estimates yet
                    </p>
                    <p style={{ color: 'var(--secondary)', marginBottom: '1.5rem' }}>
                      Get started by creating your first estimate
                    </p>
                    <Link to="/estimating/estimates/new" className="btn btn-primary">
                      Create Estimate
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EstimatesList;
