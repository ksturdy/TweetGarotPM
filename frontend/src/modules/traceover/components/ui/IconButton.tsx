import type { CSSProperties } from 'react';

interface IconButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  size?: number;
  style?: CSSProperties;
  children: React.ReactNode;
}

export default function IconButton({
  onClick,
  active,
  disabled,
  title,
  size = 32,
  style,
  children,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 6,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: active ? '#1e3a5f' : 'transparent',
        color: active ? '#fff' : '#7a9ab5',
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 0.15s, color 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
