import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePdfStore } from '../../stores/usePdfStore';

export default function PageNavigator() {
  const activeDocumentId = usePdfStore((s) => s.activeDocumentId);
  const activePageNumber = usePdfStore((s) => s.activePageNumber);
  const setActivePage = usePdfStore((s) => s.setActivePage);
  const documents = usePdfStore((s) => s.documents);

  const activeDocument = documents.find((d) => d.id === activeDocumentId);
  const pageCount = activeDocument?.pageCount ?? 0;

  const [editValue, setEditValue] = useState(String(activePageNumber));
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(activePageNumber));
    }
  }, [activePageNumber, isEditing]);

  const commitPage = useCallback(() => {
    const parsed = parseInt(editValue, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= pageCount) {
      setActivePage(parsed);
    } else {
      setEditValue(String(activePageNumber));
    }
    setIsEditing(false);
  }, [editValue, pageCount, activePageNumber, setActivePage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commitPage();
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        setEditValue(String(activePageNumber));
        setIsEditing(false);
        inputRef.current?.blur();
      }
    },
    [commitPage, activePageNumber],
  );

  const handlePrevious = useCallback(() => {
    if (activePageNumber > 1) setActivePage(activePageNumber - 1);
  }, [activePageNumber, setActivePage]);

  const handleNext = useCallback(() => {
    if (activePageNumber < pageCount) setActivePage(activePageNumber + 1);
  }, [activePageNumber, pageCount, setActivePage]);

  if (!activeDocumentId || pageCount === 0) return null;

  const navBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#7a9ab5',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        title="Previous page"
        disabled={activePageNumber <= 1}
        onClick={handlePrevious}
        style={{ ...navBtnStyle, opacity: activePageNumber <= 1 ? 0.4 : 1 }}
      >
        <ChevronLeft size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={isEditing ? editValue : String(activePageNumber)}
          onChange={(e) => setEditValue(e.target.value)}
          onFocus={() => {
            setIsEditing(true);
            setEditValue(String(activePageNumber));
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onBlur={commitPage}
          onKeyDown={handleKeyDown}
          aria-label="Current page number"
          style={{
            width: 36,
            borderRadius: 6,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            padding: '4px 6px',
            textAlign: 'center',
            fontSize: 12,
            color: '#d4e3f3',
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: '#4a6a88' }}>/ {pageCount}</span>
      </div>

      <button
        type="button"
        title="Next page"
        disabled={activePageNumber >= pageCount}
        onClick={handleNext}
        style={{ ...navBtnStyle, opacity: activePageNumber >= pageCount ? 0.4 : 1 }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
