import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCustomer, getCustomerBids } from '../services/customers';
import { estimatesApi } from '../services/estimates';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

const CustomerEstimates: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: bids = [], isLoading: bidsLoading } = useQuery({
    queryKey: ['customer-bids', id],
    queryFn: () => getCustomerBids(id!),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ estimateId, status }: { estimateId: number; status: string }) =>
      estimatesApi.updateStatus(estimateId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-bids', id] });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusClasses: { [key: string]: string } = {
      draft: 'badge-secondary',
      pending: 'badge-warning',
      approved: 'badge-info',
      rejected: 'badge-danger',
      won: 'badge-success',
      lost: 'badge-danger',
    };
    return `badge ${statusClasses[status] || 'badge-secondary'}`;
  };

  const handleStatusChange = (estimateId: number, newStatus: string) => {
    updateStatusMutation.mutate({ estimateId, status: newStatus });
  };

  if (customerLoading || bidsLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!customer) {
    return <div className="text-center text-red-600">Customer not found</div>;
  }

  return (
    <div className="customer-detail-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/customers/${id}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Customer
            </Link>
            <h1>📋 Estimates</h1>
            <div className="sales-subtitle">{customer.customer_facility || customer.customer_owner}</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      <div className="data-section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h2 className="section-title">
            📊 Estimates <span className="tab-count">{bids.length}</span>
          </h2>
        </div>
        <div className="data-content">
          {bids.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">No estimates recorded</div>
              <p>Historical estimates will appear here</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Estimate Name</th>
                  <th>Date</th>
                  <th>Value</th>
                  <th>GM%</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((bid: any) => (
                  <tr key={bid.id}>
                    <td>
                      <Link
                        to={`/estimating/estimates/${bid.id}`}
                        style={{
                          color: '#1e40af',
                          textDecoration: 'none',
                          fontWeight: '600',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {bid.name}
                      </Link>
                    </td>
                    <td>{formatDate(bid.date)}</td>
                    <td><strong>{formatCurrency(bid.value)}</strong></td>
                    <td>{bid.gm_percent}%</td>
                    <td>
                      <select
                        value={bid.status || 'draft'}
                        onChange={(e) => handleStatusChange(bid.id, e.target.value)}
                        className={getStatusBadge(bid.status || 'draft')}
                        style={{
                          padding: '0.25rem 0.5rem',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerEstimates;
