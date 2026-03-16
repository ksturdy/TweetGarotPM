import { Trash2, Plus } from 'lucide-react';
import type { PipingService } from '../../types/pipingSystem';

interface ServiceListProps {
  services: PipingService[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function ServiceList({
  services,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
}: ServiceListProps) {
  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {services.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 10, color: '#4a6a88' }}>
            No services defined yet. Add a service to define what flows through your piping.
          </div>
        )}
        {services.map((svc) => {
          const isSelected = selectedId === svc.id;
          return (
            <button
              key={svc.id}
              onClick={() => onSelect(svc.id)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid rgba(31,52,80,0.5)',
                padding: '10px 12px',
                textAlign: 'left',
                background: isSelected ? '#1a2d47' : 'transparent',
                border: 'none',
                borderLeftWidth: 2,
                borderLeftStyle: 'solid',
                borderLeftColor: isSelected ? '#3b82f6' : 'transparent',
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: 'rgba(31,52,80,0.5)',
                cursor: 'pointer',
              }}
            >
              <span style={{
                height: 12,
                width: 12,
                flexShrink: 0,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: svc.color,
              }} />
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
                  {svc.abbreviation || svc.name}
                </p>
                <p style={{ fontSize: 10, color: '#4a6a88', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {svc.name}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(svc.id); }}
                style={{ flexShrink: 0, borderRadius: 4, padding: 4, color: '#4a6a88', background: 'none', border: 'none', cursor: 'pointer' }}
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
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
          Add Service
        </button>
      </div>
    </div>
  );
}
