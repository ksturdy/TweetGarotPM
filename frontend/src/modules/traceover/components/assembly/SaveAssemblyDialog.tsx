import { useState, useCallback, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useUiStore } from '../../stores/useUiStore';
import { useToolStore } from '../../stores/useToolStore';
import { useAssemblyStore } from '../../stores/useAssemblyStore';
import { createAssemblyFromSelection } from '../../lib/assembly/createAssembly';

const ASSEMBLY_CATEGORIES = [
  'Pump Details',
  'Chiller Details',
  'AHU Details',
  'Boiler Details',
  'Heat Exchanger Details',
  'Cooling Tower Details',
  'General Piping',
  'Custom',
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  border: '1px solid #1f3450',
  backgroundColor: '#0d1825',
  padding: '8px 12px',
  fontSize: 14,
  color: '#d4e3f3',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 500,
  color: '#7a9ab5',
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 500,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
};

export default function SaveAssemblyDialog() {
  const showDialog = useUiStore((s) => s.showSaveAssemblyDialog);
  const setShowDialog = useUiStore((s) => s.setShowSaveAssemblyDialog);
  const selectedItems = useToolStore((s) => s.selectedItems);
  const clearSelection = useToolStore((s) => s.clearSelection);
  const addAssembly = useAssemblyStore((s) => s.addAssembly);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(ASSEMBLY_CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (showDialog) {
      setName('');
      setDescription('');
      setCategory(ASSEMBLY_CATEGORIES[0]);
      setError(null);
      setSaved(false);
    }
  }, [showDialog]);

  const handleClose = useCallback(() => {
    setShowDialog(false);
  }, [setShowDialog]);

  const handleSave = useCallback(() => {
    setError(null);

    if (!name.trim()) {
      setError('Please enter an assembly name.');
      return;
    }

    const runIds = selectedItems.filter((s) => s.type === 'traceover_run').map((s) => s.id);
    const itemIds = selectedItems.filter((s) => s.type === 'takeoff_item').map((s) => s.id);

    if (runIds.length === 0 && itemIds.length === 0) {
      setError('No traceover runs or placed items selected. Use Window Select (W) to select items first.');
      return;
    }

    try {
      const assemblyDef = createAssemblyFromSelection(
        runIds,
        itemIds,
        name.trim(),
        description.trim(),
        category,
      );
      addAssembly(assemblyDef);
      setSaved(true);

      setTimeout(() => {
        handleClose();
        clearSelection();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create assembly.');
    }
  }, [name, description, category, selectedItems, addAssembly, handleClose, clearSelection]);

  const runCount = selectedItems.filter((s) => s.type === 'traceover_run').length;
  const itemCount = selectedItems.filter((s) => s.type === 'takeoff_item').length;

  return (
    <Modal open={showDialog} onClose={handleClose} title="Save as Assembly">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: '#7a9ab5' }}>
          Save the selected items as a reusable assembly template. You can place it on any drawing later.
        </p>

        {/* Selection summary */}
        <div style={{ borderRadius: 6, border: '1px solid #1f3450', backgroundColor: '#0d1825', padding: '8px 12px', fontSize: 14, color: '#d4e3f3' }}>
          <span style={{ fontWeight: 500 }}>Selection:</span>{' '}
          {runCount > 0 && <span>{runCount} pipe run{runCount > 1 ? 's' : ''}</span>}
          {runCount > 0 && itemCount > 0 && <span>, </span>}
          {itemCount > 0 && <span>{itemCount} placed item{itemCount > 1 ? 's' : ''}</span>}
          {runCount === 0 && itemCount === 0 && (
            <span style={{ color: '#4a6a88' }}>No items selected</span>
          )}
        </div>

        <div>
          <label htmlFor="asm-name" style={labelStyle}>Name *</label>
          <input
            id="asm-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Pump Detail - Inline"
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="asm-desc" style={labelStyle}>Description</label>
          <textarea
            id="asm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        <div>
          <label htmlFor="asm-cat" style={labelStyle}>Category</label>
          <select
            id="asm-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
          >
            {ASSEMBLY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {error && <p style={{ fontSize: 14, color: '#f87171' }}>{error}</p>}
        {saved && <p style={{ fontSize: 14, color: '#4ade80' }}>Assembly saved successfully!</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
          <button onClick={handleClose} style={{ ...btnBase, backgroundColor: '#131f33', color: '#d4e3f3', border: '1px solid #1f3450' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saved} style={{ ...btnBase, backgroundColor: '#1e3a5f', color: '#fff', opacity: saved ? 0.5 : 1 }}>
            Save Assembly
          </button>
        </div>
      </div>
    </Modal>
  );
}
