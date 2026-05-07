import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { proposalsApi, Proposal } from '../../services/proposals';
import './ProposalList.css';
import '../../styles/SalesPipeline.css';

const ProposalList: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals', statusFilter],
    queryFn: async () => {
      const filters: any = {};
      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }
      const response = await proposalsApi.getAll(filters);
      return response.data;
    },
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft': return 'lead';
      case 'pending_review': return 'submitted';
      case 'approved': return 'awarded';
      case 'sent': return 'proposal';
      case 'accepted': return 'won';
      case 'rejected': return 'lost';
      case 'expired': return 'closed';
      default: return 'lead';
    }
  };

  const formatStatus = (status: string) =>
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    const parsed = dateString.includes('T') ? dateString : dateString + 'T00:00:00';
    return new Date(parsed).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const totalValue = proposals.reduce((sum: number, p: Proposal) => sum + (p.total_amount || 0), 0);
  const acceptedCount = proposals.filter((p: Proposal) => p.status === 'accepted').length;
  const sentCount = proposals.filter((p: Proposal) => p.status === 'sent').length;

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading proposals...
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>📝 Proposals</h1>
            <div className="sales-subtitle">Create and manage sales proposals</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn" onClick={() => navigate('/proposals/create')}>
            + New Proposal
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Value</div>
          <div className="sales-kpi-value">{formatCurrency(totalValue)}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Accepted</div>
          <div className="sales-kpi-value">{acceptedCount}</div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Sent</div>
          <div className="sales-kpi-value">{sentCount}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Total Proposals</div>
          <div className="sales-kpi-value">{proposals.length}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Proposals</div>
          <div className="sales-table-controls">
            <select
              className="sales-filter-btn"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📝</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No proposals found</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create one to get started</p>
          </div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Proposal #</th>
                <th>Title</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Valid Until</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((proposal: Proposal) => (
                <tr
                  key={proposal.id}
                  onClick={() => navigate(`/proposals/${proposal.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <strong>{proposal.proposal_number}</strong>
                    {proposal.version_number > 1 && (
                      <span className="version-badge"> v{proposal.version_number}</span>
                    )}
                  </td>
                  <td>{proposal.title}</td>
                  <td>{proposal.customer_name || '—'}</td>
                  <td>{formatCurrency(proposal.total_amount)}</td>
                  <td>
                    <span className={`sales-stage-badge ${getStatusBadgeClass(proposal.status)}`}>
                      <span className="sales-stage-dot"></span>
                      {formatStatus(proposal.status)}
                    </span>
                  </td>
                  <td>{formatDate(proposal.valid_until)}</td>
                  <td>{formatDate(proposal.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProposalList;
