import { useState, useCallback, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { usePageMetadataStore } from '../../stores/usePageMetadataStore';
import type { BuildingLevel, BuildingArea, AlternateGroup, AddendumGroup } from '../../types/pageMetadata';

interface DrawingPageRowProps {
  documentId: string;
  pageNumber: number;
  isActive: boolean;
  onNavigate: (pageNumber: number) => void;
  levels: BuildingLevel[];
  areas?: BuildingArea[];
  alternates: AlternateGroup[];
  addenda: AddendumGroup[];
}

const editInputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 4,
  border: '1px solid #1f3450',
  backgroundColor: '#131f33',
  padding: '2px 6px',
  fontSize: 12,
  color: '#d4e3f3',
  outline: 'none',
};

const editSelectStyle: React.CSSProperties = {
  borderRadius: 4,
  border: '1px solid #1f3450',
  backgroundColor: '#131f33',
  padding: '2px 4px',
  fontSize: 12,
  color: '#d4e3f3',
  outline: 'none',
  width: '50%',
};

export default function DrawingPageRow({
  documentId,
  pageNumber,
  isActive,
  onNavigate,
  levels,
  areas = [],
  alternates,
  addenda,
}: DrawingPageRowProps) {
  const meta = usePageMetadataStore((s) => s.getPageMeta)(documentId, pageNumber);
  const setPageMeta = usePageMetadataStore((s) => s.setPageMeta);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDrawingNumber, setEditDrawingNumber] = useState('');
  const [editLevelId, setEditLevelId] = useState('');
  const [editAreaId, setEditAreaId] = useState('');
  const [editRevision, setEditRevision] = useState('');
  const [editAlternateId, setEditAlternateId] = useState<string | null>(null);
  const [editAddendumId, setEditAddendumId] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditName(meta.name || `Drawing ${pageNumber}`);
      setEditDrawingNumber(meta.drawingNumber);
      setEditLevelId(meta.levelId);
      setEditAreaId(meta.areaId);
      setEditRevision(meta.revision);
      setEditAlternateId(meta.alternateId);
      setEditAddendumId(meta.addendumId);
      setEditing(true);
    },
    [meta, pageNumber],
  );

  const commitEdit = useCallback(() => {
    const name = editName.trim();
    setPageMeta(documentId, pageNumber, {
      name: name === `Drawing ${pageNumber}` ? '' : name,
      drawingNumber: editDrawingNumber.trim(),
      levelId: editLevelId,
      areaId: editAreaId,
      revision: editRevision.trim(),
      alternateId: editAlternateId,
      addendumId: editAddendumId,
    });
    setEditing(false);
  }, [
    documentId, pageNumber, editName, editDrawingNumber,
    editLevelId, editAreaId, editRevision, editAlternateId, editAddendumId, setPageMeta,
  ]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') commitEdit();
      else if (e.key === 'Escape') cancelEdit();
    },
    [commitEdit, cancelEdit],
  );

  const handleAlternateChange = useCallback((value: string) => {
    const id = value || null;
    setEditAlternateId(id);
    if (id) setEditAddendumId(null);
  }, []);

  const handleAddendumChange = useCallback((value: string) => {
    const id = value || null;
    setEditAddendumId(id);
    if (id) setEditAlternateId(null);
  }, []);

  const handleQuickLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation();
      setPageMeta(documentId, pageNumber, { levelId: e.target.value });
    },
    [documentId, pageNumber, setPageMeta],
  );

  const handleQuickAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      e.stopPropagation();
      setPageMeta(documentId, pageNumber, { areaId: e.target.value });
    },
    [documentId, pageNumber, setPageMeta],
  );

  const displayName = meta.name || `Drawing ${pageNumber}`;

  if (editing) {
    return (
      <div
        style={{ borderRadius: 4, border: '1px solid rgba(59, 130, 246, 0.3)', backgroundColor: '#0d1825', padding: '6px 8px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input ref={nameInputRef} value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Drawing name" style={{ ...editInputStyle, marginBottom: 4 }} />
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <input value={editDrawingNumber} onChange={(e) => setEditDrawingNumber(e.target.value)} onKeyDown={handleKeyDown} placeholder="Dwg #" style={{ ...editInputStyle, width: '50%' }} />
          <input value={editRevision} onChange={(e) => setEditRevision(e.target.value)} onKeyDown={handleKeyDown} placeholder="Rev" style={{ ...editInputStyle, width: '50%' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <select value={editLevelId} onChange={(e) => setEditLevelId(e.target.value)} style={editSelectStyle}>
            <option value="">No level</option>
            {[...levels].sort((a, b) => a.sortOrder - b.sortOrder).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select value={editAreaId} onChange={(e) => setEditAreaId(e.target.value)} style={editSelectStyle}>
            <option value="">No area</option>
            {[...areas].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          <select value={editAlternateId ?? ''} onChange={(e) => handleAlternateChange(e.target.value)} style={editSelectStyle}>
            <option value="">No alternate</option>
            {[...alternates].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select value={editAddendumId ?? ''} onChange={(e) => handleAddendumChange(e.target.value)} style={editSelectStyle}>
            <option value="">No addendum</option>
            {[...addenda].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button type="button" onClick={cancelEdit} style={{ background: 'none', border: 'none', padding: 2, color: '#4a6a88', cursor: 'pointer' }}>
            <X size={14} />
          </button>
          <button type="button" onClick={commitEdit} style={{ background: 'none', border: 'none', padding: 2, color: '#3b82f6', cursor: 'pointer' }}>
            <Check size={14} />
          </button>
        </div>
      </div>
    );
  }

  const quickSelectStyle: React.CSSProperties = {
    borderRadius: 4,
    border: '1px solid transparent',
    backgroundColor: '#1f3450',
    padding: '1px 4px',
    fontSize: 9,
    fontWeight: 500,
    outline: 'none',
  };

  return (
    <button
      type="button"
      onClick={() => onNavigate(pageNumber)}
      style={{
        display: 'flex',
        width: '100%',
        flexDirection: 'column',
        borderRadius: 4,
        padding: '6px 8px',
        textAlign: 'left',
        fontSize: 12,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
        backgroundColor: isActive ? '#1a3a5c' : 'transparent',
        color: isActive ? '#6db3f8' : '#7a9ab5',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'flex',
            height: 20,
            width: 20,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 500,
            backgroundColor: isActive ? '#3b82f6' : '#1f3450',
            color: isActive ? 'white' : '#4a6a88',
          }}
        >
          {pageNumber}
        </span>
        {meta.drawingNumber && (
          <span style={{ flexShrink: 0, fontFamily: 'monospace', fontSize: 10, fontWeight: 600, color: '#7a9ab5' }}>
            {meta.drawingNumber}
          </span>
        )}
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <span
          role="button"
          tabIndex={-1}
          onClick={startEdit}
          style={{ flexShrink: 0, opacity: 0, transition: 'opacity 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <Pencil size={12} style={{ color: '#4a6a88' }} />
        </span>
      </div>

      {(levels.length > 0 || areas.length > 0 || meta.revision) && (
        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 26 }}>
          {levels.length > 0 && (
            <select
              value={meta.levelId}
              onChange={handleQuickLevelChange}
              onClick={(e) => e.stopPropagation()}
              style={{ ...quickSelectStyle, color: meta.levelId ? '#7a9ab5' : '#4a6a88' }}
            >
              <option value="">Level</option>
              {[...levels].sort((a, b) => a.sortOrder - b.sortOrder).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          {areas.length > 0 && (
            <select
              value={meta.areaId}
              onChange={handleQuickAreaChange}
              onClick={(e) => e.stopPropagation()}
              style={{ ...quickSelectStyle, color: meta.areaId ? '#7a9ab5' : '#4a6a88' }}
            >
              <option value="">Area</option>
              {[...areas].sort((a, b) => a.sortOrder - b.sortOrder).map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          {meta.revision && (
            <span style={{ borderRadius: 4, backgroundColor: '#1f3450', padding: '1px 4px', fontSize: 9, fontWeight: 500, color: '#7a9ab5' }}>
              {meta.revision}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
