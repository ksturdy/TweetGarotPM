import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import '../../styles/SalesPipeline.css';

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
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/account-management" className="breadcrumb-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to Account Management
            </Link>
            <h1>Contacts</h1>
            <div className="sales-subtitle">Manage all customer contacts</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Contacts</div>
          <div className="sales-kpi-value">{contacts.length}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Primary Contacts</div>
          <div className="sales-kpi-value">{contacts.filter((c: CustomerContact) => c.is_primary).length}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Filtered Results</div>
          <div className="sales-kpi-value">{filteredContacts.length}</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Contacts</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📇</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {searchTerm ? 'No contacts match your search' : 'No contacts yet'}
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {searchTerm ? 'Try a different search term' : 'Contacts will appear here as they are added to customers'}
            </p>
          </div>
        ) : (
          <table className="sales-table">
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
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: 'var(--gradient-1)' }}>
                        {contact.first_name?.[0]}{contact.last_name?.[0]}
                      </div>
                      <div className="sales-project-info">
                        <h4>{contact.first_name} {contact.last_name}</h4>
                      </div>
                    </div>
                  </td>
                  <td>{contact.title || '-'}</td>
                  <td>
                    <Link
                      to={`/customers/${contact.customer_id}`}
                      style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: '500' }}
                    >
                      {contact.customer_facility}
                    </Link>
                    {contact.city && contact.state && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {contact.city}, {contact.state}
                      </div>
                    )}
                  </td>
                  <td>{contact.email || '-'}</td>
                  <td>{contact.phone || '-'}</td>
                  <td>{contact.mobile || '-'}</td>
                  <td>
                    {contact.is_primary && (
                      <span className="sales-stage-badge awarded">
                        <span className="sales-stage-dot"></span>
                        Primary
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="sales-actions-cell">
                      <button className="sales-action-btn" onClick={() => handleEdit(contact)} title="Edit">
                        ✏️
                      </button>
                      <button className="sales-action-btn" onClick={() => handleDelete(contact)} title="Delete">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Edit Contact</h2>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ×
              </button>
            </div>

            <div style={{ padding: '16px 24px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Editing contact for <strong>{editingContact.customer_facility}</strong>
            </div>

            <form onSubmit={handleUpdateContact}>
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>First Name *</label>
                    <input
                      type="text"
                      value={editingContact.first_name}
                      onChange={(e) => setEditingContact({ ...editingContact, first_name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Last Name *</label>
                    <input
                      type="text"
                      value={editingContact.last_name}
                      onChange={(e) => setEditingContact({ ...editingContact, last_name: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Title</label>
                  <input
                    type="text"
                    value={editingContact.title}
                    onChange={(e) => setEditingContact({ ...editingContact, title: e.target.value })}
                    placeholder="e.g., Facilities Manager, Director of Operations"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      value={editingContact.email}
                      onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                      placeholder="contact@email.com"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Office Phone</label>
                    <input
                      type="tel"
                      value={editingContact.phone}
                      onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Mobile Phone</label>
                  <input
                    type="tel"
                    value={editingContact.mobile}
                    onChange={(e) => setEditingContact({ ...editingContact, mobile: e.target.value })}
                    placeholder="(555) 123-4567"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={editingContact.is_primary}
                    onChange={(e) => setEditingContact({ ...editingContact, is_primary: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="is_primary" style={{ margin: 0, fontWeight: 'normal', fontSize: '14px', color: 'var(--text-primary)' }}>
                    Set as primary contact
                  </label>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes</label>
                  <textarea
                    value={editingContact.notes}
                    onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                    placeholder="Any additional information about this contact..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className="sales-btn sales-btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-btn sales-btn-primary"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Update Contact'}
                </button>
              </div>

              {updateMutation.isError && (
                <div style={{ color: 'var(--accent-rose)', padding: '0 24px 20px', fontSize: '14px' }}>
                  Failed to update contact. Please try again.
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagementContacts;
