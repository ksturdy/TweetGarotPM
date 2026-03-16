import { Trash2, Copy, Plus } from 'lucide-react';
import type { RateTable } from '../../types/pipingSystem';
import { RATE_TABLE_CATEGORY_LABELS, type RateTableCategory } from '../../types/pipingSystem';

interface RateTableListProps {
  tables: RateTable[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function RateTableList({
  tables,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
}: RateTableListProps) {
  // Group tables by category
  const grouped = new Map<string, RateTable[]>();
  for (const t of tables) {
    const cat = t.category || 'other';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(t);
  }

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tables.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: '#4a6a88', textAlign: 'center' }}>
            No rate tables yet. Click "Add Rate Table" or import from a rate book.
          </div>
        )}
        {[...grouped.entries()].map(([category, catTables]) => (
          <div key={category}>
            <div style={{
              padding: '6px 12px',
              fontSize: 9,
              fontWeight: 600,
              color: '#4a6a88',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: '#0a1420',
              borderBottom: '1px solid rgba(31,52,80,0.5)',
            }}>
              {RATE_TABLE_CATEGORY_LABELS[category as RateTableCategory] ?? category}
            </div>
            {catTables.map((table) => {
              const isSelected = selectedId === table.id;
              return (
                <button
                  key={table.id}
                  onClick={() => onSelect(table.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    textAlign: 'left',
                    background: isSelected ? '#1a2d47' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(31,52,80,0.5)',
                    borderLeft: `2px solid ${isSelected ? '#3b82f6' : 'transparent'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isSelected ? '#d4e3f3' : '#7a9ab5',
                      margin: 0,
                    }}>
                      {table.name}
                    </p>
                    <p style={{ fontSize: 10, color: '#4a6a88', marginTop: 2, margin: 0 }}>
                      {table.columns.length} column{table.columns.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(table.id); }}
                      style={{ borderRadius: 4, padding: 4, color: '#4a6a88', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Duplicate"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(table.id); }}
                      style={{ borderRadius: 4, padding: 4, color: '#4a6a88', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #1f3450', padding: 8 }}>
        <button
          onClick={onAdd}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 6,
            backgroundColor: '#131f33',
            border: '1px solid #1f3450',
            padding: '8px 12px',
            fontSize: 12,
            color: '#3b82f6',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add Rate Table
        </button>
      </div>
    </div>
  );
}
