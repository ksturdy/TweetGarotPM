import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { proposalsApi, Proposal } from '../../services/proposals';
import './ProposalList.css';

const ProposalList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch proposals
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => proposalsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });

  const handleDelete = (id: number, proposalNumber: string) => {
    if (window.confirm(`Are you sure you want to delete proposal "${proposalNumber}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; className: string }
    > = {
      draft: { label: 'Draft', className: 'status-draft' },
      pending_review: { label: 'Pending Review', className: 'status-pending' },
      approved: { label: 'Approved', className: 'status-approved' },
      sent: { label: 'Sent', className: 'status-sent' },
      accepted: { label: 'Accepted', className: 'status-accepted' },
      rejected: { label: 'Rejected', className: 'status-rejected' },
      expired: { label: 'Expired', className: 'status-expired' },
    };

    const config = statusConfig[status] || { label: status, className: '' };

    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate summary stats
  const totalValue = proposals.reduce((sum: number, p: Proposal) => sum + (p.total_amount || 0), 0);
  const acceptedCount = proposals.filter((p: Proposal) => p.status === 'accepted').length;
  const sentCount = proposals.filter((p: Proposal) => p.status === 'sent').length;

  if (isLoading) {
    return <div className="loading">Loading proposals...</div>;
  }

  return (
    <div className="proposal-list">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proposals</h1>
          <p className="page-subtitle">Create and manage sales proposals</p>
        </div>
        <button className="btn" onClick={() => navigate('/proposals/create')}>
          + New Proposal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card summary-card">
          <div className="summary-icon">💰</div>
          <div>
            <div className="summary-value">{formatCurrency(totalValue)}</div>
            <div className="summary-label">Total Value</div>
          </div>
        </div>
        <div className="card summary-card">
          <div className="summary-icon">✅</div>
          <div>
            <div className="summary-value">{acceptedCount}</div>
            <div className="summary-label">Accepted</div>
          </div>
        </div>
        <div className="card summary-card">
          <div className="summary-icon">📨</div>
          <div>
            <div className="summary-value">{sentCount}</div>
            <div className="summary-label">Sent</div>
          </div>
        </div>
        <div className="card summary-card">
          <div className="summary-icon">📊</div>
          <div>
            <div className="summary-value">{proposals.length}</div>
            <div className="summary-label">Total Proposals</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
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

      {/* Proposals Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Proposal #</th>
              <th>Title</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Valid Until</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No proposals found. Create one to get started.
                </td>
              </tr>
            ) : (
              proposals.map((proposal: Proposal) => (
                <tr key={proposal.id}>
                  <td>
                    <strong>{proposal.proposal_number}</strong>
                    {proposal.version_number > 1 && (
                      <span className="version-badge"> v{proposal.version_number}</span>
                    )}
                  </td>
                  <td>{proposal.title}</td>
                  <td>{proposal.customer_name || '—'}</td>
                  <td>{formatCurrency(proposal.total_amount)}</td>
                  <td>{getStatusBadge(proposal.status)}</td>
                  <td>{formatDate(proposal.valid_until)}</td>
                  <td>{formatDate(proposal.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => navigate(`/proposals/${proposal.id}`)}
                        title="View"
                      >
                        👁️
                      </button>
                      {proposal.status === 'draft' && (
                        <button
                          className="btn-icon"
                          onClick={() => navigate(`/proposals/${proposal.id}?edit=true`)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(proposal.id, proposal.proposal_number)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProposalList;
