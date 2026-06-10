import React from 'react';

interface PillFilterProps {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (next: string | undefined) => void;
}

const PillFilter: React.FC<PillFilterProps> = ({ label, value, options, onChange }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 2, minWidth: 50 }}>
        {label}:
      </span>
      <button
        type="button"
        onClick={() => onChange(undefined)}
        style={pillStyle(!value)}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? undefined : opt)}
          style={pillStyle(value === opt)}
        >
          {opt}
        </button>
      ))}
      {options.length === 0 && (
        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic' }}>
          (none in data yet)
        </span>
      )}
    </div>
  );
};

const pillStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#002356' : 'white',
  color: active ? 'white' : '#475569',
  border: `1px solid ${active ? '#002356' : '#cbd5e1'}`,
  padding: '0.25rem 0.7rem',
  borderRadius: 999,
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

export default PillFilter;
