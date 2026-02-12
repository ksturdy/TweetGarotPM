import React from 'react';
import { CaseStudy, CaseStudyImage, caseStudiesApi } from '../../services/caseStudies';
import { CaseStudyTemplate } from '../../services/caseStudyTemplates';
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
      alert('Failed to download PDF. Please try Print / PDF instead.');
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        overflow: 'auto',
      }}
      onClick={onClose}
    >
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          body > *:not(.print-root) { display: none !important; }
        }
      `}</style>

      <div
        className="print-root"
        style={{
          position: 'relative',
          margin: '20px auto',
          maxWidth: '900px',
          backgroundColor: '#fff',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Bar */}
        <div
          className="no-print"
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#1e3a5f',
            color: 'white',
            zIndex: 10,
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

        {/* Preview Content */}
        <CaseStudyPreview caseStudy={caseStudy} template={template} />
      </div>
    </div>
  );
};

export default CaseStudyPreviewModal;
