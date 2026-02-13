import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerTouchpoints } from '../services/customers';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

const CustomerTouchpoints: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: touchpoints = [], isLoading: touchpointsLoading } = useQuery({
    queryKey: ['customer-touchpoints', id],
    queryFn: () => getCustomerTouchpoints(id!),
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (customerLoading || touchpointsLoading) {
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
            <h1>📞 Touchpoints</h1>
            <div className="sales-subtitle">{customer.customer_facility || customer.customer_owner}</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      <div className="data-section" style={{ marginBottom: '2rem' }}>
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
  );
};

export default CustomerTouchpoints;
