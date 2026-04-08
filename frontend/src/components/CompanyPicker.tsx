import React, { useState, useEffect, useMemo, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import { customersApi } from '../services/customers';

interface CompanyPickerProps {
  companies: Array<{ id: number; name: string; customer_type?: string }>;
  selectedId: string | number | null;
  textValue: string;
  onSelectCompany: (id: string, name: string) => void;
  onManualEntry: (name: string) => void;
  onClear: () => void;
  onProspectCreated?: () => void;
  placeholder?: string;
  disabled?: boolean;
  selectOnly?: boolean;
}

const CompanyPicker: React.FC<CompanyPickerProps> = ({
  companies,
  selectedId,
  textValue,
  onSelectCompany,
  onManualEntry,
  onClear,
  onProspectCreated,
  placeholder = 'Search companies...',
  disabled = false,
  selectOnly = false
}) => {
  // If there's text but no linked company, start in manual mode to show the text
  // selectOnly forces select mode always
  const [mode, setMode] = useState<'select' | 'manual'>(() =>
    selectOnly ? 'select' : (textValue && !selectedId ? 'manual' : 'select')
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [existedMsg, setExistedMsg] = useState('');
  const [matches, setMatches] = useState<Array<{ id: number; name: string; customer_number?: string; city?: string; state?: string }>>([]);
  const [showMatches, setShowMatches] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const matchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Convert companies to SearchableSelect options (with prospect badge)
  const options = useMemo(() =>
    companies
      .filter(c => c.name)
      .map(c => ({
        value: c.id,
        label: c.customer_type === 'prospect' ? `${c.name} (Prospect)` : c.name
      })),
    [companies]
  );

  // Focus text input when switching to manual mode
  useEffect(() => {
    if (mode === 'manual' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  // Debounced match check when typing in manual mode
  useEffect(() => {
    if (mode !== 'manual' || !textValue || textValue.trim().length < 2) {
      setMatches([]);
      setShowMatches(false);
      return;
    }
    if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
    matchTimerRef.current = setTimeout(async () => {
      try {
        const results = await customersApi.checkMatch(textValue.trim());
        setMatches(results);
        setShowMatches(results.length > 0);
      } catch {
        setMatches([]);
        setShowMatches(false);
      }
    }, 400);
    return () => { if (matchTimerRef.current) clearTimeout(matchTimerRef.current); };
  }, [textValue, mode]);

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
    setExistedMsg('');
    // Pre-fill text input with what user was searching for
    if (searchTerm.trim()) {
      onManualEntry(searchTerm.trim());
    }
  };

  const switchToSelect = () => {
    setMode('select');
    setSearchTerm('');
    setMatches([]);
    setShowMatches(false);
    setExistedMsg('');
    // Clear manual text and let user pick from list
    onClear();
  };

  const handleSaveAsProspect = async () => {
    if (!textValue.trim() || saving) return;
    setSaving(true);
    setSaveError('');
    setExistedMsg('');
    try {
      const prospect = await customersApi.quickCreate(textValue.trim());
      // Link the prospect (new or existing)
      onSelectCompany(prospect.id.toString(), prospect.name);
      setMode('select');
      setMatches([]);
      setShowMatches(false);
      onProspectCreated?.();
      if ((prospect as any).already_existed) {
        setExistedMsg(`"${prospect.name}" already exists — linked to existing ${(prospect as any).customer_type || 'company'}.`);
      }
    } catch (err: any) {
      console.error('Failed to create prospect:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save prospect';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMatch = (match: { id: number; name: string }) => {
    onSelectCompany(match.id.toString(), match.name);
    setMode('select');
    setMatches([]);
    setShowMatches(false);
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
        <div style={{ display: 'flex', gap: '4px', alignItems: 'stretch' }}>
          <div style={{ flex: 1 }}>
            <SearchableSelect
              options={options}
              value={selectedId?.toString() || ''}
              onChange={handleSelectCompany}
              placeholder={placeholder}
              disabled={disabled}
              onSearchTermChange={setSearchTerm}
            />
          </div>
          {selectedId && (
            <button
              type="button"
              onClick={() => window.open(`/customers/${selectedId}`, '_blank')}
              title="Open customer page"
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '6px',
                padding: '0 8px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >↗</button>
          )}
        </div>
        {!selectOnly && (
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
        )}
        {existedMsg && (
          <div style={{
            marginTop: '4px',
            padding: '4px 8px',
            background: '#fefce8',
            border: '1px solid #fde68a',
            borderRadius: '4px',
            fontSize: '0.7rem',
            color: '#92400e',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{existedMsg}</span>
            <button
              type="button"
              onClick={() => setExistedMsg('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#92400e',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: '0 2px',
                lineHeight: 1
              }}
            >
              x
            </button>
          </div>
        )}
      </div>
    );
  }

  // Manual mode — show match suggestions + save as prospect option
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

      {/* Match suggestions */}
      {showMatches && (
        <div style={{
          marginTop: '4px',
          padding: '6px 8px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#1e40af'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            Possible matches found:
          </div>
          {matches.slice(0, 5).map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelectMatch(m)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '3px 4px',
                fontSize: '0.7rem',
                color: '#1e40af',
                cursor: 'pointer',
                borderRadius: '2px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              {m.name}
              {m.city && m.state ? ` — ${m.city}, ${m.state}` : ''}
              {m.customer_number ? ` (#${m.customer_number})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Actions: Save as Prospect or Search existing */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '4px',
        flexWrap: 'wrap'
      }}>
        {textValue.trim() && (
          <button
            type="button"
            onClick={handleSaveAsProspect}
            disabled={saving}
            style={{
              fontSize: '0.7rem',
              padding: '3px 10px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1,
              fontWeight: 500
            }}
          >
            {saving ? 'Saving...' : 'Save as Prospect'}
          </button>
        )}
        <button
          type="button"
          onClick={switchToSelect}
          style={{
            ...linkStyle,
            fontSize: '0.7rem',
            color: '#6b7280',
            marginTop: 0
          }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          Search existing companies
        </button>
      </div>

      {/* Error message */}
      {saveError && (
        <div style={{
          marginTop: '4px',
          padding: '4px 8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#dc2626'
        }}>
          {saveError}
        </div>
      )}
    </div>
  );
};

export default CompanyPicker;
