import { useState } from 'react';
import { Trash2, Plus, ChevronDown } from 'lucide-react';
import type { ProjectSystem } from '../../types/pipingSystem';
import type { PipeServiceType } from '../../types/piping';
import { SYSTEM_PRESETS } from '../../types/pipingSystem';

interface ProjectSystemListProps {
  systems: ProjectSystem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (preset?: { name: string; abbreviation: string; color: string }) => void;
  onRemove: (id: string) => void;
}

export default function ProjectSystemList({
  systems,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
}: ProjectSystemListProps) {
  const [showPresets, setShowPresets] = useState(false);

  const presetEntries = Object.entries(SYSTEM_PRESETS) as [
    PipeServiceType,
    { name: string; abbreviation: string; color: string },
  ][];

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {systems.map((sys) => {
          const isSelected = selectedId === sys.id;
          return (
            <button
              key={sys.id}
              onClick={() => onSelect(sys.id)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
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
                marginTop: 4,
                height: 12,
                width: 12,
                flexShrink: 0,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: sys.color,
              }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  fontWeight: 500,
                  color: isSelected ? '#d4e3f3' : '#7a9ab5',
                  margin: 0,
                }}>
                  {sys.abbreviation ? `${sys.abbreviation} — ${sys.name}` : sys.name}
                </p>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, gap: 2 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(sys.id); }}
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

      <div style={{ position: 'relative', borderTop: '1px solid #1f3450', padding: 8 }}>
        <button
          onClick={() => setShowPresets(!showPresets)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 6,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            padding: '8px 12px',
            fontSize: 12,
            color: '#3b82f6',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add System
          <ChevronDown size={12} style={{ transform: showPresets ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
        </button>

        {showPresets && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 8,
            right: 8,
            marginBottom: 4,
            maxHeight: 256,
            overflowY: 'auto',
            borderRadius: 8,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          }}>
            <button
              onClick={() => { onAdd(); setShowPresets(false); }}
              style={{
                width: '100%',
                borderBottom: '1px solid rgba(31,52,80,0.5)',
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: 12,
                color: '#d4e3f3',
                background: 'none',
                border: 'none',
                borderBottomWidth: 1,
                borderBottomStyle: 'solid',
                borderBottomColor: 'rgba(31,52,80,0.5)',
                cursor: 'pointer',
              }}
            >
              Blank System
            </button>
            {presetEntries.map(([key, preset]) => (
              <button
                key={key}
                onClick={() => { onAdd(preset); setShowPresets(false); }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  textAlign: 'left',
                  fontSize: 12,
                  color: '#7a9ab5',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ height: 10, width: 10, flexShrink: 0, borderRadius: '50%', backgroundColor: preset.color }} />
                <span style={{ fontWeight: 500, color: '#4a6a88' }}>{preset.abbreviation}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
