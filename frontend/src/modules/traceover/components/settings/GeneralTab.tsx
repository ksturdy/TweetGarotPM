import type { PipeSpec } from '../../types/pipingSystem';
import type { JointType, PipeMaterial } from '../../types/piping';
import {
  JOINT_METHOD_LABELS,
  PIPE_SCHEDULE_LABELS,
  SYSTEM_MATERIAL_LABELS,
  type JointMethod,
  type PipeSchedule,
  type SystemMaterial,
} from '../../types/pipingSystem';
import { JOINT_TYPE_LABELS, MATERIAL_LABELS } from '../../lib/piping/referenceData';

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
  const scheduleEntries = Object.entries(PIPE_SCHEDULE_LABELS) as [PipeSchedule, string][];
  const materialEntries = Object.entries(SYSTEM_MATERIAL_LABELS) as [SystemMaterial, string][];
  const jointTypeEntries = Object.entries(JOINT_TYPE_LABELS) as [JointType, string][];
  const pipeMaterialEntries = Object.entries(MATERIAL_LABELS) as [PipeMaterial, string][];

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
          <label style={labelStyle}>Schedule / Weight</label>
          <select
            value={spec.schedule}
            onChange={(e) => onUpdate({ schedule: e.target.value as PipeSchedule })}
            style={selectStyle}
          >
            {scheduleEntries.map(([value, label]) => (
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

      <div style={{ borderTop: '1px solid #1f3450', paddingTop: 16 }}>
        <p style={{ marginBottom: 12, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4a6a88' }}>
          Compatibility Mapping
        </p>
        <p style={{ marginBottom: 12, fontSize: 10, color: '#4a6a88' }}>
          These map this spec to the existing traceover type system for takeoff generation.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Joint Type</label>
            <select
              value={spec.jointType}
              onChange={(e) => onUpdate({ jointType: e.target.value as JointType })}
              style={selectStyle}
            >
              {jointTypeEntries.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Pipe Material</label>
            <select
              value={spec.pipeMaterial}
              onChange={(e) => onUpdate({ pipeMaterial: e.target.value as PipeMaterial })}
              style={selectStyle}
            >
              {pipeMaterialEntries.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
