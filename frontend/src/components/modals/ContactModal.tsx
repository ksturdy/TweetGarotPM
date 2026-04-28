import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CustomerContact, CustomerLocation, getCustomerContacts, getCustomerLocations, createCustomerContact, updateCustomerContact } from '../../services/customers';
import './Modal.css';

interface ContactModalProps {
  customerId: number;
  customerName: string;
  contact?: CustomerContact | null;
  onClose: () => void;
}

// ── vCard parser ──
function parseVCard(text: string): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  const lines = text.replace(/\r\n /g, '').split(/\r?\n/);

  for (const line of lines) {
    // FN (formatted name) — fallback if N not present
    if (line.startsWith('FN:') || line.startsWith('FN;')) {
      const val = line.substring(line.indexOf(':') + 1).trim();
      if (!result.first_name) {
        const parts = val.split(/\s+/);
        result.first_name = parts[0] || '';
        result.last_name = parts.slice(1).join(' ') || '';
      }
    }
    // N:Last;First;Middle;Prefix;Suffix
    if (line.startsWith('N:') || line.startsWith('N;')) {
      const val = line.substring(line.indexOf(':') + 1);
      const parts = val.split(';');
      result.last_name = parts[0]?.trim() || '';
      result.first_name = parts[1]?.trim() || '';
    }
    // TITLE
    if (line.startsWith('TITLE:') || line.startsWith('TITLE;')) {
      result.title = line.substring(line.indexOf(':') + 1).trim();
    }
    // EMAIL
    if (line.startsWith('EMAIL') && line.includes(':')) {
      const val = line.substring(line.indexOf(':') + 1).trim();
      if (!result.email) result.email = val;
    }
    // TEL — detect CELL/MOBILE vs WORK/VOICE
    if (line.startsWith('TEL') && line.includes(':')) {
      const val = line.substring(line.indexOf(':') + 1).trim();
      const upperLine = line.toUpperCase();
      if (upperLine.includes('CELL') || upperLine.includes('MOBILE')) {
        if (!result.mobile) result.mobile = val;
      } else {
        if (!result.phone) result.phone = val;
      }
    }
    // ORG
    if (line.startsWith('ORG:') || line.startsWith('ORG;')) {
      result.org = line.substring(line.indexOf(':') + 1).split(';')[0].trim();
    }
    // NOTE
    if (line.startsWith('NOTE:') || line.startsWith('NOTE;')) {
      result.note = line.substring(line.indexOf(':') + 1).trim();
    }
  }
  return result;
}

// ── Email signature parser ──
function parseEmailSignature(text: string): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Email regex
  const emailRe = /[\w.+-]+@[\w.-]+\.\w{2,}/;
  // Phone regex — matches (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx, +1 xxx xxx xxxx, etc.
  const phoneRe = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/;
  // Common title keywords
  const titleKeywords = /\b(manager|director|president|vp|vice\s+president|superintendent|supervisor|coordinator|engineer|estimator|foreman|chief|officer|ceo|cfo|coo|cto|admin|assistant|analyst|specialist|lead|head|partner|owner|principal|architect|planner|facilities|operations|maintenance|mechanical|construction|project|senior|sr\.|jr\.)\b/i;

  const phones: string[] = [];

  for (const line of lines) {
    // Extract email
    const emailMatch = line.match(emailRe);
    if (emailMatch && !result.email) {
      result.email = emailMatch[0];
    }

    // Extract phone numbers — strip labels like "O:", "M:", "Cell:", "Office:", "Phone:"
    const cleanedLine = line.replace(/^(office|cell|mobile|phone|fax|direct|main|o|m|c|d|p|f)\s*[:.]?\s*/i, '');
    const phoneMatch = cleanedLine.match(phoneRe);
    if (phoneMatch) {
      const label = line.toLowerCase();
      if (label.startsWith('fax') || label.includes('fax:') || label.includes('fax ')) {
        // skip fax
      } else if (label.startsWith('cell') || label.startsWith('mobile') || label.startsWith('m:') || label.startsWith('m.') || label.startsWith('c:')) {
        result.mobile = phoneMatch[0].trim();
      } else {
        phones.push(phoneMatch[0].trim());
      }
    }

    // Detect title-like lines (containing title keywords, not too long)
    if (!result.title && line.length < 80 && titleKeywords.test(line) && !emailRe.test(line) && !phoneRe.test(line)) {
      result.title = line.replace(/^[-|,]+\s*/, '').replace(/[-|,]+\s*$/, '').trim();
    }
  }

  // Assign phones — first phone as office, second as mobile if mobile not already set
  if (phones.length > 0 && !result.phone) result.phone = phones[0];
  if (phones.length > 1 && !result.mobile) result.mobile = phones[1];

  // First non-email, non-phone, non-title line is likely the name
  for (const line of lines) {
    if (emailRe.test(line) || phoneRe.test(line)) continue;
    if (result.title && line === result.title) continue;
    // Skip very short lines (separators like "---") or very long ones (addresses)
    if (line.length < 3 || line.length > 60) continue;
    // Skip lines that look like addresses or company names
    if (/^\d/.test(line) || /\b(street|st\.|ave|blvd|suite|ste|floor|llc|inc|corp)\b/i.test(line)) continue;
    // This is probably the name
    const nameParts = line.replace(/[,|]+$/, '').trim().split(/\s+/);
    if (nameParts.length >= 2) {
      result.first_name = nameParts[0];
      result.last_name = nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1 && nameParts[0].length > 1) {
      result.first_name = nameParts[0];
    }
    break;
  }

  return result;
}

const ContactModal: React.FC<ContactModalProps> = ({ customerId, customerName, contact, onClose }) => {
  const queryClient = useQueryClient();
  const isEditMode = !!contact;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    title: contact?.title || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    mobile: contact?.mobile || '',
    is_primary: contact?.is_primary || false,
    notes: contact?.notes || '',
    reports_to: contact?.reports_to || null as number | null,
    location_id: contact?.location_id || null as number | null,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Signature paste state
  const [showSignaturePaste, setShowSignaturePaste] = useState(false);
  const [signatureText, setSignatureText] = useState('');

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

  // Fetch locations for the customer
  const { data: locations = [] } = useQuery({
    queryKey: ['customer-locations', customerId.toString()],
    queryFn: () => getCustomerLocations(customerId),
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
    } else if (name === 'reports_to' || name === 'location_id') {
      processedValue = value === '' ? null : parseInt(value, 10);
    } else if (value === '') {
      processedValue = null;
    }

    setFormData({
      ...formData,
      [name]: processedValue,
    });
  };

  // ── Import handlers ──

  const applyParsedData = (parsed: Partial<Record<string, string>>) => {
    setFormData(prev => ({
      ...prev,
      first_name: parsed.first_name || prev.first_name,
      last_name: parsed.last_name || prev.last_name,
      title: parsed.title || prev.title,
      email: parsed.email || prev.email,
      phone: parsed.phone || prev.phone,
      mobile: parsed.mobile || prev.mobile,
      notes: parsed.note ? (prev.notes ? prev.notes + '\n' + parsed.note : parsed.note) : prev.notes,
    }));
  };

  const handleVCardImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const parsed = parseVCard(text);
      applyParsedData(parsed);
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  const handleSignatureParse = () => {
    if (!signatureText.trim()) return;
    const parsed = parseEmailSignature(signatureText);
    applyParsedData(parsed);
    setShowSignaturePaste(false);
    setSignatureText('');
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
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-subtitle">
          {isEditMode ? 'Editing contact for' : 'Adding new contact for'} <strong>{customerName}</strong>
        </div>

        {/* Import tools — only show on new contacts or when fields are mostly empty */}
        {!isEditMode && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0 1.5rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap'
          }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".vcf,.vcard"
              onChange={handleVCardImport}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                color: '#0369a1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 500,
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#e0f2fe'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
            >
              <span style={{ fontSize: '1rem' }}>&#128206;</span> Import vCard
            </button>
            <button
              type="button"
              onClick={() => setShowSignaturePaste(!showSignaturePaste)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                background: showSignaturePaste ? '#fef3c7' : '#f0fdf4',
                border: `1px solid ${showSignaturePaste ? '#fcd34d' : '#bbf7d0'}`,
                borderRadius: '6px',
                color: showSignaturePaste ? '#92400e' : '#15803d',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 500,
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = showSignaturePaste ? '#fde68a' : '#dcfce7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = showSignaturePaste ? '#fef3c7' : '#f0fdf4'; }}
            >
              <span style={{ fontSize: '1rem' }}>&#9993;</span> Paste Signature
            </button>
          </div>
        )}

        {/* Signature paste area */}
        {showSignaturePaste && (
          <div style={{
            margin: '0 1.5rem 0.75rem',
            padding: '0.75rem',
            background: '#fefce8',
            border: '1px solid #fde68a',
            borderRadius: '8px'
          }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', display: 'block', marginBottom: '0.4rem' }}>
              Paste an email signature below to auto-fill contact info:
            </label>
            <textarea
              value={signatureText}
              onChange={(e) => setSignatureText(e.target.value)}
              placeholder={'John Smith\nFacilities Manager\nAcme Corp\njohn.smith@acme.com\nO: (555) 123-4567\nM: (555) 987-6543'}
              rows={5}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowSignaturePaste(false); setSignatureText(''); }}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.8rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignatureParse}
                disabled={!signatureText.trim()}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.8rem',
                  background: signatureText.trim() ? '#15803d' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: signatureText.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 500
                }}
              >
                Parse & Fill
              </button>
            </div>
          </div>
        )}

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

            <div className="form-row">
              {/* Location dropdown */}
              <div className="form-group">
                <label htmlFor="location_id">Location</label>
                <select
                  id="location_id"
                  name="location_id"
                  value={formData.location_id ?? ''}
                  onChange={handleChange}
                  style={{ width: '100%' }}
                >
                  <option value="">No location</option>
                  {locations.map((loc: CustomerLocation) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}{loc.city && loc.state ? ` (${loc.city}, ${loc.state})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reports To searchable dropdown */}
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
