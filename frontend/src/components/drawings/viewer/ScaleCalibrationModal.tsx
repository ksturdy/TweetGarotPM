import React, { useState } from 'react';
import type { MeasurementUnit } from '../../../lib/drawingViewer/types';

interface Props {
  onSave: (realValue: number, unit: MeasurementUnit) => void;
  onCancel: () => void;
}

export default function ScaleCalibrationModal({ onSave, onCancel }: Props) {
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<MeasurementUnit>('ft');

  const handleSave = () => {
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0) return;
    onSave(v, unit);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f1b2d', border: '1px solid #1e3a5f',
        borderRadius: 10, padding: 24, minWidth: 320,
      }}>
        <h3 style={{ color: '#cdd8e5', margin: '0 0 16px', fontSize: 16 }}>
          Set Scale Calibration
        </h3>
        <p style={{ color: '#7a9ab5', fontSize: 13, margin: '0 0 16px' }}>
          You drew a line on the drawing. Enter its real-world length to set the scale.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Length"
            min="0.01"
            step="0.01"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{
              flex: 1, background: '#162032', border: '1px solid #1e3a5f',
              borderRadius: 6, color: '#cdd8e5', fontSize: 14, padding: '8px 12px',
            }}
          />
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as MeasurementUnit)}
            style={{
              background: '#162032', border: '1px solid #1e3a5f',
              borderRadius: 6, color: '#cdd8e5', fontSize: 14, padding: '8px 12px',
            }}
          >
            <option value="ft">ft</option>
            <option value="in">in</option>
            <option value="m">m</option>
            <option value="mm">mm</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={!value} style={saveBtn}>Set Scale</button>
        </div>
      </div>
    </div>
  );
}

const cancelBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #2d72d9',
  color: '#7a9ab5', borderRadius: 6, padding: '8px 16px',
  fontSize: 13, cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  background: '#1e4a8a', border: 'none',
  color: '#fff', borderRadius: 6, padding: '8px 16px',
  fontSize: 13, cursor: 'pointer',
};
