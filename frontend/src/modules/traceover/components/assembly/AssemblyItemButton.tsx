import type { AssemblyDefinition } from '../../types/assembly';

interface AssemblyItemButtonProps {
  assembly: AssemblyDefinition;
  isSelected: boolean;
  onClick: () => void;
}

export default function AssemblyItemButton({ assembly, isSelected, onClick }: AssemblyItemButtonProps) {
  const totalItems = assembly.runs.length + assembly.placedItems.length;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 8,
        borderRadius: 6,
        padding: '6px 8px',
        textAlign: 'left',
        fontSize: 14,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.15s, color 0.15s',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
        color: isSelected ? '#d4e3f3' : '#7a9ab5',
        ...(isSelected ? { boxShadow: 'inset 0 0 0 1px rgba(59, 130, 246, 0.4)' } : {}),
      }}
    >
      {assembly.thumbnailDataUrl ? (
        <img
          src={assembly.thumbnailDataUrl}
          alt={assembly.name}
          style={{
            height: 32,
            width: 40,
            flexShrink: 0,
            borderRadius: 4,
            border: '1px solid #1f3450',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            height: 32,
            width: 40,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            border: '1px solid #1f3450',
            backgroundColor: '#0d1825',
            fontSize: 10,
            color: '#4a6a88',
          }}
        >
          ASM
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500 }}>
          {assembly.name}
        </div>
        <div style={{ fontSize: 10, color: '#4a6a88' }}>
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </div>
      </div>
    </button>
  );
}
