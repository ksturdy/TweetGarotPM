import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerContactsHierarchy, CustomerContact } from '../services/customers';
import ContactOrgChart from '../components/customers/ContactOrgChart';
import ContactModal from '../components/modals/ContactModal';
import './CustomerDetail.css';

const CustomerOrgChartPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [layout, setLayout] = useState<'vertical' | 'horizontal' | 'compact'>('vertical');

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CustomerContact[]>({
    queryKey: ['customer-contacts-hierarchy', id],
    queryFn: () => getCustomerContactsHierarchy(id!),
  });

  if (customerLoading || contactsLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading organizational chart...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Customer not found</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%', height: '100vh', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate(`/customers/${id}`)}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
              {customer.name} - Organizational Chart
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Layout Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Layout:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '6px' }}>
              <button
                onClick={() => setLayout('vertical')}
                style={{
                  padding: '0.375rem 0.75rem',
                  background: layout === 'vertical' ? 'white' : 'transparent',
                  color: layout === 'vertical' ? '#3b82f6' : '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: layout === 'vertical' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                ↓ Vertical
              </button>
              <button
                onClick={() => setLayout('horizontal')}
                style={{
                  padding: '0.375rem 0.75rem',
                  background: layout === 'horizontal' ? 'white' : 'transparent',
                  color: layout === 'horizontal' ? '#3b82f6' : '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: layout === 'horizontal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                → Horizontal
              </button>
              <button
                onClick={() => setLayout('compact')}
                style={{
                  padding: '0.375rem 0.75rem',
                  background: layout === 'compact' ? 'white' : 'transparent',
                  color: layout === 'compact' ? '#3b82f6' : '#6b7280',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: layout === 'compact' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                ⊞ Compact
              </button>
            </div>
          </div>

          <button
            onClick={() => setEditingContact({} as CustomerContact)}
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            + Add Contact
          </button>
        </div>
      </div>

      {/* Org Chart */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minHeight: 'calc(100vh - 200px)'
      }}>
        {contacts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              No contacts yet
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Add contacts to visualize your organizational structure
            </p>
            <button
              onClick={() => setEditingContact({} as CustomerContact)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Add Your First Contact
            </button>
          </div>
        ) : (
          <ContactOrgChart contacts={contacts} onContactEdit={setEditingContact} layout={layout} />
        )}
      </div>

      {/* Contact Modal */}
      {editingContact && customer && (
        <ContactModal
          customerId={customer.id}
          customerName={customer.name}
          contact={editingContact.id ? editingContact : null}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
};

export default CustomerOrgChartPage;
