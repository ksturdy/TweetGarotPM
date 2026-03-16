import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DrawIcon from '@mui/icons-material/Draw';

interface NewTakeoffDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: 'manual' | 'traceover') => void;
}

const NewTakeoffDialog: React.FC<NewTakeoffDialogProps> = ({ open, onClose, onSelect }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: '32px',
          maxWidth: 560, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>New Takeoff</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>Choose the takeoff method</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Manual Entry Card */}
          <button
            onClick={() => onSelect('manual')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '28px 20px', background: '#fff', border: '2px solid #e5e7eb',
              borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#1a56db';
              e.currentTarget.style.background = '#eff6ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.background = '#fff';
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <EditNoteIcon style={{ fontSize: 28, color: '#1a56db' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Manual Entry</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>
                Add fittings, pipe, and valves manually with quick-add wizard and productivity rate lookup
              </div>
            </div>
          </button>

          {/* Traceover Card */}
          <button
            onClick={() => onSelect('traceover')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              padding: '28px 20px', background: '#fff', border: '2px solid #e5e7eb',
              borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#7c3aed';
              e.currentTarget.style.background = '#f5f3ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.background = '#fff';
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: '#f5f3ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DrawIcon style={{ fontSize: 28, color: '#7c3aed' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Traceover</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>
                Upload PDF drawings and trace piping routes to auto-generate takeoff items
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTakeoffDialog;
