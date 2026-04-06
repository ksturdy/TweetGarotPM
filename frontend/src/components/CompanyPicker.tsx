import React, { useState, useEffect, useMemo, useRef } from 'react';
import SearchableSelect from './SearchableSelect';

interface CompanyPickerProps {
  companies: Array<{ id: number; name: string }>;
  selectedId: string | number | null;
  textValue: string;
  onSelectCompany: (id: string, name: string) => void;
  onManualEntry: (name: string) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const CompanyPicker: React.FC<CompanyPickerProps> = ({
  companies,
  selectedId,
  textValue,
  onSelectCompany,
  onManualEntry,
  onClear,
  placeholder = 'Search companies...',
  disabled = false
}) => {
  // Always default to search/select mode — the whole point of this component
  const [mode, setMode] = useState<'select' | 'manual'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert companies to SearchableSelect options
  const options = useMemo(() =>
    companies
      .filter(c => c.name)
      .map(c => ({
        value: c.id,
        label: c.name
      })),
    [companies]
  );

  // Focus text input when switching to manual mode
  useEffect(() => {
    if (mode === 'manual' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const handleSelectCompany = (val: string) => {
    if (!val) {
      onClear();
      return;
    }
    const company = companies.find(c => c.id.toString() === val);
    if (company) {
      onSelectCompany(val, company.name);
    }
  };

  const switchToManual = () => {
    setMode('manual');
    // Pre-fill text input with what user was searching for
    if (searchTerm.trim()) {
      onManualEntry(searchTerm.trim());
    }
  };

  const switchToSelect = () => {
    setMode('select');
    setSearchTerm('');
    // Clear manual text and let user pick from list
    onClear();
  };

  const linkStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#3b82f6',
    cursor: 'pointer',
    marginTop: '4px',
    display: 'inline-block',
    background: 'none',
    border: 'none',
    padding: 0,
    textDecoration: 'none'
  };

  const tooltipText = 'Linking to an existing company ensures this record appears in the company\'s view and connects across opportunities, estimates, projects, and reports throughout Titan.';

  if (mode === 'select') {
    return (
      <div>
        <SearchableSelect
          options={options}
          value={selectedId?.toString() || ''}
          onChange={handleSelectCompany}
          placeholder={placeholder}
          disabled={disabled}
          onSearchTermChange={setSearchTerm}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={switchToManual}
            style={linkStyle}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            Not in list? Enter manually
          </button>
          <span
            title={tooltipText}
            style={{
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
              flexShrink: 0
            }}
          >
            ?
          </span>
        </div>
      </div>
    );
  }

  // Manual mode — show a nudge to encourage linking
  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={textValue}
        onChange={(e) => onManualEntry(e.target.value)}
        placeholder="Enter company name..."
        disabled={disabled}
        style={{ width: '100%' }}
      />
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        marginTop: '4px',
        padding: '4px 8px',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '4px',
        fontSize: '0.7rem',
        color: '#92400e',
        lineHeight: 1.4
      }}>
        <span style={{ flexShrink: 0, marginTop: '1px' }}>*</span>
        <div>
          Temporary name only. Link to an existing company so this record appears in company views, reports, and across Titan.{' '}
          <button
            type="button"
            onClick={switchToSelect}
            style={{
              ...linkStyle,
              fontSize: '0.7rem',
              color: '#92400e',
              fontWeight: 600,
              marginTop: 0,
              textDecoration: 'underline'
            }}
          >
            Search existing companies
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyPicker;
