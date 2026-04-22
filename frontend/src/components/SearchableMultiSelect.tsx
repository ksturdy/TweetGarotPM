import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface Option {
  value: string;
  label: string;
  subtitle?: string;
  searchText?: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const MAX_VISIBLE = 50;

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  values,
  onChange,
  placeholder = 'Search and select...',
  disabled = false,
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const validOptions = useMemo(
    () => options.filter(opt => opt.label != null && opt.label !== ''),
    [options]
  );

  const selectedOptions = useMemo(
    () => validOptions.filter(opt => values.includes(opt.value)),
    [validOptions, values]
  );

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return validOptions;
    const words = searchTerm.toLowerCase().trim().split(/\s+/);
    return validOptions.filter(opt => {
      const text = (opt.searchText || `${opt.label} ${opt.subtitle || ''}`).toLowerCase();
      return words.every(word => text.includes(word));
    });
  }, [validOptions, searchTerm]);

  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, MAX_VISIBLE),
    [filteredOptions]
  );
  const hasMore = filteredOptions.length > MAX_VISIBLE;

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 340;
      const openAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
      setDropdownPos({
        top: openAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(updatePosition, 0);
  }, [disabled, updatePosition]);

  const toggleValue = useCallback((val: string) => {
    const current = valuesRef.current;
    if (current.includes(val)) {
      onChangeRef.current(current.filter(v => v !== val));
    } else {
      onChangeRef.current([...current, val]);
    }
  }, []);

  const removeValue = useCallback((val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeRef.current(valuesRef.current.filter(v => v !== val));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const dropdown = isOpen ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        maxHeight: '340px',
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Type to search (${validOptions.length} available)...`}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '13px',
            outline: 'none',
            color: '#1e293b',
            backgroundColor: '#fff',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {visibleOptions.length > 0 ? (
          <>
            {visibleOptions.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <div
                  key={option.value}
                  onClick={() => toggleValue(option.value)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    borderBottom: '1px solid #f8fafc',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? '#eff6ff' : 'transparent';
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '3px',
                    border: isSelected ? '2px solid #3b82f6' : '2px solid #cbd5e1',
                    background: isSelected ? '#3b82f6' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? '#1e40af' : '#1e293b' }}>
                      {option.label}
                    </div>
                    {option.subtitle && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                        {option.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <div style={{
                padding: '8px 12px',
                fontSize: '12px',
                color: '#94a3b8',
                textAlign: 'center',
                borderTop: '1px solid #f1f5f9'
              }}>
                Showing {MAX_VISIBLE} of {filteredOptions.length} — type more to narrow results
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '13px'
          }}>
            {validOptions.length === 0
              ? 'No options available'
              : `No results for "${searchTerm}"`
            }
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', ...style }}>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        style={{
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '38px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
        }}
      >
        {selectedOptions.length > 0 ? (
          <>
            {selectedOptions.map(opt => (
              <span
                key={opt.value}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  background: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  lineHeight: '20px',
                }}
              >
                {opt.label}
                <button
                  onClick={(e) => removeValue(opt.value, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 2px',
                    color: '#3b82f6',
                    fontSize: '14px',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{placeholder}</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '11px', flexShrink: 0 }}>▼</span>
      </div>
      {dropdown}
    </div>
  );
};

export default React.memo(SearchableMultiSelect);
