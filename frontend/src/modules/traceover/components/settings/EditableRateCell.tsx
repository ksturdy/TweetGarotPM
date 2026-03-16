import { useState, useRef, useEffect, memo } from 'react';

interface EditableRateCellProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

export default memo(function EditableRateCell({ value, onChange }: EditableRateCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === '--') {
      onChange(undefined);
      return;
    }
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num >= 0) {
      onChange(num);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: '100%',
          backgroundColor: '#1a2d47',
          padding: '2px 4px',
          textAlign: 'right',
          fontSize: 12,
          color: '#d4e3f3',
          outline: 'none',
          border: '1px solid #3b82f6',
          borderRadius: 2,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value !== undefined ? String(value) : '');
        setEditing(true);
      }}
      style={{
        width: '100%',
        padding: '2px 4px',
        textAlign: 'right',
        fontSize: 12,
        background: 'none',
        border: 'none',
        borderRadius: 2,
        cursor: 'text',
        color: value !== undefined ? '#d4e3f3' : '#4a6a88',
      }}
    >
      {value !== undefined ? Number(value).toFixed(2) : '--'}
    </button>
  );
});
