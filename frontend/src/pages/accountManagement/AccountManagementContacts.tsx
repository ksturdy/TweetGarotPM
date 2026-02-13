import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import '../../styles/SalesPipeline.css';

interface CustomerContact {
  id: number;
  customer_id: number | null;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  notes: string;
  customer_facility: string | null;
  customer_owner: string | null;
  city: string;
  state: string;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: number;
  customer_facility: string;
  customer_owner: string;
  city: string;
  state: string;
}

const emptyContact: Omit<CustomerContact, 'id' | 'created_at' | 'updated_at'> = {
  customer_id: null,
  first_name: '',
  last_name: '',
  title: '',
  email: '',
  phone: '',
  mobile: '',
  is_primary: false,
  notes: '',
  customer_facility: null,
  customer_owner: null,
  city: '',
  state: '',
};

const AccountManagementContacts: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState(emptyContact);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showFacilityDropdown, setShowFacilityDropdown] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['all-contacts'],
    queryFn: async () => {
      const response = await api.get('/customers/contacts/all');
      return response.data;
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers');
      return response.data;
    },
  });

  // Get unique companies (customer_owner)
  const uniqueCompanies = useMemo(() => {
    const companies = new Map<string, Customer>();
    customers.forEach((c: Customer) => {
      if (c.customer_owner && !companies.has(c.customer_owner)) {
        companies.set(c.customer_owner, c);
      }
    });
    return Array.from(companies.values());
  }, [customers]);

  // Filter companies for dropdown search
  const filteredCompanies = useMemo(() => {
    if (!companySearch) return uniqueCompanies.slice(0, 50);
    const search = companySearch.toLowerCase();
    return uniqueCompanies
      .filter((c: Customer) => c.customer_owner?.toLowerCase().includes(search))
      .slice(0, 50);
  }, [uniqueCompanies, companySearch]);

  // Get facilities filtered by selected company
  const filteredFacilities = useMemo(() => {
    if (!selectedCompany) return [];
    const facilities = customers.filter((c: Customer) => c.customer_owner === selectedCompany);
    if (!facilitySearch) return facilities.slice(0, 50);
    const search = facilitySearch.toLowerCase();
    return facilities
      .filter((c: Customer) => c.customer_facility?.toLowerCase().includes(search))
      .slice(0, 50);
  }, [customers, selectedCompany, facilitySearch]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/customers/contacts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      setShowAddModal(false);
      setNewContact(emptyContact);
      setCompanySearch('');
      setFacilitySearch('');
      setSelectedCompany(null);
      setShowCompanyDropdown(false);
      setShowFacilityDropdown(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: number; data: any }) => {
      const response = await api.put(`/customers/contacts/${contactId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      setShowEditModal(false);
      setEditingContact(null);
      setCompanySearch('');
      setFacilitySearch('');
      setSelectedCompany(null);
      setShowCompanyDropdown(false);
      setShowFacilityDropdown(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await api.delete(`/customers/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
    },
  });

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setSelectedCompany(contact.customer_owner || null);
    setCompanySearch('');
    setFacilitySearch('');
    setShowCompanyDropdown(false);
    setShowFacilityDropdown(false);
    setShowEditModal(true);
  };

  const handleDelete = (contact: CustomerContact) => {
    if (window.confirm(`Are you sure you want to delete ${contact.first_name} ${contact.last_name}?`)) {
      deleteMutation.mutate(contact.id);
    }
  };

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      customer_id: newContact.customer_id,
      first_name: newContact.first_name,
      last_name: newContact.last_name,
      title: newContact.title,
      email: newContact.email,
      phone: newContact.phone,
      mobile: newContact.mobile,
      is_primary: newContact.is_primary,
      notes: newContact.notes,
    });
  };

  const handleUpdateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      updateMutation.mutate({
        contactId: editingContact.id,
        data: {
          customer_id: editingContact.customer_id,
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
      contact.customer_owner?.toLowerCase().includes(searchLower) ||
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

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-primary)' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' } as React.CSSProperties;
  const dropdownStyle = {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    zIndex: 10,
    marginTop: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };

  const renderContactForm = (
    contact: typeof emptyContact | CustomerContact,
    setContact: (c: any) => void,
    onSubmit: (e: React.FormEvent) => void,
    isEdit: boolean,
    isPending: boolean,
    isError: boolean
  ) => (
    <form onSubmit={onSubmit}>
      <div style={{ padding: '20px 24px' }}>
        {/* Company Selection */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Company (Optional)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Click to select or type to search..."
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              onFocus={() => setShowCompanyDropdown(true)}
              onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
              style={inputStyle}
            />
            {showCompanyDropdown && filteredCompanies.length > 0 && (
              <div style={dropdownStyle}>
                {filteredCompanies.map((customer: Customer) => (
                  <div
                    key={customer.customer_owner}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedCompany(customer.customer_owner);
                      setContact({ ...contact, customer_owner: customer.customer_owner, customer_id: null, customer_facility: null });
                      setCompanySearch('');
                      setFacilitySearch('');
                      setShowCompanyDropdown(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e5e7eb',
                      color: '#1f2937',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <div style={{ fontWeight: 500, color: '#1f2937' }}>{customer.customer_owner}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {(selectedCompany || contact.customer_owner) && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="sales-stage-badge" style={{ background: 'var(--accent-blue)', color: 'white' }}>
                {selectedCompany || contact.customer_owner}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCompany(null);
                  setContact({ ...contact, customer_owner: null, customer_id: null, customer_facility: null });
                  setFacilitySearch('');
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Facility/Location Selection - only show if company is selected */}
        {(selectedCompany || contact.customer_owner) && (
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Facility/Location (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Click to select or type to search..."
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                onFocus={() => setShowFacilityDropdown(true)}
                onBlur={() => setTimeout(() => setShowFacilityDropdown(false), 200)}
                style={inputStyle}
              />
              {showFacilityDropdown && filteredFacilities.length > 0 && (
                <div style={dropdownStyle}>
                  {filteredFacilities.map((customer: Customer) => (
                    <div
                      key={customer.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setContact({ ...contact, customer_id: customer.id, customer_facility: customer.customer_facility });
                        setFacilitySearch('');
                        setShowFacilityDropdown(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #e5e7eb',
                        color: '#1f2937',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <div style={{ fontWeight: 500, color: '#1f2937' }}>{customer.customer_facility}</div>
                      {customer.city && customer.state && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{customer.city}, {customer.state}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {contact.customer_id && contact.customer_facility && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="sales-stage-badge" style={{ background: '#22c55e', color: 'white' }}>
                  {contact.customer_facility}
                </span>
                <button
                  type="button"
                  onClick={() => setContact({ ...contact, customer_id: null, customer_facility: null })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label style={labelStyle}>First Name *</label>
            <input
              type="text"
              value={contact.first_name}
              onChange={(e) => setContact({ ...contact, first_name: e.target.value })}
              required
              style={inputStyle}
            />
          </div>

          <div className="form-group">
            <label style={labelStyle}>Last Name *</label>
            <input
              type="text"
              value={contact.last_name}
              onChange={(e) => setContact({ ...contact, last_name: e.target.value })}
              required
              style={inputStyle}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={contact.title || ''}
            onChange={(e) => setContact({ ...contact, title: e.target.value })}
            placeholder="e.g., Facilities Manager, Director of Operations"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div className="form-group">
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={contact.email || ''}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              placeholder="contact@email.com"
              style={inputStyle}
            />
          </div>

          <div className="form-group">
            <label style={labelStyle}>Office Phone</label>
            <input
              type="tel"
              value={contact.phone || ''}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              placeholder="(555) 123-4567"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Mobile Phone</label>
          <input
            type="tel"
            value={contact.mobile || ''}
            onChange={(e) => setContact({ ...contact, mobile: e.target.value })}
            placeholder="(555) 123-4567"
            style={inputStyle}
          />
        </div>

        <div className="form-group" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id={isEdit ? 'is_primary_edit' : 'is_primary_add'}
            checked={contact.is_primary}
            onChange={(e) => setContact({ ...contact, is_primary: e.target.checked })}
            style={{ width: 'auto' }}
          />
          <label htmlFor={isEdit ? 'is_primary_edit' : 'is_primary_add'} style={{ margin: 0, fontWeight: 'normal', fontSize: '14px', color: 'var(--text-primary)' }}>
            Set as primary contact
          </label>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={contact.notes || ''}
            onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            placeholder="Any additional information about this contact..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          className="sales-btn sales-btn-secondary"
          onClick={() => {
            if (isEdit) {
              setShowEditModal(false);
              setEditingContact(null);
            } else {
              setShowAddModal(false);
              setNewContact(emptyContact);
            }
            setCompanySearch('');
            setFacilitySearch('');
            setSelectedCompany(null);
            setShowCompanyDropdown(false);
            setShowFacilityDropdown(false);
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="sales-btn sales-btn-primary"
          disabled={isPending}
        >
          {isPending ? 'Saving...' : (isEdit ? 'Update Contact' : 'Add Contact')}
        </button>
      </div>

      {isError && (
        <div style={{ color: 'var(--accent-rose)', padding: '0 24px 20px', fontSize: '14px' }}>
          Failed to {isEdit ? 'update' : 'create'} contact. Please try again.
        </div>
      )}
    </form>
  );

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/account-management" className="breadcrumb-link" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to Account Management
            </Link>
            <h1>📇 Contacts</h1>
            <div className="sales-subtitle">Manage all customer contacts</div>
          </div>
        </div>
        <div className="sales-page-actions">
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => {
              setNewContact(emptyContact);
              setCompanySearch('');
              setFacilitySearch('');
              setSelectedCompany(null);
              setShowCompanyDropdown(false);
              setShowFacilityDropdown(false);
              setShowAddModal(true);
            }}
          >
            + Add Contact
          </button>
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
              {searchTerm ? 'Try a different search term' : 'Click "Add Contact" to create your first contact'}
            </p>
          </div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Company</th>
                <th>Facility/Location</th>
                <th>Email</th>
                <th>Phone</th>
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
                    {contact.customer_owner ? (
                      <span style={{ fontWeight: 500 }}>{contact.customer_owner}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>-</span>
                    )}
                  </td>
                  <td>
                    {contact.customer_id && contact.customer_facility ? (
                      <>
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
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>-</span>
                    )}
                  </td>
                  <td>{contact.email || '-'}</td>
                  <td>{contact.phone || contact.mobile || '-'}</td>
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

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setNewContact(emptyContact); setCompanySearch(''); setFacilitySearch(''); setSelectedCompany(null); setShowCompanyDropdown(false); setShowFacilityDropdown(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Add New Contact</h2>
              <button onClick={() => { setShowAddModal(false); setNewContact(emptyContact); setCompanySearch(''); setFacilitySearch(''); setSelectedCompany(null); setShowCompanyDropdown(false); setShowFacilityDropdown(false); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ×
              </button>
            </div>
            {renderContactForm(newContact, setNewContact, handleCreateContact, false, createMutation.isPending, createMutation.isError)}
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && editingContact && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingContact(null); setCompanySearch(''); setFacilitySearch(''); setSelectedCompany(null); setShowCompanyDropdown(false); setShowFacilityDropdown(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Edit Contact</h2>
              <button onClick={() => { setShowEditModal(false); setEditingContact(null); setCompanySearch(''); setFacilitySearch(''); setSelectedCompany(null); setShowCompanyDropdown(false); setShowFacilityDropdown(false); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ×
              </button>
            </div>
            {renderContactForm(editingContact, setEditingContact, handleUpdateContact, true, updateMutation.isPending, updateMutation.isError)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagementContacts;
