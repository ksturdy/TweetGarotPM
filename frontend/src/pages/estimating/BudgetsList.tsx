import React from 'react';
import { Link } from 'react-router-dom';
import './BudgetsList.css';

const BudgetsList: React.FC = () => {
  // Placeholder data - will be replaced with API calls
  const budgets: any[] = [];

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      completed: 'badge-info',
      overbudget: 'badge-danger',
      onhold: 'badge-warning',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  const getBudgetHealth = (budgeted: number, actual: number) => {
    const percentUsed = (actual / budgeted) * 100;
    if (percentUsed > 100) return { color: '#ef4444', text: 'Over Budget' };
    if (percentUsed > 90) return { color: '#f59e0b', text: 'At Risk' };
    if (percentUsed > 75) return { color: '#eab308', text: 'On Track' };
    return { color: '#10b981', text: 'Healthy' };
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/estimating">&larr; Back to Estimating</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Budgets</h1>
        <Link to="/estimating/budgets/new" className="btn btn-primary">
          New Budget
        </Link>
      </div>

      <div className="budgets-filters card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Status</label>
            <select className="form-input" style={{ width: 'auto' }}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="overbudget">Over Budget</option>
              <option value="onhold">On Hold</option>
            </select>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search budgets..."
              style={{ width: '300px' }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Budgeted Amount</th>
              <th>Actual Cost</th>
              <th>Variance</th>
              <th>% Used</th>
              <th>Health</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {budgets?.map((budget) => {
              const percentUsedNum = (budget.actual_cost / budget.budgeted_amount) * 100;
              const percentUsed = percentUsedNum.toFixed(1);
              const variance = budget.budgeted_amount - budget.actual_cost;
              const health = getBudgetHealth(budget.budgeted_amount, budget.actual_cost);

              return (
                <tr key={budget.id}>
                  <td>
                    <Link to={`/estimating/budgets/${budget.id}`}>
                      <strong>{budget.project_name}</strong>
                    </Link>
                  </td>
                  <td>${budget.budgeted_amount?.toLocaleString()}</td>
                  <td>${budget.actual_cost?.toLocaleString()}</td>
                  <td style={{ color: variance >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {variance >= 0 ? '+' : ''}${variance?.toLocaleString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '100px',
                        height: '8px',
                        background: '#e5e7eb',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(percentUsedNum, 100)}%`,
                          height: '100%',
                          background: health.color,
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{percentUsed}%</span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: `${health.color}20`,
                      color: health.color
                    }}>
                      {health.text}
                    </span>
                  </td>
                  <td><span className={getStatusBadge(budget.status)}>{budget.status}</span></td>
                  <td>
                    <Link
                      to={`/estimating/budgets/${budget.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {budgets?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                      No budgets yet
                    </p>
                    <p style={{ color: 'var(--secondary)', marginBottom: '1.5rem' }}>
                      Start tracking your project budgets
                    </p>
                    <Link to="/estimating/budgets/new" className="btn btn-primary">
                      Create Budget
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

export default BudgetsList;
