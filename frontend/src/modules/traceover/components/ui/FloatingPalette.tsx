import { useState, useRef, useCallback, useEffect } from 'react';

interface FloatingPaletteProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  width?: number;
}

export default function FloatingPalette({
  title,
  open,
  onClose,
  children,
  defaultPosition = { x: 260, y: 80 },
  width = 240,
}: FloatingPaletteProps) {
  const [position, setPosition] = useState(defaultPosition);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: position.x,
        originY: position.y,
      };

      const handleMouseMove = (me: MouseEvent) => {
        if (!dragRef.current) return;
        setPosition({
          x: dragRef.current.originX + (me.clientX - dragRef.current.startX),
          y: dragRef.current.originY + (me.clientY - dragRef.current.startY),
        });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [position],
  );

  useEffect(() => {
    if (open) setPosition(defaultPosition);
  }, [open]); // eslint-disable-line

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 50,
        left: position.x,
        top: position.y,
        width,
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          border: '1px solid #1f3450',
          backgroundColor: '#131f33',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Title bar — draggable */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1f3450',
            padding: '8px 12px',
            cursor: 'grab',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#d4e3f3' }}>
            ⠿ {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: '#4a6a88',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
