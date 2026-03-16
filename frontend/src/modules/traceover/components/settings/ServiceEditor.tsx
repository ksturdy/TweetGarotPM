import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { PipingService } from '../../types/pipingSystem';
import type { PipeServiceType } from '../../types/piping';
import { SERVICE_TYPE_LABELS, PIPE_SIZES_EXTENDED } from '../../lib/piping/referenceData';
import { useSettingsStore } from '../../stores/useSettingsStore';

const STANDARD_COLORS: { hex: string; name: string }[] = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#dc2626', name: 'Dark Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#2563eb', name: 'Dark Blue' },
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#f472b6', name: 'Light Pink' },
  { hex: '#fb923c', name: 'Light Orange' },
  { hex: '#a3a3a3', name: 'Gray' },
  { hex: '#ffffff', name: 'White' },
];

interface ServiceEditorProps {
  service: PipingService;
  onUpdate: (updates: Partial<PipingService>) => void;
  onAddSizeRule: (maxSize: number, specId: string) => void;
  onRemoveSizeRule: (ruleId: string) => void;
  onUpdateSizeRule: (ruleId: string, updates: { maxSizeInches?: number; pipeSpecId?: string }) => void;
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  border: '1px solid #1f3450',
  backgroundColor: '#131f33',
  padding: '6px 8px',
  fontSize: 12,
  color: '#d4e3f3',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#4a6a88',
};

export default function ServiceEditor({
  service,
  onUpdate,
  onAddSizeRule,
  onRemoveSizeRule,
  onUpdateSizeRule,
}: ServiceEditorProps) {
  const pipeSpecs = useSettingsStore((s) => s.pipeSpecs);
  const serviceEntries = Object.entries(SERVICE_TYPE_LABELS) as [PipeServiceType, string][];

  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colorOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorOpen]);

  return (
    <div style={{ padding: 16, maxWidth: 512 }}>
      {/* Name */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Service Name</label>
        <input
          type="text"
          value={service.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g. Chilled Water Supply"
          style={selectStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Abbreviation</label>
          <input
            type="text"
            value={service.abbreviation}
            onChange={(e) => onUpdate({ abbreviation: e.target.value.toUpperCase() })}
            placeholder="e.g. CHWS"
            maxLength={8}
            style={selectStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={service.serviceCategory}
            onChange={(e) => onUpdate({ serviceCategory: e.target.value as PipeServiceType })}
            style={selectStyle}
          >
            {serviceEntries.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Color */}
      <div ref={colorRef} style={{ position: 'relative', marginBottom: 20 }}>
        <label style={labelStyle}>Color</label>
        <button
          type="button"
          onClick={() => setColorOpen(!colorOpen)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 8,
            borderRadius: 6,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            padding: '6px 8px',
            textAlign: 'left',
            fontSize: 12,
            color: '#d4e3f3',
            cursor: 'pointer',
          }}
        >
          <span style={{ height: 16, width: 16, flexShrink: 0, borderRadius: 2, border: '1px solid rgba(255,255,255,0.2)', backgroundColor: service.color }} />
          {STANDARD_COLORS.find((c) => c.hex === service.color)?.name ?? 'Custom'}
        </button>
        {colorOpen && (
          <div style={{
            position: 'absolute', left: 0, top: '100%', zIndex: 50, marginTop: 4,
            width: '100%', borderRadius: 8, border: '1px solid #1f3450', backgroundColor: '#131f33',
            padding: 8, boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {STANDARD_COLORS.map(({ hex, name }) => (
                <button
                  key={hex}
                  type="button"
                  title={name}
                  onClick={() => { onUpdate({ color: hex }); setColorOpen(false); }}
                  style={{
                    height: 24,
                    width: '100%',
                    borderRadius: 2,
                    border: service.color === hex ? '2px solid #fff' : '2px solid transparent',
                    backgroundColor: hex,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Default Pipe Spec */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Default Pipe Spec</label>
        <p style={{ marginBottom: 6, fontSize: 10, color: '#4a6a88' }}>
          Used for pipe sizes not covered by size rules below.
        </p>
        <select
          value={service.defaultPipeSpecId}
          onChange={(e) => onUpdate({ defaultPipeSpecId: e.target.value })}
          style={selectStyle}
        >
          <option value="">-- Select Pipe Spec --</option>
          {pipeSpecs.map((spec) => (
            <option key={spec.id} value={spec.id}>{spec.name}</option>
          ))}
        </select>
      </div>

      {/* Size-Based Rules */}
      <div style={{ borderTop: '1px solid #1f3450', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#7a9ab5', margin: 0 }}>Size-Based Spec Rules</p>
            <p style={{ fontSize: 10, color: '#4a6a88', marginTop: 2, margin: 0 }}>
              Override the default spec for specific size ranges. Rules are evaluated smallest-first.
            </p>
          </div>
          <button
            onClick={() => {
              const defaultSpecId = pipeSpecs[0]?.id ?? '';
              onAddSizeRule(2, defaultSpecId);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 6,
              backgroundColor: '#131f33',
              border: '1px solid #1f3450',
              padding: '4px 8px',
              fontSize: 10,
              color: '#3b82f6',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} />
            Add Rule
          </button>
        </div>

        {service.sizeRules.length === 0 ? (
          <p style={{ fontSize: 10, color: '#4a6a88', fontStyle: 'italic' }}>
            No size rules — all sizes use the default spec above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {service.sizeRules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 6,
                  border: '1px solid #1f3450',
                  backgroundColor: '#131f33',
                  padding: 8,
                }}
              >
                <span style={{ fontSize: 10, color: '#4a6a88', whiteSpace: 'nowrap' }}>Sizes</span>
                <span style={{ fontSize: 10, color: '#7a9ab5' }}>&le;</span>
                <select
                  value={rule.maxSizeInches}
                  onChange={(e) => onUpdateSizeRule(rule.id, { maxSizeInches: parseFloat(e.target.value) })}
                  style={{
                    borderRadius: 4,
                    border: '1px solid #1f3450',
                    backgroundColor: '#0d1825',
                    padding: '4px 6px',
                    fontSize: 10,
                    color: '#d4e3f3',
                    outline: 'none',
                    width: 64,
                  }}
                >
                  {PIPE_SIZES_EXTENDED.map((s) => (
                    <option key={s.nominal} value={s.nominalInches}>
                      {s.displayLabel}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 10, color: '#4a6a88' }}>use</span>
                <select
                  value={rule.pipeSpecId}
                  onChange={(e) => onUpdateSizeRule(rule.id, { pipeSpecId: e.target.value })}
                  style={{
                    flex: 1,
                    borderRadius: 4,
                    border: '1px solid #1f3450',
                    backgroundColor: '#0d1825',
                    padding: '4px 6px',
                    fontSize: 10,
                    color: '#d4e3f3',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Select --</option>
                  {pipeSpecs.map((spec) => (
                    <option key={spec.id} value={spec.id}>{spec.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => onRemoveSizeRule(rule.id)}
                  style={{ flexShrink: 0, borderRadius: 4, padding: 4, color: '#4a6a88', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
