import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CustomerContact, getCustomerContacts, createCustomerContact, updateCustomerContact } from '../../services/customers';
import './Modal.css';

interface ContactModalProps {
  customerId: number;
  customerName: string;
  contact?: CustomerContact | null;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ customerId, customerName, contact, onClose }) => {
  const queryClient = useQueryClient();
  const isEditMode = !!contact;

  const [formData, setFormData] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    title: contact?.title || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    mobile: contact?.mobile || '',
    is_primary: contact?.is_primary || false,
    notes: contact?.notes || '',
    reports_to: contact?.reports_to || null,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSearchTerm('');
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  // Fetch all contacts for the customer to populate the Reports To dropdown
  const { data: allContacts = [] } = useQuery({
    queryKey: ['customer-contacts', customerId.toString()],
    queryFn: () => getCustomerContacts(customerId.toString()),
  });

  const saveContact = useMutation({
    mutationFn: async (data: any) => {
      if (isEditMode && contact) {
        return updateCustomerContact(contact.id, data);
      } else {
        return createCustomerContact(customerId, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', customerId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['customer-contacts-hierarchy', customerId.toString()] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveContact.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    let processedValue: any = value;

    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (name === 'reports_to') {
      // Convert to number or null for reports_to field
      processedValue = value === '' ? null : parseInt(value, 10);
    } else if (value === '') {
      processedValue = null;
    }

    setFormData({
      ...formData,
      [name]: processedValue,
    });
  };

  // Filter available managers (exclude self when editing)
  const availableManagers = allContacts.filter((c: CustomerContact) => c.id !== contact?.id);

  // Filter managers based on search term
  const filteredManagers = availableManagers.filter((mgr: CustomerContact) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${mgr.first_name} ${mgr.last_name}`.toLowerCase();
    const title = (mgr.title || '').toLowerCase();
    return fullName.includes(searchLower) || title.includes(searchLower);
  });

  // Get selected manager for display
  const selectedManager = formData.reports_to
    ? availableManagers.find((m: CustomerContact) => m.id === formData.reports_to)
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Contact' : 'Add Contact'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-subtitle">
          {isEditMode ? 'Editing contact for' : 'Adding new contact for'} <strong>{customerName}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="last_name">Last Name *</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Facilities Manager, Director of Operations"
              />
            </div>

            <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
              <label htmlFor="reports_to">Reports To</label>
              <div
                style={{
                  position: 'relative',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  cursor: 'pointer',
                  background: 'white',
                  transition: 'all 0.2s'
                }}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {selectedManager ? (
                  <div>
                    {selectedManager.first_name} {selectedManager.last_name}
                    {selectedManager.title && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>({selectedManager.title})</span>}
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af' }}>None (Top Level)</div>
                )}
              </div>

              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '300px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: '0.75rem',
                      border: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      outline: 'none',
                      fontSize: '0.95rem'
                    }}
                    autoFocus
                  />
                  <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
                    <div
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderBottom: '1px solid #f3f4f6',
                        background: !formData.reports_to ? '#f3f4f6' : 'transparent'
                      }}
                      onClick={() => {
                        setFormData({ ...formData, reports_to: null });
                        setShowDropdown(false);
                        setSearchTerm('');
                      }}
                      onMouseEnter={(e) => !formData.reports_to && (e.currentTarget.style.background = '#e5e7eb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = !formData.reports_to ? '#f3f4f6' : 'transparent')}
                    >
                      <strong>None (Top Level)</strong>
                    </div>
                    {filteredManagers.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                        No contacts found
                      </div>
                    ) : (
                      filteredManagers.map((mgr: CustomerContact) => (
                        <div
                          key={mgr.id}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            borderBottom: '1px solid #f3f4f6',
                            background: formData.reports_to === mgr.id ? '#f3f4f6' : 'transparent'
                          }}
                          onClick={() => {
                            setFormData({ ...formData, reports_to: mgr.id });
                            setShowDropdown(false);
                            setSearchTerm('');
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = formData.reports_to === mgr.id ? '#f3f4f6' : 'transparent')}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {mgr.first_name} {mgr.last_name}
                          </div>
                          {mgr.title && (
                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              {mgr.title}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@email.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Office Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="mobile">Mobile Phone</label>
              <input
                type="tel"
                id="mobile"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="is_primary"
                name="is_primary"
                checked={formData.is_primary}
                onChange={handleChange}
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
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional information about this contact..."
                rows={3}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saveContact.isPending}
            >
              {saveContact.isPending ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Contact')}
            </button>
          </div>

          {saveContact.isError && (
            <div className="error-message">
              {isEditMode ? 'Failed to update contact.' : 'Failed to add contact.'} Please try again.
              <div style={{ marginTop: '0.5rem', fontSize: '0.9em' }}>
                {(saveContact.error as any)?.response?.data?.error ||
                 (saveContact.error instanceof Error ? saveContact.error.message : 'Unknown error')}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ContactModal;
