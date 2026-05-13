import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  job_title?: string | null;
}

interface MentionRange {
  start: number;
  end: number;
  employeeId: number;
  displayName: string;
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

const MARKUP_REGEX = /@\[([^\]]+)\]\((\d+)\)/g;

// Convert markup like "Hello @[Brian Smith](4)" to display "Hello @Brian Smith"
// plus the position of each mention in the display string.
function parseMarkup(markup: string): { display: string; ranges: MentionRange[] } {
  const ranges: MentionRange[] = [];
  let display = '';
  let lastIndex = 0;
  MARKUP_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKUP_REGEX.exec(markup)) !== null) {
    display += markup.slice(lastIndex, match.index);
    const displayName = match[1];
    const employeeId = parseInt(match[2], 10);
    const displayMention = `@${displayName}`;
    const start = display.length;
    display += displayMention;
    ranges.push({ start, end: display.length, employeeId, displayName });
    lastIndex = match.index + match[0].length;
  }
  display += markup.slice(lastIndex);
  return { display, ranges };
}

function buildMarkup(display: string, ranges: MentionRange[]): string {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let result = '';
  let pos = 0;
  for (const r of sorted) {
    result += display.slice(pos, r.start);
    result += `@[${r.displayName}](${r.employeeId})`;
    pos = r.end;
  }
  result += display.slice(pos);
  return result;
}

// Shift / drop existing mention ranges based on a diff between old and new display.
// Any range that overlaps the edit region is dropped (mention becomes plain text).
function adjustRanges(oldDisplay: string, newDisplay: string, ranges: MentionRange[]): MentionRange[] {
  const minLen = Math.min(oldDisplay.length, newDisplay.length);
  let prefixLen = 0;
  while (prefixLen < minLen && oldDisplay[prefixLen] === newDisplay[prefixLen]) prefixLen++;
  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    oldDisplay[oldDisplay.length - 1 - suffixLen] === newDisplay[newDisplay.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }
  const oldSuffixStart = oldDisplay.length - suffixLen;
  const lengthDiff = newDisplay.length - oldDisplay.length;

  return ranges.flatMap(r => {
    if (r.end <= prefixLen) return [r];
    if (r.start >= oldSuffixStart) {
      return [{ ...r, start: r.start + lengthDiff, end: r.end + lengthDiff }];
    }
    return [];
  });
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

  // value is markup (stored format). The textarea shows the parsed display text.
  const { display, ranges } = useMemo(() => parseMarkup(value), [value]);

  const filtered = mentionQuery !== null
    ? employees.filter(emp => {
        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
        return fullName.includes(mentionQuery.toLowerCase());
      }).slice(0, 6)
    : [];

  const showDropdown = mentionQuery !== null && filtered.length > 0;

  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const emit = useCallback((newDisplay: string, newRanges: MentionRange[]) => {
    onChange(buildMarkup(newDisplay, newRanges));
  }, [onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDisplay = e.target.value;
    const newRanges = adjustRanges(display, newDisplay, ranges);
    emit(newDisplay, newRanges);

    // Detect @ trigger from the just-typed display text
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = newDisplay.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const insideMention = newRanges.some(r => lastAt >= r.start && lastAt < r.end);
      if (!insideMention) {
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
  }, [display, ranges, emit]);

  const selectMention = useCallback((emp: Employee) => {
    const displayName = `${emp.first_name} ${emp.last_name}`;
    const displayMention = `@${displayName}`;
    const cursorPos = textareaRef.current?.selectionStart ?? (mentionStart + (mentionQuery?.length ?? 0) + 1);
    const before = display.slice(0, mentionStart);
    const after = display.slice(cursorPos);
    const newDisplay = before + displayMention + ' ' + after;

    const lengthDiff = (displayMention.length + 1) - (cursorPos - mentionStart);
    const shifted = ranges.flatMap(r => {
      if (r.end <= mentionStart) return [r];
      if (r.start >= cursorPos) return [{ ...r, start: r.start + lengthDiff, end: r.end + lengthDiff }];
      return [];
    });

    const newMention: MentionRange = {
      start: mentionStart,
      end: mentionStart + displayMention.length,
      employeeId: emp.id,
      displayName,
    };

    const newRanges = [...shifted, newMention].sort((a, b) => a.start - b.start);
    emit(newDisplay, newRanges);
    setMentionQuery(null);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + displayMention.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [display, ranges, mentionStart, mentionQuery, emit]);

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

    // Backspace just after a mention deletes the whole mention as one unit
    if (e.key === 'Backspace' && textareaRef.current) {
      const ta = textareaRef.current;
      if (ta.selectionStart === ta.selectionEnd) {
        const pos = ta.selectionStart;
        const r = ranges.find(rg => rg.end === pos);
        if (r) {
          e.preventDefault();
          const removedLen = r.end - r.start;
          const newDisplay = display.slice(0, r.start) + display.slice(r.end);
          const newRanges = ranges
            .filter(rg => rg !== r)
            .map(rg => rg.start >= r.end
              ? { ...rg, start: rg.start - removedLen, end: rg.end - removedLen }
              : rg);
          emit(newDisplay, newRanges);
          setTimeout(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(r.start, r.start);
          }, 0);
          return;
        }
      }
    }

    onKeyDown?.(e);
  }, [showDropdown, filtered, activeIndex, selectMention, ranges, display, emit, onKeyDown]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (mentionQuery !== null) setMentionQuery(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mentionQuery]);

  const overlayContent = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    for (const r of sorted) {
      if (r.start > cursor) parts.push(display.slice(cursor, r.start));
      parts.push(
        <mark key={r.start} className="mention-hl">{display.slice(r.start, r.end)}</mark>
      );
      cursor = r.end;
    }
    if (cursor < display.length) parts.push(display.slice(cursor));
    parts.push(' ');
    return parts;
  }, [display, ranges]);

  return (
    <div className="mention-textarea-wrapper" onClick={e => e.stopPropagation()}>
      {showDropdown && (
        <div className="mention-dropdown">
          {filtered.map((emp, idx) => (
            <div
              key={emp.id}
              className={`mention-option ${idx === activeIndex ? 'active' : ''}`}
              onMouseDown={e => {
                e.preventDefault();
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
          value={display}
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
