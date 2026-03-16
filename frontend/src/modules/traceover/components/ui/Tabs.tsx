interface TabListProps {
  children: React.ReactNode;
}

export function TabList({ children }: TabListProps) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid #1f3450',
        backgroundColor: '#0d1825',
        padding: 6,
      }}
    >
      {children}
    </div>
  );
}

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Tab({ label, active, onClick }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: 8,
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.15s, color 0.15s',
        backgroundColor: active ? '#3b82f6' : 'transparent',
        color: active ? '#fff' : '#7a9ab5',
      }}
    >
      {label}
    </button>
  );
}
