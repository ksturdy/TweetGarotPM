import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import './AccountManagementList.css';
import '../CustomerDetail.css';

interface CustomerContact {
  id: number;
  customer_id: number;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  notes: string;
  customer_facility: string;
  customer_owner: string;
  city: string;
  state: string;
  created_at: string;
  updated_at: string;
}

const AccountManagementContacts: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['all-contacts'],
    queryFn: async () => {
      const response = await api.get('/customers/contacts/all');
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ contactId, customerId, data }: { contactId: number; customerId: number; data: any }) => {
      const response = await api.put(`/customers/${customerId}/contacts/${contactId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      setShowEditModal(false);
      setEditingContact(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ contactId, customerId }: { contactId: number; customerId: number }) => {
      await api.delete(`/customers/${customerId}/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
    },
  });

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setShowEditModal(true);
  };

  const handleDelete = (contact: CustomerContact) => {
    if (window.confirm(`Are you sure you want to delete ${contact.first_name} ${contact.last_name}?`)) {
      deleteMutation.mutate({ contactId: contact.id, customerId: contact.customer_id });
    }
  };

  const handleUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateMutation.mutate({
        contactId: editingContact.id,
        customerId: editingContact.customer_id,
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

  const filteredContacts = contacts.filter((contact: CustomerContact) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.first_name?.toLowerCase().includes(searchLower) ||
      contact.last_name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.customer_facility?.toLowerCase().includes(searchLower) ||
      contact.title?.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="account-management-page">
      <div className="page-header">
        <div>
          <Link to="/account-management" className="breadcrumb-link">&larr; Back to Account Management</Link>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage all customer contacts</p>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search contacts by name, email, customer, or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
        />
      </div>

      {/* Stats */}
      <div className="account-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card card">
          <div className="stat-icon">👥</div>
          <div>
            <div className="stat-value">{contacts.length}</div>
            <div className="stat-label">Total Contacts</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">⭐</div>
          <div>
            <div className="stat-value">{contacts.filter((c: CustomerContact) => c.is_primary).length}</div>
            <div className="stat-label">Primary Contacts</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">🔍</div>
          <div>
            <div className="stat-value">{filteredContacts.length}</div>
            <div className="stat-label">Filtered Results</div>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="data-section">
        <div className="section-header">
          <h2 className="section-title">
            📇 All Contacts <span className="tab-count">{filteredContacts.length}</span>
          </h2>
        </div>
        <div className="data-content">
          {filteredContacts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📇</div>
              <div className="empty-state-text">
                {searchTerm ? 'No contacts match your search' : 'No contacts yet'}
              </div>
              <p>
                {searchTerm ? 'Try a different search term' : 'Contacts will appear here as they are added to customers'}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Office Phone</th>
                  <th>Mobile</th>
                  <th>Primary</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact: CustomerContact) => (
                  <tr key={contact.id}>
                    <td>
                      <strong>
                        {contact.first_name} {contact.last_name}
                      </strong>
                    </td>
                    <td>{contact.title || '-'}</td>
                    <td>
                      <Link
                        to={`/customers/${contact.customer_id}`}
                        style={{
                          color: '#3b82f6',
                          textDecoration: 'none',
                          fontWeight: '500',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {contact.customer_facility}
                      </Link>
                      {contact.city && contact.state && (
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                          {contact.city}, {contact.state}
                        </div>
                      )}
                    </td>
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
                          onClick={() => handleDelete(contact)}
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
              Editing contact for <strong>{editingContact.customer_facility}</strong>
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

export default AccountManagementContacts;
