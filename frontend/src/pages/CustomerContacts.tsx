import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCustomer, getCustomerTouchpoints, CustomerContact } from '../services/customers';
import api from '../services/api';
import ContactModal from '../components/modals/ContactModal';
import TouchpointModal from '../components/modals/TouchpointModal';
import { useTitanFeedback } from '../context/TitanFeedbackContext';
import './CustomerDetail.css';
import '../styles/SalesPipeline.css';

type SortField = 'name' | 'title' | 'email' | 'phone' | 'mobile' | 'reports_to';
type SortDirection = 'asc' | 'desc';

const SortIcon: React.FC<{ active: boolean; direction: SortDirection }> = ({ active, direction }) => (
  <span className={`cd-sort-icon ${active ? 'active' : ''}`}>
    {direction === 'desc' ? '▼' : '▲'}
  </span>
);

const CustomerContacts: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, toast } = useTitanFeedback();
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTouchpointModal, setShowTouchpointModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getCustomer(id!),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CustomerContact[]>({
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
      queryClient.invalidateQueries({ queryKey: ['customer-contacts-hierarchy', id] });
      toast.success('Contact deleted');
    },
  });

  const handleDelete = async (contactId: number, name: string) => {
    const ok = await confirm({ message: `Delete ${name}? This cannot be undone.`, danger: true });
    if (ok) {
      deleteMutation.mutate(contactId);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  // Build a map of contact IDs to names for the "Reports To" column
  const contactNameMap = useMemo(() => {
    const map = new Map<number, string>();
    contacts.forEach((c) => {
      map.set(c.id, `${c.first_name} ${c.last_name}`);
    });
    return map;
  }, [contacts]);

  // Filter contacts by search term
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter((c) => {
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      const title = (c.title || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const mobile = (c.mobile || '').toLowerCase();
      const reportsTo = c.reports_to ? (contactNameMap.get(c.reports_to) || '').toLowerCase() : '';
      return fullName.includes(term) || title.includes(term) || email.includes(term) ||
             phone.includes(term) || mobile.includes(term) || reportsTo.includes(term);
    });
  }, [contacts, searchTerm, contactNameMap]);

  // Sort filtered contacts
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortField) {
        case 'name':
          aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
          bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
          break;
        case 'title':
          aVal = (a.title || '').toLowerCase();
          bVal = (b.title || '').toLowerCase();
          break;
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'phone':
          aVal = (a.phone || '').toLowerCase();
          bVal = (b.phone || '').toLowerCase();
          break;
        case 'mobile':
          aVal = (a.mobile || '').toLowerCase();
          bVal = (b.mobile || '').toLowerCase();
          break;
        case 'reports_to':
          aVal = a.reports_to ? (contactNameMap.get(a.reports_to) || '').toLowerCase() : '';
          bVal = b.reports_to ? (contactNameMap.get(b.reports_to) || '').toLowerCase() : '';
          break;
      }

      const comparison = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filteredContacts, sortField, sortDir, contactNameMap]);

  if (customerLoading || contactsLoading) {
    return <div className="customer-detail-page"><div className="loading-state">Loading...</div></div>;
  }

  if (!customer) {
    return <div className="customer-detail-page"><div className="error-state">Customer not found</div></div>;
  }

  const displayName = customer.name || customer.customer_facility || customer.customer_owner || 'Unknown';

  return (
    <div className="customer-detail-page">
      {/* Header */}
      <div className="cd-header">
        <div className="sales-page-header">
          <div className="sales-page-title">
            <div>
              <Link to={`/customers/${id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '10px' }}>
                &larr; Back to Customer
              </Link>
              <h1>👥 {displayName} — Contacts</h1>
              <div className="sales-subtitle">
                {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
                {filteredContacts.length !== contacts.length && ` (${filteredContacts.length} shown)`}
              </div>
            </div>
          </div>
          <div className="cd-header-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => navigate(`/customers/${id}/org-chart`)}
              className="sales-btn"
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Org Chart
            </button>
            <button
              onClick={() => setShowContactModal(true)}
              className="sales-btn sales-btn-primary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              + Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* Contacts Table Section */}
      <div className="sales-table-section" style={{ marginBottom: '12px' }}>
        <div className="sales-table-header">
          <div className="sales-table-title">
            Contacts <span className="cd-count" style={{ marginLeft: '6px' }}>{filteredContacts.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                width: '220px',
                outline: 'none',
                background: 'var(--bg-dark)',
              }}
            />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {sortedContacts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {searchTerm ? 'No contacts match your search' : 'No contacts yet — add your first contact'}
            </div>
          ) : (
            <table className="sales-table">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="sales-sortable" onClick={() => handleSort('name')}>Name <SortIcon active={sortField === 'name'} direction={sortDir} /></th>
                  <th className="sales-sortable" onClick={() => handleSort('title')}>Title <SortIcon active={sortField === 'title'} direction={sortDir} /></th>
                  <th className="sales-sortable" onClick={() => handleSort('reports_to')}>Reports To <SortIcon active={sortField === 'reports_to'} direction={sortDir} /></th>
                  <th className="sales-sortable" onClick={() => handleSort('email')}>Email <SortIcon active={sortField === 'email'} direction={sortDir} /></th>
                  <th className="sales-sortable" onClick={() => handleSort('phone')}>Office <SortIcon active={sortField === 'phone'} direction={sortDir} /></th>
                  <th className="sales-sortable" onClick={() => handleSort('mobile')}>Mobile <SortIcon active={sortField === 'mobile'} direction={sortDir} /></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map((contact: CustomerContact) => (
                  <tr key={contact.id} style={{ cursor: 'pointer' }} onClick={() => setEditingContact(contact)}>
                    <td>
                      <strong>{contact.first_name} {contact.last_name}</strong>
                      {contact.is_primary && (
                        <span style={{
                          fontSize: '9px',
                          marginLeft: '6px',
                          padding: '1px 5px',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}>PRIMARY</span>
                      )}
                    </td>
                    <td>{contact.title || '-'}</td>
                    <td style={{ color: contact.reports_to ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {contact.reports_to ? contactNameMap.get(contact.reports_to) || '-' : '-'}
                    </td>
                    <td>
                      {contact.email ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email}</span>
                          <a
                            href={`mailto:${contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                            title={`Email ${contact.first_name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              textDecoration: 'none',
                              fontSize: '12px',
                              flexShrink: 0,
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                          >
                            &#9993;
                          </a>
                        </span>
                      ) : '-'}
                    </td>
                    <td>{contact.phone || '-'}</td>
                    <td>{contact.mobile || '-'}</td>
                    <td>
                      {contact.notes && (
                        <span title={contact.notes} style={{ cursor: 'help', fontSize: '11px' }}>📝</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(contact.id, `${contact.first_name} ${contact.last_name}`); }}
                        style={{
                          padding: '2px 6px',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          opacity: 0.5,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Delete contact"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Touchpoints Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">
            Touchpoints <span className="cd-count" style={{ marginLeft: '6px' }}>{touchpoints.length}</span>
          </div>
          <button
            onClick={() => setShowTouchpointModal(true)}
            className="sales-btn sales-btn-primary"
            style={{ padding: '4px 12px', fontSize: '11px' }}
          >
            + Log Touchpoint
          </button>
        </div>
        <div>
          {touchpoints.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              No touchpoints logged — start tracking customer interactions
            </div>
          ) : (
            <div style={{ padding: '8px' }}>
              {touchpoints.map((touchpoint: any) => (
                <div key={touchpoint.id} style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {touchpoint.touchpoint_type}
                      {touchpoint.contact_person && (
                        <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                          with {touchpoint.contact_person}
                        </span>
                      )}
                    </div>
                    {touchpoint.notes && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {touchpoint.notes}
                      </div>
                    )}
                    {touchpoint.created_by_name && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        by {touchpoint.created_by_name}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(touchpoint.touchpoint_date)}
                  </div>
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
          customerName={displayName}
          onClose={() => setShowContactModal(false)}
        />
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <ContactModal
          customerId={parseInt(id!)}
          customerName={displayName}
          contact={editingContact}
          onClose={() => setEditingContact(null)}
        />
      )}

      {/* Add Touchpoint Modal */}
      {showTouchpointModal && (
        <TouchpointModal
          customerId={parseInt(id!)}
          customerName={displayName}
          onClose={() => setShowTouchpointModal(false)}
        />
      )}
    </div>
  );
};

export default CustomerContacts;
