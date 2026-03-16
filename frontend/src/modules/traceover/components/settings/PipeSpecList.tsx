import { Trash2, Copy, Plus } from 'lucide-react';
import type { PipeSpec } from '../../types/pipingSystem';
import { JOINT_METHOD_LABELS, SYSTEM_MATERIAL_LABELS } from '../../types/pipingSystem';

interface PipeSpecListProps {
  specs: PipeSpec[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function PipeSpecList({
  specs,
  selectedId,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
}: PipeSpecListProps) {
  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {specs.map((spec) => {
          const isSelected = selectedId === spec.id;
          return (
            <button
              key={spec.id}
              onClick={() => onSelect(spec.id)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
                gap: 8,
                borderBottom: '1px solid rgba(31,52,80,0.5)',
                padding: '10px 12px',
                textAlign: 'left',
                background: isSelected ? '#1a2d47' : 'transparent',
                borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
                border: 'none',
                borderRight: 'none',
                borderTop: 'none',
                borderBottomStyle: 'solid',
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(31,52,80,0.5)',
                borderLeftWidth: 2,
                borderLeftStyle: 'solid',
                borderLeftColor: isSelected ? '#3b82f6' : 'transparent',
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
                  {spec.name}
                </p>
                <p style={{ fontSize: 10, color: '#4a6a88', marginTop: 2, margin: 0 }}>
                  {JOINT_METHOD_LABELS[spec.jointMethod]} · {SYSTEM_MATERIAL_LABELS[spec.material]}
                </p>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate(spec.id); }}
                  style={{ borderRadius: 4, padding: 4, color: '#4a6a88', background: 'none', border: 'none', cursor: 'pointer' }}
                  title="Duplicate"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(spec.id); }}
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
          Add Pipe Spec
        </button>
      </div>
    </div>
  );
}
