import React from 'react';
import { RFI } from '../../services/rfis';
import RFIPreview from './RFIPreview';

interface RFIPreviewModalProps {
  rfi: RFI;
  onClose: () => void;
  onPrint?: () => void;
}

const RFIPreviewModal: React.FC<RFIPreviewModalProps> = ({ rfi, onClose, onPrint }) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>RFI Preview</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <span>🖨️</span> Print
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div style={{ padding: '20px' }}>
          <RFIPreview rfi={rfi} />
        </div>
      </div>

      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .rfi-print-content, .rfi-print-content * {
              visibility: visible;
            }
            .rfi-print-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
        `}
      </style>
    </div>
  );
};

export default RFIPreviewModal;
