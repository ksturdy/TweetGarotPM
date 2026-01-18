import React from 'react';
import { Estimate } from '../../services/estimates';
import EstimateProposalPreview from './EstimateProposalPreview';

interface EstimateProposalPreviewModalProps {
  estimate: Estimate;
  isOpen: boolean;
  onClose: () => void;
}

const EstimateProposalPreviewModal: React.FC<EstimateProposalPreviewModalProps> = ({
  estimate,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        overflow: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          margin: '20px auto',
          maxWidth: '900px',
          backgroundColor: '#fff',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Buttons (hide when printing) */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#002356',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
          }}
          className="no-print"
        >
          <h2 style={{ color: '#fff', margin: 0, fontSize: '18px' }}>
            Estimate Proposal Preview
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#fff',
                color: '#002356',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Print / PDF
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <EstimateProposalPreview estimate={estimate} />
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default EstimateProposalPreviewModal;
