import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface Option {
  value: string | number;
  label: string;
  searchText?: string;
}

interface MultiSearchableSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const MAX_VISIBLE = 50;

const MultiSearchableSelect: React.FC<MultiSearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  disabled = false,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validOptions = useMemo(
    () => options.filter(opt => opt.label != null && opt.label !== ''),
    [options]
  );

  const selectedSet = useMemo(() => new Set(value), [value]);

  const displayText = useMemo(() => {
    if (value.length === 0) return '';
    if (value.length === 1) {
      const opt = validOptions.find(o => o.value.toString() === value[0]);
      return opt?.label ?? value[0];
    }
    return `${value.length} selected`;
  }, [value, validOptions]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return validOptions;
    const words = searchTerm.toLowerCase().trim().split(/\s+/);
    return validOptions.filter(opt => {
      const text = (opt.searchText || opt.label).toLowerCase();
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
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => {
      if (!prev) setTimeout(updatePosition, 0);
      return !prev;
    });
  }, [disabled, updatePosition]);

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
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleToggleOption = useCallback((optionValue: string | number) => {
    const strVal = optionValue.toString();
    const next = selectedSet.has(strVal)
      ? value.filter(v => v !== strVal)
      : [...value, strVal];
    onChange(next);
  }, [value, selectedSet, onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setSearchTerm('');
  }, [onChange]);

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
        maxHeight: '300px',
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      <div style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Search (${validOptions.length} options)...`}
          style={{
            width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #e2e8f0',
            borderRadius: '4px', fontSize: '0.875rem', outline: 'none',
            color: '#1e293b', backgroundColor: '#fff', boxSizing: 'border-box' as const,
          }}
        />
      </div>

      <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
        {value.length > 0 && !searchTerm && (
          <div
            onClick={() => { onChange([]); setSearchTerm(''); }}
            style={{
              padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
              color: '#dc2626', borderBottom: '1px solid #f1f5f9',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Clear all ({value.length})
          </div>
        )}

        {visibleOptions.length > 0 ? (
          <>
            {visibleOptions.map((option) => {
              const isSelected = selectedSet.has(option.value.toString());
              return (
                <div
                  key={option.value}
                  onClick={() => handleToggleOption(option.value)}
                  style={{
                    padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#1e40af' : '#1e293b',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? '#eff6ff' : 'transparent';
                  }}
                >
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0,
                    border: isSelected ? '2px solid #3b82f6' : '2px solid #cbd5e1',
                    background: isSelected ? '#3b82f6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', color: '#fff', fontWeight: 700,
                  }}>
                    {isSelected ? '✓' : ''}
                  </span>
                  {option.label}
                </div>
              );
            })}
            {hasMore && (
              <div style={{
                padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#94a3b8',
                textAlign: 'center', borderTop: '1px solid #f1f5f9',
              }}>
                Showing {MAX_VISIBLE} of {filteredOptions.length} — type more to narrow
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
            {validOptions.length === 0 ? 'No options available' : `No results for "${searchTerm}"`}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', minWidth: '200px', ...style }}>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          padding: '0.4rem 0.75rem',
          paddingRight: value.length > 0 ? '2rem' : '0.75rem',
          borderRadius: '6px',
          border: value.length > 0 ? '1px solid #3b82f6' : '1px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: '36px',
        }}
      >
        <span style={{
          color: displayText ? '#1e293b' : '#94a3b8',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {displayText || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {value.length > 0 && (
            <button
              onClick={handleClear}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 4px', color: '#94a3b8', fontSize: '1rem', lineHeight: 1,
              }}
              title="Clear"
            >×</button>
          )}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>▼</span>
        </div>
      </div>
      {dropdown}
    </div>
  );
};

export default React.memo(MultiSearchableSelect);
