interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
}

export default function Badge({ children, color = '#d4e3f3', bg = '#1f3450' }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 8px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 500,
        color,
        backgroundColor: bg,
      }}
    >
      {children}
    </span>
  );
}
