import { ChevronDown, ChevronRight } from 'lucide-react';

interface DrawingGroupHeaderProps {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  variant: 'alternate' | 'addendum';
}

export default function DrawingGroupHeader({
  label,
  count,
  isOpen,
  onToggle,
  variant,
}: DrawingGroupHeaderProps) {
  const labelColor = variant === 'alternate' ? 'rgba(251, 191, 36, 0.7)' : 'rgba(52, 211, 153, 0.7)';

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 4,
        borderRadius: 4,
        padding: '4px 4px',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#4a6a88',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      <span style={{ color: labelColor }}>{label}</span>
      <span
        style={{
          marginLeft: 'auto',
          borderRadius: 9999,
          backgroundColor: '#1f3450',
          padding: '1px 6px',
          fontSize: 9,
          fontWeight: 500,
          color: '#4a6a88',
        }}
      >
        {count}
      </span>
    </button>
  );
}
