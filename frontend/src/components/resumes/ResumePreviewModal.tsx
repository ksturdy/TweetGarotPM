import React from 'react';
import ReactDOM from 'react-dom';
import { EmployeeResume, ResumeProject, employeeResumesApi } from '../../services/employeeResumes';
import ResumePreview from './ResumePreview';

interface ResumePreviewModalProps {
  resume: EmployeeResume;
  projects: ResumeProject[];
  isOpen: boolean;
  onClose: () => void;
  photoPreviewUrl?: string;
}

const ResumePreviewModal: React.FC<ResumePreviewModalProps> = ({
  resume,
  projects,
  isOpen,
  onClose,
  photoPreviewUrl,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    const printRoot = document.querySelector('.print-root');
    if (!printRoot) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '100%';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>Resume - ${resume.employee_name}</title>
      <style>
        /* Resume Preview Styles */
        @page { margin: 0.5in; }
        body { margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }

        .resume-container {
          display: grid;
          grid-template-columns: 30% 70%;
          width: 100%;
          min-height: 100vh;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          line-height: 1.5;
          color: #1a1a1a;
        }

        /* Sidebar Styles */
        .resume-sidebar {
          background-color: #1e3a5f;
          color: white;
          padding: 2rem 1.5rem;
        }

        .photo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .employee-photo {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid white;
        }

        .name-title {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 2px solid rgba(255, 255, 255, 0.3);
        }

        .employee-name {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .job-title {
          font-size: 11pt;
          color: #e0e0e0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.25rem;
        }

        .years-experience {
          font-size: 9pt;
          color: #b0b0b0;
        }

        .resume-sidebar-section {
          margin-bottom: 1.5rem;
        }

        .resume-sidebar-title {
          font-size: 11pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgba(255, 255, 255, 0.3);
        }

        .contact-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 0.75rem;
          font-size: 9pt;
          line-height: 1.4;
        }

        .contact-icon {
          margin-right: 0.5rem;
          flex-shrink: 0;
        }

        .reference-item {
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .reference-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
          margin-bottom: 0;
        }

        .reference-name {
          font-weight: bold;
          font-size: 10pt;
          margin-bottom: 0.25rem;
        }

        .reference-title, .reference-company, .reference-phone {
          font-size: 9pt;
          color: #e0e0e0;
          margin-bottom: 0.1rem;
        }

        .hobbies-list {
          list-style: none;
          font-size: 9pt;
          padding: 0;
        }

        .hobbies-list li {
          padding-left: 1rem;
          margin-bottom: 0.5rem;
          position: relative;
        }

        .hobbies-list li:before {
          content: "•";
          position: absolute;
          left: 0;
          color: #10b981;
        }

        /* Main Content Styles */
        .resume-main-content {
          background-color: white;
          padding: 2rem;
        }

        .resume-section {
          margin-bottom: 2rem;
        }

        .resume-section-title {
          font-size: 13pt;
          font-weight: bold;
          color: #1e3a5f;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 3px solid #1e3a5f;
        }

        .summary-text {
          font-size: 10pt;
          line-height: 1.6;
          text-align: justify;
        }

        .project-item {
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          page-break-inside: avoid;
        }

        .project-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
          margin-bottom: 0;
        }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.5rem;
        }

        .project-name {
          font-size: 11pt;
          font-weight: bold;
          color: #1e3a5f;
          margin-bottom: 0.25rem;
        }

        .project-role {
          font-size: 10pt;
          color: #1e3a5f;
          font-weight: 600;
          margin: 0;
        }

        .project-dates {
          font-size: 9pt;
          color: #666;
          font-style: italic;
          margin-bottom: 0.5rem;
        }

        .project-details {
          font-size: 9pt;
          color: #555;
          margin-bottom: 0.5rem;
        }

        .project-description {
          font-size: 10pt;
          line-height: 1.5;
        }

        .education-text {
          font-size: 10pt;
          line-height: 1.6;
          margin-bottom: 1rem;
          white-space: pre-line;
        }

        .certifications-list {
          list-style: none;
          font-size: 10pt;
          padding: 0;
        }

        .certifications-list li {
          padding-left: 1.5rem;
          margin-bottom: 0.5rem;
          position: relative;
        }

        .certifications-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #10b981;
          font-weight: bold;
        }

        .skills-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .skill-pill {
          display: inline-block;
          padding: 0.4rem 0.8rem;
          background-color: #f0f0f0;
          color: #1e3a5f;
          border-radius: 20px;
          font-size: 9pt;
          font-weight: 600;
        }

        .languages-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .language-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background-color: #f8f8f8;
          border-radius: 4px;
        }

        .language-name {
          font-size: 10pt;
          font-weight: bold;
          color: #1e3a5f;
        }

        .language-proficiency {
          font-size: 9pt;
          color: #666;
        }
      </style>
      </head><body>${printRoot.innerHTML}</body></html>`);
    doc.close();

    // Wait for images to load before printing
    const images = doc.querySelectorAll('img');
    let loaded = 0;
    const total = images.length;
    let hasTriggered = false;

    const triggerPrint = () => {
      if (hasTriggered) return;
      hasTriggered = true;
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    if (total === 0) {
      triggerPrint();
    } else {
      const onLoad = () => {
        loaded++;
        if (loaded >= total) triggerPrint();
      };
      images.forEach(img => {
        if (img.complete) {
          onLoad();
        } else {
          img.onload = onLoad;
          img.onerror = onLoad;
        }
      });
      // Fallback timeout in case images stall
      setTimeout(triggerPrint, 3000);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await employeeResumesApi.downloadPdf(resume.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Resume-${resume.employee_name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
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
          maxWidth: '1000px',
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
          <span style={{ fontWeight: 600 }}>Resume Preview - {resume.employee_name}</span>
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
        <ResumePreview resume={resume} projects={projects} photoPreviewUrl={photoPreviewUrl} />
      </div>
    </div>,
    document.body
  );
};

export default ResumePreviewModal;
