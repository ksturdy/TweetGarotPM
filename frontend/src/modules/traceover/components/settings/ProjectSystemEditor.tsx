import { useState, useRef, useEffect } from 'react';
import type { ProjectSystem, PipingService, PipeSpec } from '../../types/pipingSystem';

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

interface ProjectSystemEditorProps {
  system: ProjectSystem;
  services: PipingService[];
  pipeSpecs: PipeSpec[];
  onUpdate: (updates: Partial<ProjectSystem>) => void;
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  border: '1px solid #1f3450',
  backgroundColor: '#131f33',
  padding: '8px 12px',
  fontSize: 14,
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

export default function ProjectSystemEditor({
  system,
  services,
  pipeSpecs,
  onUpdate,
}: ProjectSystemEditorProps) {
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

  const linkedService = services.find((s) => s.id === system.serviceId);

  return (
    <div style={{ padding: 16 }}>
      {/* Name */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>System Name</label>
        <input
          type="text"
          value={system.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g. Chilled Water Supply"
          style={selectStyle}
        />
      </div>

      {/* Abbreviation */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Abbreviation</label>
        <input
          type="text"
          value={system.abbreviation}
          onChange={(e) => onUpdate({ abbreviation: e.target.value.toUpperCase().slice(0, 8) })}
          placeholder="e.g. CHWS"
          maxLength={8}
          style={{ ...selectStyle, width: 192 }}
        />
      </div>

      {/* Service */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Service</label>
        <select
          value={system.serviceId}
          onChange={(e) => {
            const serviceId = e.target.value;
            const service = services.find((s) => s.id === serviceId);
            onUpdate({
              serviceId,
              ...(service ? { color: service.color } : {}),
            });
          }}
          style={selectStyle}
        >
          <option value="">— Select a service —</option>
          {services.map((svc) => (
            <option key={svc.id} value={svc.id}>
              {svc.abbreviation ? `${svc.abbreviation} — ${svc.name}` : svc.name}
            </option>
          ))}
        </select>
        {services.length === 0 && (
          <p style={{ marginTop: 4, fontSize: 10, color: '#4a6a88' }}>
            No global services configured. Create services in the Services tab first.
          </p>
        )}
      </div>

      {/* Color */}
      <div ref={colorRef} style={{ position: 'relative', marginBottom: 20 }}>
        <label style={labelStyle}>Color</label>
        <button
          type="button"
          onClick={() => setColorOpen(!colorOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 6,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            padding: '8px 12px',
            textAlign: 'left',
            fontSize: 14,
            color: '#d4e3f3',
            cursor: 'pointer',
          }}
        >
          <span style={{ height: 16, width: 16, flexShrink: 0, borderRadius: 2, border: '1px solid rgba(255,255,255,0.2)', backgroundColor: system.color }} />
          {STANDARD_COLORS.find((c) => c.hex === system.color)?.name ?? 'Custom'}
        </button>

        {colorOpen && (
          <div style={{
            position: 'absolute', left: 0, top: '100%', zIndex: 50, marginTop: 4,
            width: 256, borderRadius: 8, border: '1px solid #1f3450', backgroundColor: '#131f33',
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
                    border: system.color === hex ? '2px solid #fff' : '2px solid transparent',
                    backgroundColor: hex,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resolved Info */}
      {linkedService && (
        <div style={{
          borderRadius: 6,
          border: '1px solid rgba(31,52,80,0.5)',
          backgroundColor: '#0d1825',
          padding: 12,
        }}>
          <p style={{ marginBottom: 8, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
            Service Details
          </p>
          <div style={{ fontSize: 12, color: '#7a9ab5' }}>
            <p style={{ margin: '0 0 6px' }}>
              <span style={{ color: '#4a6a88' }}>Category:</span>{' '}
              {linkedService.serviceCategory.replace(/_/g, ' ')}
            </p>
            {linkedService.sizeRules.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <p style={{ color: '#4a6a88', margin: 0 }}>Size Rules:</p>
                {linkedService.sizeRules.map((rule) => {
                  const spec = pipeSpecs.find((s) => s.id === rule.pipeSpecId);
                  return (
                    <p key={rule.id} style={{ marginLeft: 8, margin: '2px 0 2px 8px' }}>
                      &le; {rule.maxSizeInches}" &rarr; {spec?.name ?? 'Unknown spec'}
                    </p>
                  );
                })}
              </div>
            )}
            <p style={{ margin: 0 }}>
              <span style={{ color: '#4a6a88' }}>Default Spec:</span>{' '}
              {pipeSpecs.find((s) => s.id === linkedService.defaultPipeSpecId)?.name ?? 'Not set'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
