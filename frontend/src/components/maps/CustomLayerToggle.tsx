import React from 'react';
import type { CustomMapLayer } from '../../services/customMapLayers';

interface CustomLayerToggleProps {
  layers: CustomMapLayer[];
  enabledIds: number[];
  onToggle: (id: number) => void;
}

const CustomLayerToggle: React.FC<CustomLayerToggleProps> = ({ layers, enabledIds, onToggle }) => {
  if (layers.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginRight: '2px' }}>Layers:</span>
      {layers.map((layer) => {
        const enabled = enabledIds.includes(layer.id);
        return (
          <button
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
              border: enabled ? `1px solid ${layer.pin_color}` : '1px solid #e2e8f0',
              background: enabled ? `${layer.pin_color}15` : 'white',
              color: enabled ? layer.pin_color : '#94a3b8',
              fontWeight: enabled ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: enabled ? layer.pin_color : '#cbd5e1',
            }} />
            {layer.name}
            <span style={{ fontSize: '11px', opacity: 0.7 }}>({Number(layer.pin_count) || 0})</span>
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(CustomLayerToggle);
