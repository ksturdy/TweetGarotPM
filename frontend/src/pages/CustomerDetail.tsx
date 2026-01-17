import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerMetrics, getCustomerProjects, getCustomerBids, getCustomerTouchpoints } from '../services/customers';
import TouchpointModal from '../components/modals/TouchpointModal';
import ContactModal from '../components/modals/ContactModal';
import EstimateModal from '../components/modals/EstimateModal';
import ProjectModal from '../components/modals/ProjectModal';
import './CustomerDetail.css';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'projects' | 'bids' | 'touchpoints'>('projects');
  const [showTouchpointModal, setShowTouchpointModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);

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
      onClick: () => setShowEstimateModal(true),
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
      title: 'Add Contact',
      icon: '👤',
      description: 'Add a new contact person for this customer',
      action: 'New Contact',
      colorStart: '#8b5cf6',
      colorEnd: '#7c3aed',
      onClick: () => setShowContactModal(true),
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
    {
      title: 'View Reports',
      icon: '📈',
      description: 'Customer analytics and performance reports',
      action: 'View Reports',
      colorStart: '#ec4899',
      colorEnd: '#db2777',
      onClick: () => {/* TODO: Navigate to reports */},
      comingSoon: true,
    },
    {
      title: 'Send Communication',
      icon: '✉️',
      description: 'Email or message customer contacts',
      action: 'Send Message',
      colorStart: '#06b6d4',
      colorEnd: '#0891b2',
      onClick: () => {/* TODO: Open communication modal */},
      comingSoon: true,
    },
  ];

  return (
    <div className="customer-detail-page">
      {/* Header */}
      <div className="customer-header">
        <Link to="/account-management/customers" className="back-button">
          ← Back to Customers
        </Link>
        <div className="customer-header-content">
          <div className="customer-info">
            <h1>{customer.customer_facility}</h1>
            <div className="customer-subtitle">{customer.customer_owner}</div>
            <div className="customer-meta">
              {customer.city && customer.state && (
                <div className="meta-item">
                  <span className="meta-icon">📍</span>
                  <span>{customer.city}, {customer.state}</span>
                </div>
              )}
              {customer.account_manager && (
                <div className="meta-item">
                  <span className="meta-icon">👨‍💼</span>
                  <span>{customer.account_manager}</span>
                </div>
              )}
              {customer.customer_number && (
                <div className="meta-item">
                  <span className="meta-icon">#</span>
                  <span>{customer.customer_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ '--metric-color': '#667eea' } as React.CSSProperties}>
          <div className="metric-header">
            <div className="metric-label">Total Revenue</div>
            <div className="metric-icon">💰</div>
          </div>
          <div className="metric-value">{formatCurrency(metrics?.total_revenue || 0)}</div>
          <div className="metric-subtitle">Lifetime value</div>
        </div>

        <div className="metric-card" style={{ '--metric-color': '#10b981' } as React.CSSProperties}>
          <div className="metric-header">
            <div className="metric-label">Hit Rate</div>
            <div className="metric-icon">🎯</div>
          </div>
          <div className="metric-value">{metrics?.hit_rate || 0}%</div>
          <div className="metric-subtitle">{metrics?.total_projects || 0} of {metrics?.total_bids || 0} bids won</div>
        </div>

        <div className="metric-card" style={{ '--metric-color': '#f59e0b' } as React.CSSProperties}>
          <div className="metric-header">
            <div className="metric-label">Customer Score</div>
            <div className="metric-icon">⭐</div>
          </div>
          <div className="metric-value">{customer.customer_score || 'N/A'}</div>
          <div className="metric-subtitle">Account rating</div>
        </div>

        <div className="metric-card" style={{ '--metric-color': '#3b82f6' } as React.CSSProperties}>
          <div className="metric-header">
            <div className="metric-label">Total Projects</div>
            <div className="metric-icon">🏗️</div>
          </div>
          <div className="metric-value">{metrics?.total_projects || 0}</div>
          <div className="metric-subtitle">{metrics?.completed_projects || 0} completed</div>
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

      {/* Data Section with Tabs */}
      <div className="data-section">
        <div className="section-header">
          <h2 className="section-title">
            📂 Customer Data
          </h2>
        </div>

        <div className="data-tabs">
          <button
            className={`tab-button ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            Projects <span className="tab-count">{projects.length}</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'bids' ? 'active' : ''}`}
            onClick={() => setActiveTab('bids')}
          >
            Bids <span className="tab-count">{bids.length}</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'touchpoints' ? 'active' : ''}`}
            onClick={() => setActiveTab('touchpoints')}
          >
            Touchpoints <span className="tab-count">{touchpoints.length}</span>
          </button>
        </div>

        <div className="data-content">
          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <>
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
            </>
          )}

          {/* Bids Tab */}
          {activeTab === 'bids' && (
            <>
              {bids.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📊</div>
                  <div className="empty-state-text">No bids recorded</div>
                  <p>Historical bids will appear here</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bid Name</th>
                      <th>Bid Date</th>
                      <th>Value</th>
                      <th>GM%</th>
                      <th>Building Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map((bid: any) => (
                      <tr key={bid.id}>
                        <td><strong>{bid.name}</strong></td>
                        <td>{formatDate(bid.date)}</td>
                        <td><strong>{formatCurrency(bid.value)}</strong></td>
                        <td>{bid.gm_percent}%</td>
                        <td>{bid.building_type || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* Touchpoints Tab */}
          {activeTab === 'touchpoints' && (
            <>
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
            </>
          )}
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

      {showContactModal && (
        <ContactModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility}
          onClose={() => setShowContactModal(false)}
        />
      )}

      {showEstimateModal && (
        <EstimateModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility}
          onClose={() => setShowEstimateModal(false)}
        />
      )}

      {showProjectModal && (
        <ProjectModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility}
          onClose={() => setShowProjectModal(false)}
        />
      )}
    </div>
  );
};

export default CustomerDetail;
