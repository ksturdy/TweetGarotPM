import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface Option {
  value: string | number;
  label: string;
  searchText?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const MAX_VISIBLE = 50;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  disabled = false,
  style,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Memoize valid options (filter out null/empty labels)
  const validOptions = useMemo(
    () => options.filter(opt => opt.label != null && opt.label !== ''),
    [options]
  );

  // Get the selected option's label
  const displayValue = useMemo(() => {
    if (!value) return '';
    const selected = validOptions.find(opt => opt.value.toString() === value);
    return selected?.label ?? '';
  }, [validOptions, value]);

  // Smart filter: each word in the search must appear somewhere in searchText (or label)
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return validOptions;
    const words = searchTerm.toLowerCase().trim().split(/\s+/);
    return validOptions.filter(opt => {
      const text = (opt.searchText || opt.label).toLowerCase();
      return words.every(word => text.includes(word));
    });
  }, [validOptions, searchTerm]);

  // Cap rendered results for performance
  const visibleOptions = useMemo(
    () => filteredOptions.slice(0, MAX_VISIBLE),
    [filteredOptions]
  );
  const hasMore = filteredOptions.length > MAX_VISIBLE;

  // Calculate dropdown position when opening
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Open dropdown and calculate position
  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => {
      if (!prev) {
        // Opening - calculate position
        setTimeout(updatePosition, 0);
      }
      return !prev;
    });
  }, [disabled, updatePosition]);

  // Close dropdown when clicking outside
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

  // Reposition on scroll/resize
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

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = useCallback((optionValue: string | number) => {
    onChange(optionValue.toString());
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  // Render dropdown via portal so it's never clipped by parent overflow
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
      {/* Search input */}
      <div style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Type to search (${validOptions.length} options)...`}
          style={{
            width: '100%',
            padding: '0.4rem 0.5rem',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '0.875rem',
            outline: 'none',
            color: '#1e293b',
            backgroundColor: '#fff',
            boxSizing: 'border-box' as const,
          }}
        />
      </div>

      {/* Options list */}
      <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
        {/* Clear / none option */}
        {!searchTerm && (
          <div
            onClick={() => handleSelect('')}
            style={{
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#94a3b8',
              fontStyle: 'italic',
              borderBottom: '1px solid #f1f5f9'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {placeholder}
          </div>
        )}

        {visibleOptions.length > 0 ? (
          <>
            {visibleOptions.map((option) => {
              const isSelected = option.value.toString() === value;
              return (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#3b82f6' : '#1e293b'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected ? '#eff6ff' : 'transparent';
                  }}
                >
                  {option.label}
                </div>
              );
            })}
            {hasMore && (
              <div style={{
                padding: '0.5rem 0.75rem',
                fontSize: '0.8rem',
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
            padding: '1rem',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '0.875rem'
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
    <div
      style={{
        position: 'relative',
        minWidth: '200px',
        ...style
      }}
      className={className}
    >
      {/* Display field */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          padding: '0.4rem 0.75rem',
          paddingRight: value ? '2rem' : '0.75rem',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '36px'
        }}
      >
        <span style={{ color: displayValue ? '#1e293b' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayValue || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {value && (
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 4px',
                color: '#94a3b8',
                fontSize: '1rem',
                lineHeight: 1
              }}
              title="Clear"
            >
              ×
            </button>
          )}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>▼</span>
        </div>
      </div>

      {dropdown}
    </div>
  );
};

export default React.memo(SearchableSelect);
