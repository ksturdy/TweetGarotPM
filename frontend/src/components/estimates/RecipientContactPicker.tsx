import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi, Contact } from '../../services/contacts';

interface RecipientContactPickerProps {
  customerId: number | null | undefined;
  customerName?: string;
  selectedContactId: number | null | undefined;
  onChange: (contactId: number | null) => void;
  manualName?: string | null;
  onManualNameChange?: (name: string) => void;
  required?: boolean;
  disabled?: boolean;
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  width: '100%',
};

const RecipientContactPicker: React.FC<RecipientContactPickerProps> = ({
  customerId,
  customerName,
  selectedContactId,
  onChange,
  manualName,
  onManualNameChange,
  required,
  disabled,
}) => {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', title: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  // Manual mode: free-text name (for contacts not in the system)
  const [manualMode, setManualMode] = useState<boolean>(!!manualName && !selectedContactId);

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['contacts', 'company', customerId],
    queryFn: () => contactsApi.getByCompany(customerId as number).then((res) => res.data),
    enabled: !!customerId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      contactsApi.create({
        companyId: customerId as number,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        title: draft.title.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
      } as any),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contacts', 'company', customerId] });
      const created = res.data as Contact;
      onChange(created.id);
      setShowNew(false);
      setDraft({ firstName: '', lastName: '', title: '', email: '', phone: '' });
      setError(null);
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error || err?.message || 'Failed to save contact');
    },
  });

  const handleCreate = () => {
    if (!customerId) return;
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError('First and last name are required');
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  const placeholder = !customerId
    ? 'Pick recipient first...'
    : !contacts?.length
      ? 'No contacts on file — add one below'
      : 'Select contact...';

  // Match CompanyPicker "Not in list? Enter manually" link style verbatim
  const linkStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#3b82f6',
    cursor: 'pointer',
    marginTop: '4px',
    display: 'inline-block',
    background: 'none',
    border: 'none',
    padding: 0,
    textDecoration: 'none',
  };

  const tooltipIconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#e0e7ff',
    color: '#4f46e5',
    fontSize: '10px',
    fontWeight: 700,
    cursor: 'help',
    flexShrink: 0,
  };

  const tooltipText = 'Linking to an existing contact keeps records connected across customers, opportunities, and estimates. Use manual entry only when the recipient is not yet a saved contact.';

  return (
    <div>
      {manualMode ? (
        <input
          type="text"
          className="form-input"
          value={manualName || ''}
          onChange={(e) => onManualNameChange?.(e.target.value)}
          placeholder="Enter contact name..."
          disabled={disabled}
          required={required}
          style={{ padding: '0.5rem' }}
        />
      ) : (
        <select
          className="form-input"
          value={selectedContactId || ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={!customerId || disabled}
          required={required}
          style={{ padding: '0.5rem' }}
        >
          <option value="">{placeholder}</option>
          {contacts?.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.first_name} {contact.last_name}{contact.title ? ` — ${contact.title}` : ''}
            </option>
          ))}
        </select>
      )}

      {/* Mode toggle row */}
      {!disabled && (
        <div style={{ display: 'flex', gap: 16, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {manualMode ? (
              <button
                type="button"
                onClick={() => {
                  setManualMode(false);
                  onManualNameChange?.('');
                }}
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                ← Back to contact list
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setManualMode(true);
                  onChange(null);
                }}
                style={linkStyle}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                Not in list? Enter manually
              </button>
            )}
            <span title={tooltipText} style={tooltipIconStyle}>?</span>
          </div>

          {!manualMode && !!customerId && !showNew && (
            <button
              type="button"
              onClick={() => { setShowNew(true); setError(null); }}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              + New contact{customerName ? ` for ${customerName}` : ''}
            </button>
          )}
        </div>
      )}

      {showNew && (
        <div
          style={{
            marginTop: 6,
            padding: 10,
            background: '#f9fafb',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <input
              type="text"
              placeholder="First name *"
              value={draft.firstName}
              onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Last name *"
              value={draft.lastName}
              onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <input
            type="text"
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <input
              type="email"
              placeholder="Email"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              style={inputStyle}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: '0.75rem', color: '#dc2626', marginBottom: 6 }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button"
              onClick={() => { setShowNew(false); setError(null); }}
              disabled={createMutation.isPending}
              style={{
                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600,
                background: '#fff', color: '#374151', border: '1px solid #d1d5db',
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              style={{
                padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600,
                background: '#1a56db', color: '#fff', border: 'none',
                borderRadius: 4, cursor: createMutation.isPending ? 'wait' : 'pointer',
                opacity: createMutation.isPending ? 0.6 : 1,
              }}
            >
              {createMutation.isPending ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipientContactPicker;
