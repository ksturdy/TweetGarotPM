import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  employees: Employee[];
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
}

const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  employees,
  placeholder,
  rows = 2,
  autoFocus,
  className,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter employees by the mention query
  const filtered = mentionQuery !== null
    ? employees.filter(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        return fullName.includes(mentionQuery.toLowerCase());
      }).slice(0, 6)
    : [];

  const showDropdown = mentionQuery !== null && filtered.length > 0;

  // Sync overlay scroll with textarea
  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Detect @ mention trigger on input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);

    // Look backwards from cursor for an unmatched @
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      // Make sure we're not inside an existing mention tag
      const textFromAt = newValue.slice(lastAt);
      const existingMention = /^@\[[^\]]+\]\(\d+\)/.test(textFromAt);
      if (!existingMention) {
        const textAfterAt = textBeforeCursor.slice(lastAt + 1);
        if (!textAfterAt.includes('\n') && textAfterAt.length <= 30) {
          setMentionQuery(textAfterAt);
          setMentionStart(lastAt);
          setActiveIndex(0);
          return;
        }
      }
    }

    setMentionQuery(null);
  }, [onChange]);

  // Handle keyboard navigation in dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filtered.length > 0)) {
        e.preventDefault();
        selectMention(filtered[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Forward to parent handler (e.g., Enter to post)
    onKeyDown?.(e);
  }, [showDropdown, filtered, activeIndex, onKeyDown]);

  const selectMention = useCallback((emp: Employee) => {
    const displayName = `${emp.first_name} ${emp.last_name}`;
    const mentionTag = `@[${displayName}](${emp.id})`;
    // Replace @query with the mention tag
    const before = value.slice(0, mentionStart);
    const cursorPos = textareaRef.current?.selectionStart || (mentionStart + mentionQuery!.length + 1);
    const after = value.slice(cursorPos);
    const newValue = before + mentionTag + ' ' + after;
    onChange(newValue);
    setMentionQuery(null);

    // Restore focus and set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = before.length + mentionTag.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [value, mentionStart, mentionQuery, onChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (mentionQuery !== null) setMentionQuery(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mentionQuery]);

  // Build overlay: identical text but mention portions get a highlight background.
  // Every character in the overlay matches 1:1 with the textarea so positions align.
  const overlayContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = /@\[([^\]]+)\]\((\d+)\)/g;

    while ((match = regex.exec(value)) !== null) {
      // Plain text before this mention
      if (match.index > lastIndex) {
        parts.push(value.slice(lastIndex, match.index));
      }
      // Render the full raw mention text (same chars) but with highlight styling
      parts.push(
        <mark key={match.index} className="mention-hl">{match[0]}</mark>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < value.length) {
      parts.push(value.slice(lastIndex));
    }

    // Trailing char so overlay always has height
    parts.push('\u00A0');
    return parts;
  }, [value]);

  return (
    <div className="mention-textarea-wrapper" onClick={e => e.stopPropagation()}>
      {showDropdown && (
        <div className="mention-dropdown">
          {filtered.map((emp, idx) => (
            <div
              key={emp.id}
              className={`mention-option ${idx === activeIndex ? 'active' : ''}`}
              onMouseDown={e => {
                e.preventDefault(); // prevent blur
                selectMention(emp);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              <span className="mention-option-name">
                {emp.first_name} {emp.last_name}
              </span>
              {emp.job_title && (
                <span className="mention-option-title">{emp.job_title}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mention-input-container">
        <div
          ref={overlayRef}
          className="mention-overlay"
          aria-hidden="true"
        >
          {overlayContent}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          placeholder={placeholder}
          rows={rows}
          autoFocus={autoFocus}
          className={`mention-textarea ${className || ''}`}
        />
      </div>
    </div>
  );
};

export default MentionTextarea;
