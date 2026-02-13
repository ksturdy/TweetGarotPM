import React from 'react';
import ReactDOM from 'react-dom';
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
    const printRoot = document.querySelector('.print-root');
    if (!printRoot) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '900px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>Case Study - Print</title>
      <style>
        @page { margin: 0.3in; }
        body { margin: 0; padding: 0; }
        .no-print { display: none !important; }
        img { max-width: 100%; }
        .case-study-hero {
          height: auto !important;
          min-height: 160px;
          overflow: visible !important;
        }
      </style>
      </head><body>${printRoot.innerHTML}</body></html>`);
    doc.close();
    // Wait for images to load before printing
    const images = doc.querySelectorAll('img');
    let loaded = 0;
    const total = images.length;
    const triggerPrint = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
    if (total === 0) {
      triggerPrint();
    } else {
      const onLoad = () => {
        loaded++;
        if (loaded >= total) triggerPrint();
      };
      images.forEach(img => {
        if (img.complete) { onLoad(); }
        else { img.onload = onLoad; img.onerror = onLoad; }
      });
      // Fallback timeout in case images stall
      setTimeout(triggerPrint, 3000);
    }
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

  return ReactDOM.createPortal(
    <div
      className="print-overlay"
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
          body > *:not(.print-overlay) { display: none !important; }
          .print-overlay {
            position: static !important;
            overflow: visible !important;
            background: transparent !important;
          }
          .print-root {
            margin: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
          }
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
    </div>,
    document.body
  );
};

export default CaseStudyPreviewModal;
