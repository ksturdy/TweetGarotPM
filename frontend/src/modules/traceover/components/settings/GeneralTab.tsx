import type { PipeSpec } from '../../types/pipingSystem';
import {
  JOINT_METHOD_LABELS,
  SYSTEM_MATERIAL_LABELS,
  type JointMethod,
  type SystemMaterial,
} from '../../types/pipingSystem';

interface GeneralTabProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
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

export default function GeneralTab({ spec, onUpdate }: GeneralTabProps) {
  const jointMethodEntries = Object.entries(JOINT_METHOD_LABELS) as [JointMethod, string][];
  const materialEntries = Object.entries(SYSTEM_MATERIAL_LABELS) as [SystemMaterial, string][];

  return (
    <div style={{ maxWidth: 512 }}>
      {/* Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Spec Name</label>
        <input
          type="text"
          value={spec.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          style={selectStyle}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Joint Method</label>
          <select
            value={spec.jointMethod}
            onChange={(e) => onUpdate({ jointMethod: e.target.value as JointMethod })}
            style={selectStyle}
          >
            {jointMethodEntries.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Material</label>
          <select
            value={spec.material}
            onChange={(e) => onUpdate({ material: e.target.value as SystemMaterial })}
            style={selectStyle}
          >
            {materialEntries.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Stock Pipe Length (ft)</label>
          <input
            type="number"
            value={spec.stockPipeLength}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) onUpdate({ stockPipeLength: val });
            }}
            min={1}
            step={1}
            style={selectStyle}
          />
        </div>
      </div>
    </div>
  );
}
