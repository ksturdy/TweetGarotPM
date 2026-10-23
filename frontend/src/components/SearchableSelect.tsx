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
  onSearchTermChange?: (term: string) => void;
  compact?: boolean;
  autoOpen?: boolean;
}

const MAX_VISIBLE = 50;

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  disabled = false,
  style,
  className,
  onSearchTermChange,
  compact = false,
  autoOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, flipUp: false });
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const validOptions = useMemo(
    () => options.filter(opt => opt.label != null && opt.label !== ''),
    [options]
  );

  const displayValue = useMemo(() => {
    if (!value) return '';
    const selected = validOptions.find(opt => opt.value.toString() === value);
    return selected?.label ?? '';
  }, [validOptions, value]);

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

  // Reset highlight when search changes
  useEffect(() => { setHighlightedIndex(0); }, [searchTerm]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const DROPDOWN_MAX_HEIGHT = 308;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const flipUp = spaceBelow < DROPDOWN_MAX_HEIGHT && rect.top > spaceBelow;
      setDropdownPos({
        top: flipUp ? rect.top - DROPDOWN_MAX_HEIGHT - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        flipUp,
      });
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => {
      if (!prev) setTimeout(updatePosition, 0);
      return !prev;
    });
  }, [disabled, updatePosition]);

  // Auto-open positioning
  useEffect(() => {
    if (autoOpen) {
      setTimeout(updatePosition, 0);
    }
  }, [autoOpen, updatePosition]);

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

  // Scroll highlighted row into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector<HTMLElement>('[data-highlighted="true"]');
    if (highlighted) highlighted.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const selectOption = useCallback((optionValue: string | number) => {
    onChange(optionValue.toString());
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, visibleOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (visibleOptions.length > 0) {
        e.preventDefault();
        selectOption(visibleOptions[highlightedIndex]?.value ?? visibleOptions[0].value);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [visibleOptions, highlightedIndex, selectOption]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  }, [onChange]);

  const dropdown = isOpen ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: Math.max(8, dropdownPos.top),
        left: dropdownPos.left,
        width: dropdownPos.width,
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        boxShadow: dropdownPos.flipUp
          ? '0 -4px 12px rgba(0,0,0,0.15)'
          : '0 4px 12px rgba(0,0,0,0.15)',
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
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onSearchTermChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
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

      <div ref={listRef} style={{ overflowY: 'auto', maxHeight: '240px' }}>
        {!searchTerm && (
          <div
            onClick={() => selectOption('')}
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
            {visibleOptions.map((option, idx) => {
              const isSelected = option.value.toString() === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={option.value}
                  data-highlighted={isHighlighted ? 'true' : undefined}
                  onClick={() => selectOption(option.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    background: isHighlighted ? '#eff6ff' : isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected || isHighlighted ? '#3b82f6' : '#1e293b',
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
      style={{ position: 'relative', minWidth: '200px', ...style }}
      className={className}
    >
      <div
        ref={triggerRef}
        className="searchable-select-trigger"
        onClick={handleToggle}
        style={{
          padding: compact ? '0.375rem 0.5rem' : '0.4rem 0.75rem',
          paddingRight: value ? (compact ? '1.5rem' : '2rem') : (compact ? '0.5rem' : '0.75rem'),
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          background: disabled ? '#f1f5f9' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: compact ? '0.8125rem' : '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: compact ? undefined : '36px'
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
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 4px', color: '#94a3b8', fontSize: '1rem', lineHeight: 1
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
