import React, { useState } from 'react';

interface CustomerOption {
  id: number;
  name: string;
}

interface SendProposalToPickerProps {
  customers: CustomerOption[];          // Customers added to the estimate (customer_ids resolved)
  selectedCustomerId: number | null | undefined;
  manualName: string | null | undefined;
  onSelectCustomer: (id: number | null) => void;
  onManualNameChange: (name: string) => void;
  required?: boolean;
  disabled?: boolean;
}

// Match the CompanyPicker "Not in list? Enter manually" link style verbatim
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

const TOOLTIP_TEXT = 'Linking to an existing customer keeps the proposal connected across opportunities, estimates, and reports. Use manual entry only when the recipient is not yet a saved customer.';

const SendProposalToPicker: React.FC<SendProposalToPickerProps> = ({
  customers,
  selectedCustomerId,
  manualName,
  onSelectCustomer,
  onManualNameChange,
  required,
  disabled,
}) => {
  // Default to manual mode if there's a saved manual name and no selected customer
  const [manualMode, setManualMode] = useState<boolean>(!!manualName && !selectedCustomerId);

  const noCustomers = customers.length === 0;
  const placeholder = noCustomers ? 'Add a customer first...' : 'Select recipient...';

  return (
    <div>
      {manualMode ? (
        <input
          type="text"
          className="form-input"
          value={manualName || ''}
          onChange={(e) => onManualNameChange(e.target.value)}
          placeholder="Enter recipient name..."
          disabled={disabled}
          required={required}
          style={{ padding: '0.5rem' }}
        />
      ) : (
        <select
          className="form-input"
          value={selectedCustomerId || ''}
          onChange={(e) => onSelectCustomer(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled || noCustomers}
          required={required}
          style={{ padding: '0.5rem' }}
        >
          <option value="">{placeholder}</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          {manualMode ? (
            <button
              type="button"
              onClick={() => {
                setManualMode(false);
                onManualNameChange('');
              }}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              ← Back to customer list
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setManualMode(true);
                onSelectCustomer(null);
              }}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Not in list? Enter manually
            </button>
          )}
          <span title={TOOLTIP_TEXT} style={tooltipIconStyle}>?</span>
        </div>
      )}
    </div>
  );
};

export default SendProposalToPicker;
