import type { CSSProperties } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
  children: React.ReactNode;
  type?: 'button' | 'submit';
}

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: { backgroundColor: '#1e3a5f', color: '#fff' },
  secondary: { backgroundColor: '#fff', color: '#374151', border: '1px solid #d1d5db' },
  ghost: { backgroundColor: 'transparent', color: '#374151' },
  danger: { backgroundColor: '#dc2626', color: '#fff' },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12 },
  md: { padding: '8px 16px', fontSize: 14 },
  lg: { padding: '12px 24px', fontSize: 16 },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  style,
  children,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
