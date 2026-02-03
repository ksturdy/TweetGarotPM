import React from 'react';
import { Link } from 'react-router-dom';
import './BudgetsList.css';

const BudgetsList: React.FC = () => {
  // Placeholder data - will be replaced with API calls
  const budgets: any[] = [];

  const getBudgetHealth = (budgeted: number, actual: number) => {
    const percentUsed = (actual / budgeted) * 100;
    if (percentUsed > 100) return { color: '#ef4444', text: 'Over Budget' };
    if (percentUsed > 90) return { color: '#f59e0b', text: 'At Risk' };
    if (percentUsed > 75) return { color: '#eab308', text: 'On Track' };
    return { color: '#10b981', text: 'Healthy' };
  };

  return (
    <div className="budgets-page">
      {/* Back Link */}
      <Link to="/estimating" className="back-link">&larr; Back to Estimating</Link>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1>Budgets</h1>
          <p>Track project budgets and costs</p>
        </div>
        <div className="page-header-actions">
          <Link to="/estimating/budgets/new" className="btn btn-primary">
            + New Budget
          </Link>
        </div>
      </div>

      {/* Filter Section */}
      <div className="budgets-filters">
        <div className="budgets-filters-row">
          <div className="budgets-filter-group">
            <label>Status</label>
            <select className="form-input">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="overbudget">Over Budget</option>
              <option value="onhold">On Hold</option>
            </select>
          </div>
          <div className="budgets-filter-group" style={{ flex: 1, minWidth: '250px' }}>
            <label>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search budgets..."
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="budgets-table-card">
        <table className="budgets-table">
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
                    <Link to={`/estimating/budgets/${budget.id}`} className="budget-project-link">
                      {budget.project_name}
                    </Link>
                  </td>
                  <td>${budget.budgeted_amount?.toLocaleString()}</td>
                  <td>${budget.actual_cost?.toLocaleString()}</td>
                  <td className={variance >= 0 ? 'budget-positive' : 'budget-negative'}>
                    {variance >= 0 ? '+' : ''}${variance?.toLocaleString()}
                  </td>
                  <td>
                    <div className="budget-progress-container">
                      <div className="budget-progress-bar">
                        <div
                          className="budget-progress-fill"
                          style={{
                            width: `${Math.min(percentUsedNum, 100)}%`,
                            background: health.color,
                          }}
                        />
                      </div>
                      <span className="budget-progress-text">{percentUsed}%</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="budget-health-badge"
                      style={{
                        background: `${health.color}20`,
                        color: health.color
                      }}
                    >
                      {health.text}
                    </span>
                  </td>
                  <td>
                    <span className={`budget-status-badge ${budget.status}`}>
                      {budget.status}
                    </span>
                  </td>
                  <td>
                    <Link to={`/estimating/budgets/${budget.id}`} className="btn btn-secondary btn-sm">
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {budgets?.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="budgets-empty-state">
                    <div className="empty-icon">💰</div>
                    <h3>No budgets yet</h3>
                    <p>Start tracking your project budgets</p>
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
