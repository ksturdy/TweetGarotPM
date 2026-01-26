import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerMetrics, getCustomerProjects, getCustomerBids, getCustomerTouchpoints } from '../services/customers';
import TouchpointModal from '../components/modals/TouchpointModal';
import ProjectModal from '../components/modals/ProjectModal';
import CustomerFormModal from '../components/modals/CustomerFormModal';
import './CustomerDetail.css';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showTouchpointModal, setShowTouchpointModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['customer-metrics', id],
    queryFn: () => getCustomerMetrics(id!),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['customer-projects', id],
    queryFn: () => getCustomerProjects(id!),
  });

  const { data: bids = [] } = useQuery({
    queryKey: ['customer-bids', id],
    queryFn: () => getCustomerBids(id!),
  });

  const { data: touchpoints = [] } = useQuery({
    queryKey: ['customer-touchpoints', id],
    queryFn: () => getCustomerTouchpoints(id!),
  });

  if (customerLoading || metricsLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!customer) {
    return <div className="text-center text-red-600">Customer not found</div>;
  }

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

  const modules = [
    {
      title: 'Create New Estimate',
      icon: '📊',
      description: 'Generate a new project estimate for this customer',
      action: 'Create Estimate',
      colorStart: '#3b82f6',
      colorEnd: '#2563eb',
      onClick: () => navigate('/estimating/estimates/new', {
        state: {
          customerId: parseInt(id!),
          customerName: customer.customer_facility,
        }
      }),
    },
    {
      title: 'Log Touchpoint',
      icon: '📝',
      description: 'Record a new interaction or communication',
      action: 'Add Touchpoint',
      colorStart: '#10b981',
      colorEnd: '#059669',
      onClick: () => setShowTouchpointModal(true),
    },
    {
      title: 'Contacts',
      icon: '👤',
      description: 'View and manage customer contacts',
      action: 'View Contacts',
      colorStart: '#8b5cf6',
      colorEnd: '#7c3aed',
      onClick: () => navigate(`/customers/${id}/contacts`),
    },
    {
      title: 'Create Project',
      icon: '🏗️',
      description: 'Start a new project for this customer',
      action: 'New Project',
      colorStart: '#f59e0b',
      colorEnd: '#d97706',
      onClick: () => setShowProjectModal(true),
    },
  ];

  // Generate initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="customer-detail-page">
      {/* Header */}
      <div className="customer-header">
        <div className="header-top-bar">
          <Link to="/account-management/customers" className="back-button">
            ← Back to Customers
          </Link>
          <button
            onClick={() => setShowEditModal(true)}
            className="edit-customer-btn"
          >
            ✏️ Edit Customer
          </button>
        </div>

        <div className="header-main">
          <div className="customer-info-section">
            <div className="customer-title-row">
              <div className="customer-avatar">
                {getInitials(customer.customer_facility)}
              </div>
              <div className="customer-title-text">
                <h1>{customer.customer_facility}</h1>
                {customer.customer_owner && (
                  <div className="customer-subtitle">{customer.customer_owner}</div>
                )}
              </div>
            </div>

            <div className="customer-tags">
              {customer.city && customer.state && (
                <div className="customer-tag">
                  <span className="customer-tag-icon">📍</span>
                  {customer.city}, {customer.state}
                </div>
              )}
              {customer.account_manager && (
                <div className="customer-tag">
                  <span className="customer-tag-icon">👤</span>
                  {customer.account_manager}
                </div>
              )}
              {customer.customer_number && (
                <div className="customer-tag">
                  <span className="customer-tag-icon">#</span>
                  {customer.customer_number}
                </div>
              )}
              {customer.market && (
                <div className="customer-tag">
                  <span className="customer-tag-icon">🏢</span>
                  {customer.market}
                </div>
              )}
            </div>
          </div>

          <div className="header-metrics">
            <div className="header-metric">
              <span className="header-metric-icon">💰</span>
              <div className="header-metric-value">{formatCurrency(metrics?.total_revenue || 0)}</div>
              <div className="header-metric-label">Total Awarded</div>
            </div>
            <div className="header-metric">
              <span className="header-metric-icon">🎯</span>
              <div className="header-metric-value">{metrics?.hit_rate || 0}%</div>
              <div className="header-metric-label">Hit Rate</div>
            </div>
            <div className="header-metric">
              <span className="header-metric-icon">⭐</span>
              <div className="header-metric-value">{customer.customer_score || 'N/A'}</div>
              <div className="header-metric-label">Score</div>
            </div>
            <div className="header-metric">
              <span className="header-metric-icon">🏗️</span>
              <div className="header-metric-value">{metrics?.total_projects || 0}</div>
              <div className="header-metric-label">Projects</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Modules */}
      <div className="modules-grid">
        {modules.map((module) => (
          <div
            key={module.title}
            className="module-card"
            style={{
              '--module-color-start': module.colorStart,
              '--module-color-end': module.colorEnd,
            } as React.CSSProperties}
            onClick={module.onClick}
          >
            <div className="module-content">
              <div className="module-header">
                <div
                  className="module-icon-wrapper"
                  style={{
                    '--module-color-start': module.colorStart,
                    '--module-color-end': module.colorEnd,
                  } as React.CSSProperties}
                >
                  {module.icon}
                </div>
                <h3 className="module-title">
                  {module.title}
                </h3>
              </div>
              <p className="module-description">{module.description}</p>
              <div className="module-action">
                {module.action} →
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Sections Grid */}
      <div className="data-sections-grid">
        {/* Projects Section */}
        <div
          className="data-section"
          onClick={() => navigate(`/customers/${id}/projects`)}
          style={{ cursor: 'pointer' }}
        >
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

        {/* Estimates Section */}
        <div
          className="data-section"
          onClick={() => navigate(`/customers/${id}/estimates`)}
          style={{ cursor: 'pointer' }}
        >
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
                          {bid.name.includes(' - ') ? bid.name.split(' - ').slice(1).join(' - ') : bid.name}
                        </Link>
                      </td>
                      <td>{formatDate(bid.date)}</td>
                      <td><strong>{formatCurrency(bid.value)}</strong></td>
                      <td>{bid.gm_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Touchpoints Section */}
        <div
          className="data-section"
          onClick={() => navigate(`/customers/${id}/touchpoints`)}
          style={{ cursor: 'pointer' }}
        >
          <div className="section-header">
            <h2 className="section-title">
              📝 Touchpoints <span className="tab-count">{touchpoints.length}</span>
            </h2>
          </div>
          <div className="data-content">
            {touchpoints.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-text">No touchpoints logged</div>
                <p>Start tracking customer interactions</p>
              </div>
            ) : (
              <div className="touchpoint-list">
                {touchpoints.map((touchpoint: any) => (
                  <div key={touchpoint.id} className="touchpoint-item">
                    <div className="touchpoint-header">
                      <div>
                        <div className="touchpoint-type">
                          {touchpoint.touchpoint_type}
                          {touchpoint.contact_person && (
                            <span style={{ fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
                              with {touchpoint.contact_person}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="touchpoint-date">{formatDate(touchpoint.touchpoint_date)}</div>
                    </div>
                    {touchpoint.notes && (
                      <div className="touchpoint-notes">{touchpoint.notes}</div>
                    )}
                    {touchpoint.created_by_name && (
                      <div className="touchpoint-meta">
                        <span>👤</span> {touchpoint.created_by_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showTouchpointModal && (
        <TouchpointModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility}
          onClose={() => setShowTouchpointModal(false)}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility}
          onClose={() => setShowProjectModal(false)}
        />
      )}

      {showEditModal && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

export default CustomerDetail;
