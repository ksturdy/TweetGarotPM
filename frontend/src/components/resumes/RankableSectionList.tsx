import React from 'react';

interface RankableSectionListProps<T> {
  items: T[];
  limit?: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  onEdit?: (index: number) => void;
  renderContent: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
}

function RankableSectionListInner<T>({
  items,
  limit,
  onMove,
  onRemove,
  onEdit,
  renderContent,
  emptyMessage = 'Nothing added yet.',
}: RankableSectionListProps<T>) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.85rem',
          fontStyle: 'italic',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const showLimitChip = typeof limit === 'number' && limit >= 0;
  const visibleCount = showLimitChip ? Math.min(items.length, limit!) : items.length;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {showLimitChip && (
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#6b7280',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
          }}
        >
          {visibleCount} of {items.length} will appear in PDF
          {items.length > limit! && (
            <span style={{ color: '#ef4444', marginLeft: '0.5rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
              (template caps at {limit})
            </span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {items.map((item, index) => {
          const withinLimit = !showLimitChip || index < limit!;
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.5rem 0.6rem',
                backgroundColor: withinLimit ? '#f9fafb' : '#fafafa',
                border: `1px solid ${withinLimit ? '#e5e7eb' : '#e5e7eb'}`,
                borderRadius: 6,
                opacity: withinLimit ? 1 : 0.5,
              }}
            >
              {/* Position badge */}
              <span
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: withinLimit ? '#2563eb' : '#d1d5db',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
                title={withinLimit ? `Position ${index + 1}` : `Position ${index + 1} (beyond template limit)`}
              >
                {index + 1}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, fontSize: '0.875rem', color: '#1f2937' }}>
                {renderContent(item, index)}
              </div>

              {/* Edit + move + remove */}
              <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(index)}
                    title="Edit"
                    style={{
                      ...iconBtnStyle(false),
                      color: '#2563eb',
                      borderColor: '#bfdbfe',
                    }}
                  >
                    ✎
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onMove(index, index - 1)}
                  disabled={index === 0}
                  title="Move up"
                  style={iconBtnStyle(index === 0)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, index + 1)}
                  disabled={index === items.length - 1}
                  title="Move down"
                  style={iconBtnStyle(index === items.length - 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  title="Remove"
                  style={{
                    ...iconBtnStyle(false),
                    color: '#ef4444',
                    borderColor: '#fecaca',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const iconBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  backgroundColor: disabled ? '#f3f4f6' : 'white',
  color: disabled ? '#9ca3af' : '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.85rem',
  padding: 0,
});

// Cast wrapper to preserve generic signature when default-exported
const RankableSectionList = RankableSectionListInner as <T>(props: RankableSectionListProps<T>) => React.ReactElement;
export default RankableSectionList;
