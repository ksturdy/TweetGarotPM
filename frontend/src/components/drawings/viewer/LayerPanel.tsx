import React, { useState } from 'react';
import type { DrawingMarkupLayer } from '../../../lib/drawingViewer/types';

interface Props {
  layers: DrawingMarkupLayer[];
  activeLayerId: number | null;
  onSelectLayer: (id: number) => void;
  onToggleVisibility: (layer: DrawingMarkupLayer) => void;
  onAddLayer: (name: string, color: string, isPersonal: boolean) => void;
  onDeleteLayer: (id: number) => void;
}

export default function LayerPanel({
  layers, activeLayerId, onSelectLayer,
  onToggleVisibility, onAddLayer, onDeleteLayer,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#FF0000');
  const [isPersonal, setIsPersonal] = useState(false);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddLayer(newName.trim(), newColor, isPersonal);
    setNewName(''); setIsPersonal(false); setAdding(false);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#cdd8e5', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Layers
        </span>
        <button
          onClick={() => setAdding(v => !v)}
          style={{ background: '#1e4a8a', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}
        >
          +
        </button>
      </div>

      {adding && (
        <div style={{ marginBottom: 8, background: '#162032', borderRadius: 6, padding: 8 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Layer name"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={inputStyle}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              style={{ width: 28, height: 24, border: 'none', background: 'none', cursor: 'pointer' }} />
            <label style={{ color: '#7a9ab5', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={isPersonal} onChange={e => setIsPersonal(e.target.checked)} />
              Personal
            </label>
            <button onClick={handleAdd} style={{ ...addBtnStyle, marginLeft: 'auto' }}>Add</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {layers.map(layer => (
          <div
            key={layer.id}
            onClick={() => onSelectLayer(layer.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: layer.id === activeLayerId ? '#1e3a5f' : 'transparent',
              borderRadius: 6, padding: '6px 8px', cursor: 'pointer',
              border: `1px solid ${layer.id === activeLayerId ? '#2d72d9' : 'transparent'}`,
            }}
          >
            <div
              style={{ width: 12, height: 12, borderRadius: 3, background: layer.color, flexShrink: 0 }}
            />
            <span style={{ flex: 1, color: layer.is_visible ? '#cdd8e5' : '#4a6480', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {layer.name}
              {layer.is_personal && <span style={{ fontSize: 10, marginLeft: 4, color: '#7a9ab5' }}>(personal)</span>}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onToggleVisibility(layer); }}
              style={{ background: 'none', border: 'none', color: '#7a9ab5', cursor: 'pointer', fontSize: 12, padding: 0 }}
              title={layer.is_visible ? 'Hide' : 'Show'}
            >
              {layer.is_visible ? '👁' : '👁‍🗨'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
              style={{ background: 'none', border: 'none', color: '#5a7590', cursor: 'pointer', fontSize: 11, padding: 0 }}
              title="Delete layer"
            >
              ×
            </button>
          </div>
        ))}
        {layers.length === 0 && (
          <div style={{ color: '#4a6480', fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
            No layers yet. Add one above.
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0f1b2d', border: '1px solid #1e3a5f',
  borderRadius: 4, color: '#cdd8e5', fontSize: 12, padding: '4px 8px',
  boxSizing: 'border-box',
};

const addBtnStyle: React.CSSProperties = {
  background: '#1e4a8a', border: 'none', color: '#fff',
  borderRadius: 4, padding: '3px 10px', fontSize: 12, cursor: 'pointer',
};
