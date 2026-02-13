import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCustomer, getCustomerTouchpoints } from '../services/customers';
import api from '../services/api';
import ContactModal from '../components/modals/ContactModal';
import TouchpointModal from '../components/modals/TouchpointModal';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

interface CustomerContact {
  id: number;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

const CustomerContacts: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTouchpointModal, setShowTouchpointModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['customer-contacts', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}/contacts`);
      return response.data;
    },
  });

  const { data: touchpoints = [] } = useQuery({
    queryKey: ['customer-touchpoints', id],
    queryFn: () => getCustomerTouchpoints(id!),
  });

  const deleteMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await api.delete(`/customers/${id}/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: number; data: any }) => {
      const response = await api.put(`/customers/${id}/contacts/${contactId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', id] });
      setShowEditModal(false);
      setEditingContact(null);
    },
  });

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setShowEditModal(true);
  };

  const handleDelete = (contactId: number) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteMutation.mutate(contactId);
    }
  };

  const handleUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateMutation.mutate({
        contactId: editingContact.id,
        data: {
          first_name: editingContact.first_name,
          last_name: editingContact.last_name,
          title: editingContact.title,
          email: editingContact.email,
          phone: editingContact.phone,
          mobile: editingContact.mobile,
          is_primary: editingContact.is_primary,
          notes: editingContact.notes,
        },
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (customerLoading || contactsLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!customer) {
    return <div className="text-center text-red-600">Customer not found</div>;
  }

  return (
    <div className="customer-detail-page">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/customers/${id}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Customer
            </Link>
            <h1>📇 Contacts</h1>
            <div className="sales-subtitle">{customer.customer_facility || customer.customer_owner}</div>
          </div>
        </div>
        <div className="sales-header-actions">
        </div>
      </div>

      {/* Contacts Section */}
      <div className="data-section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h2 className="section-title">
            👤 Contacts <span className="tab-count">{contacts.length}</span>
          </h2>
          <button
            className="btn-primary"
            onClick={() => setShowContactModal(true)}
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            + Add Contact
          </button>
        </div>
        <div className="data-content">
          {contacts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-text">No contacts yet</div>
              <p>Add your first contact for this customer</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>Office Phone</th>
                  <th>Mobile</th>
                  <th>Primary</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact: CustomerContact) => (
                  <tr key={contact.id}>
                    <td>
                      <strong>
                        {contact.first_name} {contact.last_name}
                      </strong>
                    </td>
                    <td>{contact.title || '-'}</td>
                    <td>{contact.email || '-'}</td>
                    <td>{contact.phone || '-'}</td>
                    <td>{contact.mobile || '-'}</td>
                    <td>
                      {contact.is_primary && (
                        <span
                          className="status-badge"
                          style={{
                            background: '#d1fae5',
                            color: '#065f46',
                          }}
                        >
                          Primary
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEdit(contact)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Touchpoints Section */}
      <div className="data-section" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <h2 className="section-title">
            📝 Touchpoints <span className="tab-count">{touchpoints.length}</span>
          </h2>
          <button
            className="btn-primary"
            onClick={() => setShowTouchpointModal(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            + Log Touchpoint
          </button>
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

      {/* Add Contact Modal */}
      {showContactModal && (
        <ContactModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility}
          onClose={() => setShowContactModal(false)}
        />
      )}

      {/* Add Touchpoint Modal */}
      {showTouchpointModal && (
        <TouchpointModal
          customerId={parseInt(id!)}
          customerName={customer.customer_facility || 'Unnamed Customer'}
          onClose={() => setShowTouchpointModal(false)}
        />
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Contact</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-subtitle">
              Editing contact for <strong>{customer.customer_facility}</strong>
            </div>

            <form onSubmit={handleUpdateContact}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="first_name">First Name *</label>
                    <input
                      type="text"
                      id="first_name"
                      value={editingContact.first_name}
                      onChange={(e) =>
                        setEditingContact({ ...editingContact, first_name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="last_name">Last Name *</label>
                    <input
                      type="text"
                      id="last_name"
                      value={editingContact.last_name}
                      onChange={(e) =>
                        setEditingContact({ ...editingContact, last_name: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="title">Title</label>
                  <input
                    type="text"
                    id="title"
                    value={editingContact.title}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, title: e.target.value })
                    }
                    placeholder="e.g., Facilities Manager, Director of Operations"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      value={editingContact.email}
                      onChange={(e) =>
                        setEditingContact({ ...editingContact, email: e.target.value })
                      }
                      placeholder="contact@email.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Office Phone</label>
                    <input
                      type="tel"
                      id="phone"
                      value={editingContact.phone}
                      onChange={(e) =>
                        setEditingContact({ ...editingContact, phone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="mobile">Mobile Phone</label>
                  <input
                    type="tel"
                    id="mobile"
                    value={editingContact.mobile}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, mobile: e.target.value })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div
                  className="form-group"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}
                >
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={editingContact.is_primary}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, is_primary: e.target.checked })
                    }
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <label htmlFor="is_primary" style={{ margin: 0, fontWeight: 'normal' }}>
                    Set as primary contact
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    value={editingContact.notes}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, notes: e.target.value })
                    }
                    placeholder="Any additional information about this contact..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Update Contact'}
                </button>
              </div>

              {updateMutation.isError && (
                <div className="error-message">Failed to update contact. Please try again.</div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerContacts;
