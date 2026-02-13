import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerProjects } from '../services/customers';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

const CustomerProjects: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['customer-projects', id],
    queryFn: () => getCustomerProjects(id!),
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

  if (customerLoading || projectsLoading) {
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
            <h1>📁 Projects</h1>
            <div className="sales-subtitle">{customer.customer_facility || customer.customer_owner}</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      <div className="data-section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h2 className="section-title">
            🏗️ Projects <span className="tab-count">{projects.length}</span>
          </h2>
        </div>
        <div className="data-content">
          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏗️</div>
              <div className="empty-state-text">No projects yet</div>
              <p>Create your first project for this customer</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Date</th>
                  <th>Value</th>
                  <th>GM%</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project: any) => (
                  <tr key={project.id}>
                    <td>
                      <strong>{project.name}</strong>
                      {project.description && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {project.description}
                        </div>
                      )}
                    </td>
                    <td>{formatDate(project.date)}</td>
                    <td><strong>{formatCurrency(project.value)}</strong></td>
                    <td>{project.gm_percent}%</td>
                    <td>
                      <span className={`status-badge status-${project.status}`}>
                        {project.status}
                      </span>
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

export default CustomerProjects;
