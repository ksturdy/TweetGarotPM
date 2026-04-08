import React from 'react';
import ReactDOM from 'react-dom';
import { CaseStudy, CaseStudyImage, caseStudiesApi } from '../../services/caseStudies';
import { CaseStudyTemplate } from '../../services/caseStudyTemplates';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import CaseStudyPreview from './CaseStudyPreview';

interface CaseStudyPreviewModalProps {
  caseStudy: CaseStudy & { images?: CaseStudyImage[] };
  template?: CaseStudyTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

const CaseStudyPreviewModal: React.FC<CaseStudyPreviewModalProps> = ({
  caseStudy,
  template,
  isOpen,
  onClose,
}) => {
  const { toast } = useTitanFeedback();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await caseStudiesApi.downloadPdf(caseStudy.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Case-Study-${caseStudy.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF. Please try Print / PDF instead.');
    }
  };

  return ReactDOM.createPortal(
    <div
      className="print-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#525659',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          body > *:not(.print-overlay) { display: none !important; }
          .no-print { display: none !important; }
          .print-overlay {
            position: static !important;
            overflow: visible !important;
            background: transparent !important;
            display: block !important;
          }
          .page-scroll-area {
            overflow: visible !important;
            padding: 0 !important;
            display: block !important;
            justify-content: flex-start !important;
          }
          .print-root {
            margin: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            height: auto !important;
          }
          .cs-footer-logo {
            position: fixed !important;
            bottom: 16px !important;
            right: 40px !important;
          }
        }
      `}</style>

      {/* Action Bar - fixed at top */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          backgroundColor: '#1e3a5f',
          color: 'white',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600 }}>Case Study Preview</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePrint}
            style={{
              padding: '6px 16px',
              backgroundColor: 'white',
              color: '#1e3a5f',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Print / PDF
          </button>
          <button
            onClick={handleDownloadPdf}
            style={{
              padding: '6px 16px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Download PDF
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: 'transparent',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Scrollable area with page */}
      <div
        className="page-scroll-area"
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '30px 20px',
        }}
        onClick={onClose}
      >
        <div
          className="print-root"
          style={{
            width: '816px',
            height: '1056px',
            backgroundColor: '#fff',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
            flexShrink: 0,
            alignSelf: 'flex-start',
            position: 'relative' as const,
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Preview Content */}
          <CaseStudyPreview caseStudy={caseStudy} template={template} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CaseStudyPreviewModal;
