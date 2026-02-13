import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { changeOrdersApi } from '../../services/changeOrders';
import { projectsApi } from '../../services/projects';
import '../../styles/SalesPipeline.css';

const ChangeOrderList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: changeOrders, isLoading } = useQuery({
    queryKey: ['changeOrders', projectId, statusFilter],
    queryFn: () => changeOrdersApi.getByProject(
      Number(projectId),
      statusFilter !== 'all' ? { status: statusFilter } : undefined
    ).then((res) => res.data),
  });

  const { data: totals } = useQuery({
    queryKey: ['changeOrderTotals', projectId],
    queryFn: () => changeOrdersApi.getTotals(Number(projectId)).then((res) => res.data),
  });

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'badge-info',
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getDaysPending = (createdDate: string, status: string) => {
    if (status !== 'pending') return null;
    const created = new Date(createdDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleRowClick = (coId: number) => {
    navigate(`/projects/${projectId}/change-orders/${coId}`);
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Project
            </Link>
            <h1>📝 Change Orders</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - Change Orders</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to={`/projects/${projectId}/change-orders/new`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            New Change Order
          </Link>
        </div>
      </div>

      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{totals.total_count}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Total</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{totals.approved_count}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Approved</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(Number(totals.approved_amount))}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Approved Amount</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{totals.approved_days}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--secondary)' }}>Days Added</div>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <label htmlFor="status-filter" style={{ fontWeight: 500 }}>Filter by Status:</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form-input"
          style={{ width: 'auto', minWidth: '150px' }}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>
          Showing {changeOrders?.length || 0} change order{changeOrders?.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Amount</th>
              <th>Days</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Days Pending</th>
              <th>Created By</th>
              <th style={{ width: '150px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {changeOrders?.map((co) => {
              const daysPending = getDaysPending(co.created_at, co.status);
              return (
              <tr
                key={co.id}
                onClick={() => handleRowClick(co.id)}
                style={{ cursor: 'pointer' }}
                className="table-row-hover"
              >
                <td>
                  <Link
                    to={`/projects/${projectId}/change-orders/${co.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontWeight: 500 }}
                  >
                    CO-{co.number}
                  </Link>
                </td>
                <td>{co.title}</td>
                <td style={{ color: co.amount < 0 ? 'var(--danger)' : 'inherit' }}>
                  {formatCurrency(co.amount)}
                </td>
                <td>{co.days_added > 0 ? `+${co.days_added}` : co.days_added}</td>
                <td>
                  <span className={getStatusBadge(co.status)}>
                    {co.status.charAt(0).toUpperCase() + co.status.slice(1)}
                  </span>
                </td>
                <td>{format(new Date(co.created_at), 'MMM d, yyyy')}</td>
                <td>
                  {daysPending !== null ? (
                    <span style={{ fontWeight: 500, color: daysPending > 7 ? 'var(--danger)' : 'inherit' }}>
                      {daysPending} {daysPending === 1 ? 'day' : 'days'}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{co.created_by_name || '-'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      to={`/projects/${projectId}/change-orders/${co.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      View
                    </Link>
                    {co.status === 'draft' && (
                      <Link
                        to={`/projects/${projectId}/change-orders/${co.id}/edit`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
            {changeOrders?.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--secondary)', padding: '2rem' }}>
                  {statusFilter !== 'all'
                    ? `No ${statusFilter} change orders found`
                    : 'No change orders found. Click "New Change Order" to create one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChangeOrderList;
