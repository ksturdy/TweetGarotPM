import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomer, getCustomerContactsHierarchy, CustomerContact } from '../services/customers';
import ContactOrgChart, { OrgChartPerson, ContactOrgChartHandle } from '../components/customers/ContactOrgChart';
import ContactModal from '../components/modals/ContactModal';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

const CustomerOrgChartPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [layout, setLayout] = useState<'vertical' | 'horizontal' | 'compact'>('vertical');
  const [pdfLoading, setPdfLoading] = useState(false);
  const orgChartRef = useRef<ContactOrgChartHandle>(null);

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CustomerContact[]>({
    queryKey: ['customer-contacts-hierarchy', id],
    queryFn: () => getCustomerContactsHierarchy(id!),
  });

  const handleExportPdf = async () => {
    if (!customer || contacts.length === 0) return;
    setPdfLoading(true);
    try {
      const safeName = customer.name.replace(/[^a-z0-9_-]+/gi, '_');
      const subtitle = `${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'}`;
      await orgChartRef.current?.exportToPdf(
        `${safeName}-Org-Chart.pdf`,
        `${customer.name} — Organizational Chart`,
        subtitle
      );
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

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
    <div className="customer-detail-page">
      {/* Header */}
      <div className="cd-header" style={{ padding: '12px 20px 0' }}>
        <div className="sales-page-header">
          <div className="sales-page-title">
            <div>
              <button
                onClick={() => navigate(`/customers/${id}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--text-muted)',
                  fontSize: '10px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  display: 'block'
                }}
              >
                ← Back to Customer
              </button>
              <h1>🏢 {customer.name} — Org Chart</h1>
              <div className="sales-subtitle">
                {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
              </div>
            </div>
          </div>
          <div className="cd-header-right">
            {/* Layout Selector */}
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Layout:</span>
            <div style={{ display: 'flex', gap: '3px', background: '#f0f1f3', padding: '3px', borderRadius: '6px' }}>
              {(['vertical', 'horizontal', 'compact'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  style={{
                    padding: '6px 10px',
                    background: layout === l ? 'white' : 'transparent',
                    color: layout === l ? '#3b82f6' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    boxShadow: layout === l ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {l === 'vertical' ? '↓ Vertical' : l === 'horizontal' ? '— Horizontal' : '⊞ Compact'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportPdf}
              disabled={pdfLoading || contacts.length === 0}
              className="sales-btn sales-btn-secondary"
              style={pdfLoading || contacts.length === 0 ? { opacity: 0.5, cursor: 'default' } : undefined}
            >
              {pdfLoading ? 'Generating...' : 'Export PDF'}
            </button>
            <button
              onClick={() => setEditingContact({} as CustomerContact)}
              className="sales-btn sales-btn-primary"
            >
              + Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* Org Chart */}
      <div style={{
        flex: 1,
        minHeight: 0,
        margin: '0 20px 20px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {contacts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              No contacts yet
            </h3>
            <p style={{ marginBottom: '1.5rem', fontSize: '13px' }}>
              Add contacts to visualize your organizational structure
            </p>
            <button
              onClick={() => setEditingContact({} as CustomerContact)}
              className="sales-btn sales-btn-primary"
            >
              Add Your First Contact
            </button>
          </div>
        ) : (
          <ContactOrgChart ref={orgChartRef} contacts={contacts} onContactEdit={(p: OrgChartPerson) => setEditingContact(p as CustomerContact)} layout={layout} />
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
