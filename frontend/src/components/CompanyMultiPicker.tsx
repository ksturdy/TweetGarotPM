import React, { useState } from 'react';
import CompanyPicker from './CompanyPicker';

interface Company {
  id: number;
  name: string;
  customer_type?: string;
}

interface CompanyMultiPickerProps {
  companies: Company[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  addLabel?: string;
  disabled?: boolean;
  onProspectCreated?: () => void;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 4px 4px 10px',
  background: '#eef2ff',
  color: '#1e3a8a',
  border: '1px solid #c7d2fe',
  borderRadius: 16,
  fontSize: '0.8125rem',
  fontWeight: 500,
  maxWidth: '100%',
};

const removeBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  background: 'transparent',
  color: '#1e3a8a',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
};

const CompanyMultiPicker: React.FC<CompanyMultiPickerProps> = ({
  companies,
  selectedIds,
  onChange,
  placeholder = 'Search companies...',
  addLabel = '+ Add another',
  disabled = false,
  onProspectCreated,
}) => {
  const [showPicker, setShowPicker] = useState(selectedIds.length === 0);

  const handleAdd = (idStr: string) => {
    const id = Number(idStr);
    if (!id || selectedIds.includes(id)) {
      setShowPicker(false);
      return;
    }
    onChange([...selectedIds, id]);
    setShowPicker(false);
  };

  const handleRemove = (id: number) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const companyName = (id: number) => companies.find((c) => c.id === id)?.name || `Customer #${id}`;

  return (
    <div>
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {selectedIds.map((id) => (
            <span key={id} style={chipStyle}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {companyName(id)}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  style={removeBtnStyle}
                  title="Remove"
                  aria-label={`Remove ${companyName(id)}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && showPicker && (
        <CompanyPicker
          companies={companies.filter((c) => !selectedIds.includes(c.id))}
          selectedId={''}
          textValue={''}
          onSelectCompany={(id) => handleAdd(id)}
          onManualEntry={() => { /* multi-picker requires real customer records */ }}
          onClear={() => setShowPicker(false)}
          placeholder={placeholder}
          onProspectCreated={onProspectCreated}
        />
      )}

      {!disabled && !showPicker && (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          style={{
            padding: '6px 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#1a56db',
            background: 'transparent',
            border: '1px dashed #c7d2fe',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {addLabel}
        </button>
      )}
    </div>
  );
};

export default CompanyMultiPicker;
