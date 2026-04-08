import React, { useState, useEffect, useMemo, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import { getCustomerLocations, createCustomerLocation, CustomerLocation } from '../services/customers';

interface LocationPickerProps {
  customerId: string | number | null;
  selectedLocationId: string | number | null;
  textValue: string;
  onSelectLocation: (id: string, name: string) => void;
  onManualEntry: (name: string) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  customerId,
  selectedLocationId,
  textValue,
  onSelectLocation,
  onManualEntry,
  onClear,
  placeholder = 'Select location...',
  disabled = false
}) => {
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Fetch locations when customerId changes
  useEffect(() => {
    if (!customerId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCustomerLocations(customerId)
      .then(data => { if (!cancelled) setLocations(data); })
      .catch(() => { if (!cancelled) setLocations([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  // Focus input when "Add new" opens
  useEffect(() => {
    if (showAddNew && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddNew]);

  const options = useMemo(() =>
    locations.map(loc => ({
      value: loc.id,
      label: loc.name + (loc.city && loc.state ? ` (${loc.city}, ${loc.state})` : '')
    })),
    [locations]
  );

  const handleSelect = (val: string) => {
    if (!val) {
      onClear();
      return;
    }
    const loc = locations.find(l => l.id.toString() === val);
    if (loc) {
      onSelectLocation(val, loc.name);
    }
  };

  const handleAddNew = async () => {
    if (!newName.trim() || saving || !customerId) return;
    setSaving(true);
    setSaveError('');
    try {
      const loc = await createCustomerLocation(customerId, { name: newName.trim() });
      setLocations(prev => [...prev, loc]);
      onSelectLocation(loc.id.toString(), loc.name);
      setShowAddNew(false);
      setNewName('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to create location';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
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

  // No company selected — free-text mode
  if (!customerId) {
    return (
      <input
        type="text"
        value={textValue}
        onChange={(e) => onManualEntry(e.target.value)}
        placeholder="Enter facility/location..."
        disabled={disabled}
        style={{ width: '100%' }}
      />
    );
  }

  // Company selected — dropdown of that company's locations
  return (
    <div>
      <SearchableSelect
        options={options}
        value={selectedLocationId?.toString() || ''}
        onChange={handleSelect}
        placeholder={loading ? 'Loading locations...' : placeholder}
        disabled={disabled || loading}
      />

      {!showAddNew ? (
        <button
          type="button"
          onClick={() => setShowAddNew(true)}
          style={linkStyle}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          + Add new location
        </button>
      ) : (
        <div style={{ marginTop: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            ref={addInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNew(); } if (e.key === 'Escape') { setShowAddNew(false); setNewName(''); setSaveError(''); } }}
            placeholder="Location name..."
            style={{ flex: 1, fontSize: '0.8rem' }}
          />
          <button
            type="button"
            onClick={handleAddNew}
            disabled={saving || !newName.trim()}
            style={{
              fontSize: '0.7rem',
              padding: '3px 10px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'wait' : 'pointer',
              opacity: (saving || !newName.trim()) ? 0.6 : 1,
              fontWeight: 500
            }}
          >
            {saving ? 'Saving...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddNew(false); setNewName(''); setSaveError(''); }}
            style={{
              fontSize: '0.7rem',
              padding: '3px 6px',
              background: '#f3f4f6',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}

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

export default LocationPicker;
