import { useState, useCallback } from 'react';
import { Trash2, Copy, Edit3, Check, X } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAssemblyStore } from '../../stores/useAssemblyStore';

interface AssemblyManagerProps {
  open: boolean;
  onClose: () => void;
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 4,
  border: 'none',
  backgroundColor: 'transparent',
  color: '#7a9ab5',
  cursor: 'pointer',
};

export default function AssemblyManager({ open, onClose }: AssemblyManagerProps) {
  const assemblies = useAssemblyStore((s) => s.assemblies);
  const updateAssembly = useAssemblyStore((s) => s.updateAssembly);
  const removeAssembly = useAssemblyStore((s) => s.removeAssembly);
  const duplicateAssembly = useAssemblyStore((s) => s.duplicateAssembly);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = useCallback(
    (id: string) => {
      const asm = assemblies.find((a) => a.id === id);
      if (!asm) return;
      setEditingId(id);
      setEditName(asm.name);
      setEditDesc(asm.description);
    },
    [assemblies],
  );

  const saveEdit = useCallback(() => {
    if (!editingId || !editName.trim()) return;
    updateAssembly(editingId, { name: editName.trim(), description: editDesc.trim() });
    setEditingId(null);
  }, [editingId, editName, editDesc, updateAssembly]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      removeAssembly(id);
      setConfirmDeleteId(null);
    },
    [removeAssembly],
  );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 4,
    border: '1px solid #1f3450',
    backgroundColor: '#131f33',
    padding: '4px 8px',
    fontSize: 12,
    color: '#d4e3f3',
    outline: 'none',
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Assemblies">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {assemblies.length === 0 ? (
          <p style={{ padding: '24px 0', textAlign: 'center', fontSize: 14, color: '#4a6a88' }}>
            No assemblies saved yet. Select items on the canvas and save as assembly.
          </p>
        ) : (
          <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {assemblies.map((asm) => (
              <div
                key={asm.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  borderRadius: 6,
                  border: '1px solid #1f3450',
                  backgroundColor: '#0d1825',
                  padding: 12,
                }}
              >
                {/* Thumbnail */}
                {asm.thumbnailDataUrl ? (
                  <img
                    src={asm.thumbnailDataUrl}
                    alt={asm.name}
                    style={{ height: 48, width: 64, flexShrink: 0, borderRadius: 4, border: '1px solid #1f3450', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ display: 'flex', height: 48, width: 64, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: '1px solid #1f3450', backgroundColor: '#131f33', fontSize: 12, color: '#4a6a88' }}>
                    ASM
                  </div>
                )}

                {/* Details */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  {editingId === asm.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                      <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description..." style={inputStyle} />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={saveEdit} style={iconBtnStyle} title="Save"><Check size={14} /></button>
                        <button type="button" onClick={cancelEdit} style={iconBtnStyle} title="Cancel"><X size={14} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 500, color: '#d4e3f3' }}>{asm.name}</div>
                      {asm.description && (
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#4a6a88' }}>{asm.description}</div>
                      )}
                      <div style={{ marginTop: 2, fontSize: 10, color: '#4a6a88' }}>
                        {asm.category} &middot; {asm.runs.length} runs, {asm.placedItems.length} items
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== asm.id && (
                  <div style={{ display: 'flex', flexShrink: 0, gap: 4 }}>
                    <button type="button" onClick={() => startEdit(asm.id)} style={iconBtnStyle} title="Edit"><Edit3 size={14} /></button>
                    <button type="button" onClick={() => duplicateAssembly(asm.id)} style={iconBtnStyle} title="Duplicate"><Copy size={14} /></button>
                    {confirmDeleteId === asm.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => handleDelete(asm.id)}
                          style={{ borderRadius: 4, backgroundColor: '#dc2626', padding: '2px 8px', fontSize: 10, color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          style={{ borderRadius: 4, backgroundColor: '#1f3450', padding: '2px 8px', fontSize: 10, color: '#7a9ab5', border: 'none', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteId(asm.id)} style={iconBtnStyle} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              backgroundColor: '#131f33',
              color: '#d4e3f3',
              border: '1px solid #1f3450',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
