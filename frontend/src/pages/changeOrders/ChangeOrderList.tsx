import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { changeOrdersApi } from '../../services/changeOrders';
import { projectsApi } from '../../services/projects';

const ChangeOrderList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: changeOrders, isLoading } = useQuery({
    queryKey: ['changeOrders', projectId],
    queryFn: () => changeOrdersApi.getByProject(Number(projectId)).then((res) => res.data),
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

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}`}>&larr; Back to {project?.name || 'Project'}</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Change Orders</h1>
        <button className="btn btn-primary">New Change Order</button>
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

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Amount</th>
              <th>Days</th>
              <th>Status</th>
              <th>Created By</th>
            </tr>
          </thead>
          <tbody>
            {changeOrders?.map((co) => (
              <tr key={co.id}>
                <td>CO-{co.number}</td>
                <td>{co.title}</td>
                <td>{formatCurrency(co.amount)}</td>
                <td>{co.days_added > 0 ? `+${co.days_added}` : co.days_added}</td>
                <td><span className={getStatusBadge(co.status)}>{co.status}</span></td>
                <td>{co.created_by_name}</td>
              </tr>
            ))}
            {changeOrders?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No change orders found
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
